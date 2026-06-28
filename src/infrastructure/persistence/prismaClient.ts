import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { AsyncLocalStorage } from 'async_hooks';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = `${process.env.DATABASE_URL}`;
export const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
export const globalPrisma = new PrismaClient({ adapter } as any);

export const prismaContext = new AsyncLocalStorage<PrismaClient>();

export function getTenantPrisma(basePrisma: PrismaClient, tenantId: string): any {
  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (tenantId && process.env.NODE_ENV !== 'test') {
            try {
              await basePrisma.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', $1, false)`, tenantId);
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
