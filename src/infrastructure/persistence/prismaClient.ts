import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { AsyncLocalStorage } from 'async_hooks';
import * as dotenv from 'dotenv';
import { TenantRegistry } from './TenantRegistry';
import { TenantConnectionPool } from './TenantConnectionPool';

dotenv.config();

// ──────────────────────────────────────────────
// Multi-Tenant Mode Configuration
// ──────────────────────────────────────────────
// MULTI_TENANT_MODE controls how tenant isolation is achieved:
//   'schema'  — Each tenant gets an isolated PostgreSQL schema (6.1)
//   'shared'  — All tenants share one schema with RLS policies (legacy)
//
// Defaults to 'shared' for backward compatibility.
export const MULTI_TENANT_MODE: 'schema' | 'shared' =
  (process.env.MULTI_TENANT_MODE as 'schema' | 'shared') || 'shared';

const connectionString = `${process.env.DATABASE_URL}`;
export const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
export const globalPrisma = new PrismaClient({ adapter } as any);

export const prismaContext = new AsyncLocalStorage<PrismaClient>();

// ──────────────────────────────────────────────
// Schema-per-tenant infrastructure (6.1)
// ──────────────────────────────────────────────
// Lazily initialized — only created when MULTI_TENANT_MODE='schema'
let _tenantRegistry: TenantRegistry | null = null;
let _tenantConnectionPool: TenantConnectionPool | null = null;

/**
 * Get the TenantRegistry singleton (creates on first access).
 */
export function getTenantRegistry(): TenantRegistry {
  if (!_tenantRegistry) {
    _tenantRegistry = new TenantRegistry(globalPrisma);
  }
  return _tenantRegistry;
}

/**
 * Get the TenantConnectionPool singleton (creates on first access).
 */
export function getTenantConnectionPool(): TenantConnectionPool {
  if (!_tenantConnectionPool) {
    _tenantConnectionPool = new TenantConnectionPool(
      getTenantRegistry(),
      parseInt(process.env.TENANT_POOL_MAX_SIZE || '50', 10),
      parseInt(process.env.TENANT_POOL_IDLE_MS || '300000', 10)
    );
  }
  return _tenantConnectionPool;
}

// ──────────────────────────────────────────────
// Tenant PrismaClient Resolution
// ──────────────────────────────────────────────

/**
 * Get a PrismaClient scoped to a specific tenant.
 *
 * In 'schema' mode: returns a PrismaClient connected to the tenant's
 * isolated PostgreSQL schema via the TenantConnectionPool.
 *
 * In 'shared' mode: returns a Prisma $extends wrapper that injects
 * tenant_id into all queries (the legacy RLS approach).
 */
export function getTenantPrisma(basePrisma: PrismaClient, tenantId: string): any {
  if (MULTI_TENANT_MODE === 'schema') {
    // In schema mode, we can't do async here so we return a proxy
    // that lazily resolves the tenant client on first database access.
    return createSchemaModeTenantProxy(tenantId);
  }

  // Legacy shared mode — use Prisma $extends to inject tenant_id
  return createSharedModeTenantPrisma(basePrisma, tenantId);
}

/**
 * Async version of getTenantPrisma for contexts where await is available.
 * Preferred over the synchronous version when possible.
 */
export async function getTenantPrismaAsync(tenantId: string): Promise<PrismaClient> {
  if (MULTI_TENANT_MODE === 'schema') {
    return getTenantConnectionPool().getClient(tenantId);
  }
  return createSharedModeTenantPrisma(globalPrisma, tenantId);
}

// ──────────────────────────────────────────────
// Shared-mode (RLS) tenant scoping (legacy)
// ──────────────────────────────────────────────

