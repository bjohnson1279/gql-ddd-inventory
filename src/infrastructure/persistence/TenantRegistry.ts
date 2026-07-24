import { PrismaClient, Prisma } from '@prisma/client';

/**
 * TenantRegistryEntry represents a tenant's isolated database metadata
 * in the control-plane registry.
 *
 * With the "separate databases" strategy, each tenant gets its own
 * PostgreSQL database (e.g., `inventory_tenant_acme_corp`) rather than
 * a schema within a shared database.
 */
export interface TenantRegistryEntry {
  tenantId: string;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  status: 'PROVISIONING' | 'ACTIVE' | 'MIGRATING' | 'DEPROVISIONED';
  provisionedAt: Date;
  migratedVersion: string;
}

/**
 * TenantRegistry manages the mapping between tenant IDs and their
 * isolated databases. It uses the shared control database
 * (the existing `inventory_db`) to store registry metadata.
 *
 * This replaces the previous approach where all tenants shared a
 * single database with RLS policies filtering by tenant_id.
 */
export class TenantRegistry {
  constructor(private readonly controlPrisma: PrismaClient) {}

  /**
   * Register a new tenant in the control-plane registry.
   * Does NOT create the database — that's the Provisioner's job.
   */
  async registerTenant(
    tenantId: string,
    dbHost?: string,
    dbPort?: number,
    dbName?: string,
    dbUser?: string,
    dbPassword?: string
  ): Promise<TenantRegistryEntry> {
    const safeName = tenantId.replace(/[^a-zA-Z0-9_]/g, '_');
    const host = dbHost || process.env.DB_HOST || '127.0.0.1';
    const port = dbPort || parseInt(process.env.DB_PORT || '5433', 10);
    const name = dbName || `inventory_tenant_${safeName}`;
    const user = dbUser || process.env.DB_USER || 'inventory_user';
    const password = dbPassword || process.env.DB_PASSWORD || 'inventory_password';

    const existing = await this.lookupTenant(tenantId);
    if (existing && existing.status !== 'DEPROVISIONED') {
      throw new Error(`Tenant "${tenantId}" is already registered with status "${existing.status}".`);
    }

    const entry: TenantRegistryEntry = {
      tenantId,
      dbHost: host,
      dbPort: port,
      dbName: name,
      dbUser: user,
      dbPassword: password,
      status: 'PROVISIONING',
      provisionedAt: new Date(),
      migratedVersion: '0',
    };

    await this.controlPrisma.$executeRawUnsafe(`
      INSERT INTO tenant_registry (tenant_id, db_host, db_port, db_name, db_user, db_password, status, provisioned_at, migrated_version)
      VALUES ('${tenantId}', '${entry.dbHost}', ${entry.dbPort}, '${entry.dbName}', '${entry.dbUser}', '${entry.dbPassword}', '${entry.status}', NOW(), '${entry.migratedVersion}')
      ON CONFLICT (tenant_id) DO UPDATE SET
        db_host = EXCLUDED.db_host,
        db_port = EXCLUDED.db_port,
        db_name = EXCLUDED.db_name,
        db_user = EXCLUDED.db_user,
        db_password = EXCLUDED.db_password,
        status = EXCLUDED.status,
        provisioned_at = NOW(),
        migrated_version = EXCLUDED.migrated_version;
    `);

    return entry;
  }

  /**
   * Look up a tenant's registry entry by tenant ID.
   */
  async lookupTenant(tenantId: string): Promise<TenantRegistryEntry | null> {
    const results: any[] = await this.controlPrisma.$queryRawUnsafe(`
      SELECT tenant_id, db_host, db_port, db_name, db_user, db_password, status, provisioned_at, migrated_version
      FROM tenant_registry
      WHERE tenant_id = '${tenantId}';
    `);

    if (results.length === 0) return null;

    const row = results[0];
    return {
      tenantId: row.tenant_id,
      dbHost: row.db_host,
      dbPort: row.db_port,
      dbName: row.db_name,
      dbUser: row.db_user,
      dbPassword: row.db_password,
      status: row.status,
      provisionedAt: new Date(row.provisioned_at),
      migratedVersion: row.migrated_version,
    };
  }

  /**
   * List all tenants, optionally filtered by status.
   */
  async listTenants(status?: string): Promise<TenantRegistryEntry[]> {
    const whereClause = status ? `WHERE status = '${status}'` : '';
    const results: any[] = await this.controlPrisma.$queryRawUnsafe(`
      SELECT tenant_id, db_host, db_port, db_name, db_user, db_password, status, provisioned_at, migrated_version
      FROM tenant_registry ${whereClause}
      ORDER BY provisioned_at DESC;
    `);

    return results.map((row: any) => ({
      tenantId: row.tenant_id,
      dbHost: row.db_host,
      dbPort: row.db_port,
      dbName: row.db_name,
      dbUser: row.db_user,
      dbPassword: row.db_password,
      status: row.status,
      provisionedAt: new Date(row.provisioned_at),
      migratedVersion: row.migrated_version,
    }));
  }

  /**
   * Update a tenant's status in the registry.
   */
  async updateStatus(tenantId: string, status: TenantRegistryEntry['status']): Promise<void> {
    await this.controlPrisma.$executeRawUnsafe(`
      UPDATE tenant_registry SET status = '${status}' WHERE tenant_id = '${tenantId}';
    `);
  }

  /**
   * Update a tenant's migrated version after successful migration.
   */
  async updateMigratedVersion(tenantId: string, version: string): Promise<void> {
    await this.controlPrisma.$executeRawUnsafe(`
      UPDATE tenant_registry SET migrated_version = '${version}' WHERE tenant_id = '${tenantId}';
    `);
  }

  /**
   * Mark a tenant as deprovisioned (soft delete).
   */
  async deprovisionTenant(tenantId: string): Promise<void> {
    await this.updateStatus(tenantId, 'DEPROVISIONED');
  }
}
