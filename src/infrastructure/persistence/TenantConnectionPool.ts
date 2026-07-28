import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { TenantRegistry, TenantRegistryEntry } from './TenantRegistry';

/**
 * Entry in the connection pool cache — wraps a PrismaClient
 * with its associated pg Pool and access metadata.
 */
interface PoolEntry {
  prisma: PrismaClient;
  pool: Pool;
  lastAccessedAt: number;
  tenantId: string;
  dbName: string;
}

/**
 * TenantConnectionPool maintains an LRU-evicting cache of PrismaClient
 * instances, one per tenant database. On cache miss it creates a new
 * connection using the tenant's registry entry.
 *
 * With the "separate databases" strategy, each tenant gets its own
 * PostgreSQL database and a dedicated PrismaClient pointing at that
 * database's `public` schema.
 */
export class TenantConnectionPool {
  private cache = new Map<string, PoolEntry>();
  private evictionTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly registry: TenantRegistry,
    private readonly maxSize: number = 50,
    private readonly maxIdleMs: number = 5 * 60 * 1000, // 5 minutes
    private readonly evictionIntervalMs: number = 60 * 1000 // check every minute
  ) {
    this.startEvictionLoop();
  }

  /**
   * Get a PrismaClient for the given tenant. Creates one on cache miss.
   */
  async getClient(tenantId: string): Promise<PrismaClient> {
    // Cache hit — update access time and return
    const existing = this.cache.get(tenantId);
    if (existing) {
      existing.lastAccessedAt = Date.now();
      return existing.prisma;
    }

    // Cache miss — look up tenant in registry
    const entry = await this.registry.lookupTenant(tenantId);
    if (!entry) {
      throw new Error(`Tenant "${tenantId}" not found in registry.`);
    }
    if (entry.status !== 'ACTIVE') {
      throw new Error(`Tenant "${tenantId}" is not active (status: "${entry.status}").`);
    }

    // Evict LRU if at capacity
    if (this.cache.size >= this.maxSize) {
      await this.evictLRU();
    }

    // Create new connection to the tenant's dedicated database
    const client = await this.createClient(entry);
    this.cache.set(tenantId, client);
    return client.prisma;
  }

  /**
   * Check if a tenant has a cached connection.
   */
  has(tenantId: string): boolean {
    return this.cache.has(tenantId);
  }

  /**
   * Remove a specific tenant from the pool, disconnecting its client.
   */
  async evict(tenantId: string): Promise<void> {
    const entry = this.cache.get(tenantId);
    if (entry) {
      await this.disconnectEntry(entry);
      this.cache.delete(tenantId);
    }
  }

  /**
   * Warm the pool by pre-connecting to all active tenants.
   */
  async warmPool(): Promise<number> {
    const activeTenants = await this.registry.listTenants('ACTIVE');
    let warmed = 0;
    for (const tenant of activeTenants) {
      if (!this.cache.has(tenant.tenantId) && this.cache.size < this.maxSize) {
        try {
          await this.getClient(tenant.tenantId);
          warmed++;
        } catch (err: any) {
          console.error(`[TenantConnectionPool] Failed to warm tenant "${tenant.tenantId}":`, err.message);
        }
      }
    }
    console.log(`[TenantConnectionPool] Warmed ${warmed} tenant connections (${this.cache.size} total cached).`);
    return warmed;
  }

  /**
   * Get current pool statistics.
   */
  getStats(): { size: number; maxSize: number; tenantIds: string[] } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      tenantIds: Array.from(this.cache.keys()),
    };
  }

  /**
   * Shut down the pool, disconnecting all clients.
   */
  async shutdown(): Promise<void> {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }

    for (const [tenantId, entry] of this.cache.entries()) {
      await this.disconnectEntry(entry);
    }
    this.cache.clear();
    console.log('[TenantConnectionPool] All connections closed.');
  }

  // ──────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────

  private async createClient(entry: TenantRegistryEntry): Promise<PoolEntry> {
    // Each tenant has its own database — connect to it on the public schema
    const connectionString = `postgresql://${entry.dbUser}:${entry.dbPassword}@${entry.dbHost}:${entry.dbPort}/${entry.dbName}?schema=public&connection_limit=10`;

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter } as any);

    console.log(`[TenantConnectionPool] Created connection for tenant "${entry.tenantId}" (database: "${entry.dbName}").`);

    return {
      prisma,
      pool,
      lastAccessedAt: Date.now(),
      tenantId: entry.tenantId,
      dbName: entry.dbName,
    };
  }

  private async disconnectEntry(entry: PoolEntry): Promise<void> {
    try {
      await entry.prisma.$disconnect();
      await entry.pool.end();
      console.log(`[TenantConnectionPool] Disconnected tenant "${entry.tenantId}".`);
    } catch (err: any) {
      console.error(`[TenantConnectionPool] Error disconnecting tenant "${entry.tenantId}":`, err.message);
    }
  }

  private async evictLRU(): Promise<void> {
    let oldest: PoolEntry | null = null;
    let oldestKey: string | null = null;

    for (const [key, entry] of this.cache.entries()) {
      if (!oldest || entry.lastAccessedAt < oldest.lastAccessedAt) {
        oldest = entry;
        oldestKey = key;
      }
    }

    if (oldestKey && oldest) {
      await this.disconnectEntry(oldest);
      this.cache.delete(oldestKey);
      console.log(`[TenantConnectionPool] Evicted LRU tenant "${oldestKey}".`);
    }
  }

  private startEvictionLoop(): void {
    this.evictionTimer = setInterval(async () => {
      const now = Date.now();
      const toEvict: string[] = [];

      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.lastAccessedAt > this.maxIdleMs) {
          toEvict.push(key);
        }
      }

      for (const key of toEvict) {
        await this.evict(key);
      }

      if (toEvict.length > 0) {
        console.log(`[TenantConnectionPool] Evicted ${toEvict.length} idle connections (${this.cache.size} remaining).`);
      }
    }, this.evictionIntervalMs);
  }
}