function createSharedModeTenantPrisma(basePrisma: PrismaClient, tenantId: string): any {
  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (tenantId && process.env.NODE_ENV !== 'test') {
            try {
              await basePrisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, false)`;
            } catch (err: any) {
              console.error("[PrismaExtension] Failed to set app.current_tenant_id:", err.message);
            }
          }

          const modelsWithTenant = [
            'LedgerEntry',
            'SerializedItem',
            'IntegrationConnection',
            'ExternalMapping',
            'JournalEntry',
            'StockOnboarding',
            'Notification',
            'AuditDiscrepancy',
          ];

            if (modelsWithTenant.includes(model)) {
              const customArgs = (args || {}) as any;
              args = customArgs;

              // 1. Enforce query/read filtering via 'where'
              customArgs.where = customArgs.where || {};
              customArgs.where.tenantId = tenantId;

              // 2. Enforce write/mutation data injection
              if (operation === 'create') {
                customArgs.data = customArgs.data || {};
                customArgs.data.tenantId = tenantId;
              } else if (operation === 'createMany') {
                if (customArgs.data) {
                  if (Array.isArray(customArgs.data)) {
                    customArgs.data = customArgs.data.map((item: any) => ({
                      ...item,
                      tenantId,
                    }));
                  } else {
                    customArgs.data.tenantId = tenantId;
                  }
                }
              } else if (operation === 'update' || operation === 'updateMany') {
                customArgs.data = customArgs.data || {};
                customArgs.data.tenantId = tenantId;
              } else if (operation === 'upsert') {
                customArgs.create = customArgs.create || {};
                customArgs.create.tenantId = tenantId;
                customArgs.update = customArgs.update || {};
                customArgs.update.tenantId = tenantId;
              }
            }

            return query(args);
        },
      },
    },
  });
}

// ──────────────────────────────────────────────
// Schema-mode tenant proxy
// ──────────────────────────────────────────────

/**
 * Creates a proxy that lazily resolves the tenant's PrismaClient
 * from the connection pool on first property access. This allows
 * getTenantPrisma() to remain synchronous while the actual client
 * resolution happens asynchronously.
 */
function createSchemaModeTenantProxy(tenantId: string): any {
  let resolvedClient: PrismaClient | null = null;
  let resolving: Promise<PrismaClient> | null = null;

  return new Proxy({} as any, {
    get(target, prop) {
      if (prop === 'then' || prop === Symbol.toPrimitive) {
        return undefined; // Prevent Promise auto-unwrapping
      }

      // If already resolved, delegate directly
      if (resolvedClient) {
        const value = (resolvedClient as any)[prop];
        return typeof value === 'function' ? value.bind(resolvedClient) : value;
      }

      // Return an async-capable proxy for model accessors
      if (typeof prop === 'string' && prop.startsWith('$')) {
        // Prisma internal methods ($transaction, $executeRaw, etc.)
        return async (...args: any[]) => {
          if (!resolvedClient) {
            resolvedClient = await getTenantConnectionPool().getClient(tenantId);
          }
          return (resolvedClient as any)[prop](...args);
        };
      }

      // Model accessors (e.g., prisma.inventoryItem)
      return new Proxy({} as any, {
        get(modelTarget, modelProp) {
          if (typeof modelProp === 'string') {
            return async (...args: any[]) => {
              if (!resolvedClient) {
                resolvedClient = await getTenantConnectionPool().getClient(tenantId);
              }
              return (resolvedClient as any)[prop][modelProp](...args);
            };
          }
          return undefined;
        }
      });
    }
  });
}

// Transparent Proxy wrapper that intercepts operations and scopes them to the active tenant in AsyncLocalStorage if present.
const prismaProxy = new Proxy(globalPrisma, {
  get(target, prop, receiver) {
    const activePrisma = prismaContext.getStore() || target;
    const value = Reflect.get(activePrisma, prop);
    if (typeof value === 'function') {
      return value.bind(activePrisma);
    }
    return value;
  },
}) as any;

export const prisma = process.env.NODE_ENV === 'test' ? globalPrisma : prismaProxy;
