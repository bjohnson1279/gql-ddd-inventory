import { PrismaClient } from '@prisma/client';

/**
 * TenantRegistryEntry represents a tenant's database schema metadata
 * in the control-plane registry.
 */
export interface TenantRegistryEntry {
  tenantId: string;
  schemaName: string;
  dbHost: string;
  dbPort: number;
  dbName: string;
  status: 'PROVISIONING' | 'ACTIVE' | 'MIGRATING' | 'DEPROVISIONED';
  provisionedAt: Date;
  migratedVersion: string;
}

/**
 * TenantRegistry manages the mapping between tenant IDs and their
 * isolated database schemas. It uses the shared control database
 * (the existing "public" schema) to store registry metadata.
 *
 * This replaces the previous approach where all tenants shared a
 * single schema with RLS policies filtering by tenant_id.
 */
export class TenantRegistry {
  constructor(private readonly controlPrisma: PrismaClient) {}

  /**
   * Register a new tenant in the control-plane registry.
   * Does NOT create the schema — that's the Provisioner's job.
   */
  async registerTenant(tenantId: string, dbHost?: string, dbPort?: number, dbName?: string): Promise<TenantRegistryEntry> {
    const schemaName = `tenant_${tenantId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    const host = dbHost || process.env.DB_HOST || '127.0.0.1';
    const port = dbPort || parseInt(process.env.DB_PORT || '5432', 10);
    const name = dbName || process.env.DB_NAME || 'inventory_db';

    const existing = await this.lookupTenant(tenantId);
    if (existing && existing.status !== 'DEPROVISIONED') {
      throw new Error(`Tenant "${tenantId}" is already registered with status "${existing.status}".`);
    }

    const entry: TenantRegistryEntry = {
      tenantId,
      schemaName,
      dbHost: host,
      dbPort: port,
      dbName: name,
      status: 'PROVISIONING',
      provisionedAt: new Date(),
      migratedVersion: '0',
    };

    await this.controlPrisma.$executeRawUnsafe(`
      INSERT INTO tenant_registry (tenant_id, schema_name, db_host, db_port, db_name, status, provisioned_at, migrated_version)
      VALUES ('${tenantId}', '${entry.schemaName}', '${entry.dbHost}', ${entry.dbPort}, '${entry.dbName}', '${entry.status}', NOW(), '${entry.migratedVersion}')
      ON CONFLICT (tenant_id) DO UPDATE SET
        schema_name = EXCLUDED.schema_name,
        db_host = EXCLUDED.db_host,
        db_port = EXCLUDED.db_port,
        db_name = EXCLUDED.db_name,
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
      SELECT tenant_id, schema_name, db_host, db_port, db_name, status, provisioned_at, migrated_version
      FROM tenant_registry
      WHERE tenant_id = '${tenantId}';
    `);

    if (results.length === 0) return null;

    const row = results[0];
    return {
      tenantId: row.tenant_id,
      schemaName: row.schema_name,
      dbHost: row.db_host,
      dbPort: row.db_port,
      dbName: row.db_name,
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
      SELECT tenant_id, schema_name, db_host, db_port, db_name, status, provisioned_at, migrated_version
      FROM tenant_registry ${whereClause}
      ORDER BY provisioned_at DESC;
    `);

    return results.map((row: any) => ({
      tenantId: row.tenant_id,
      schemaName: row.schema_name,
      dbHost: row.db_host,
      dbPort: row.db_port,
      dbName: row.db_name,
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
