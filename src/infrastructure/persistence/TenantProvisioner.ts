import { PrismaClient } from '@prisma/client';
import { TenantRegistry } from './TenantRegistry';

/**
 * TenantProvisioner handles the lifecycle of creating and tearing down
 * isolated PostgreSQL schemas for tenants.
 *
 * The provisioning flow:
 *   1. Registry registers the tenant (status: PROVISIONING)
 *   2. Provisioner creates the schema
 *   3. Provisioner runs DDL migrations into the schema
 *   4. Provisioner seeds default data (roles, permissions, default config)
 *   5. Registry updates status to ACTIVE
 *
 * Uses the control-plane PrismaClient (connected to the "public" schema)
 * to execute raw DDL against the database.
 */
export class TenantProvisioner {
  constructor(
    private readonly controlPrisma: PrismaClient,
    private readonly registry: TenantRegistry
  ) {}

  /**
   * Provision a new tenant: create schema, run migrations, seed data.
   * Returns the schema name for the newly provisioned tenant.
   */
  async provisionTenant(tenantId: string, adminEmail?: string, adminName?: string): Promise<string> {
    // 1. Register in control plane
    const entry = await this.registry.registerTenant(tenantId);
    const schemaName = entry.schemaName;

    try {
      // 2. Create PostgreSQL schema
      await this.controlPrisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);
      console.log(`[TenantProvisioner] Created schema "${schemaName}" for tenant "${tenantId}".`);

      // 3. Run DDL migrations inside the new schema
      await this.runMigrations(schemaName);
      console.log(`[TenantProvisioner] Migrations complete for schema "${schemaName}".`);

      // 4. Seed default data
      await this.seedDefaults(schemaName, tenantId, adminEmail, adminName);
      console.log(`[TenantProvisioner] Default data seeded in schema "${schemaName}".`);

      // 5. Mark tenant as ACTIVE
      await this.registry.updateStatus(tenantId, 'ACTIVE');
      await this.registry.updateMigratedVersion(tenantId, '1');

      console.log(`[TenantProvisioner] Tenant "${tenantId}" is now ACTIVE.`);
      return schemaName;

    } catch (err: any) {
      console.error(`[TenantProvisioner] Failed to provision tenant "${tenantId}":`, err.message);
      // Attempt cleanup
      try {
        await this.controlPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
      } catch (cleanupErr: any) {
        console.error(`[TenantProvisioner] Cleanup failed for "${schemaName}":`, cleanupErr.message);
      }
      await this.registry.updateStatus(tenantId, 'DEPROVISIONED');
      throw err;
    }
  }

  /**
   * Deprovision a tenant: drop schema, mark as deprovisioned.
   */
  async deprovisionTenant(tenantId: string): Promise<void> {
    const entry = await this.registry.lookupTenant(tenantId);
    if (!entry) {
      throw new Error(`Tenant "${tenantId}" not found in registry.`);
    }

    const schemaName = entry.schemaName;

    // Drop the schema and all its objects
    await this.controlPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
    console.log(`[TenantProvisioner] Dropped schema "${schemaName}".`);

    // Mark as deprovisioned
    await this.registry.deprovisionTenant(tenantId);
    console.log(`[TenantProvisioner] Tenant "${tenantId}" deprovisioned.`);
  }

  // ──────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────

  /**
   * Run core DDL migrations inside a tenant schema.
   * This replicates the key tables from the main Prisma schema
   * into the tenant's isolated schema.
   */
  private async runMigrations(schemaName: string): Promise<void> {
    // Set search path to the tenant schema for this session
    await this.controlPrisma.$executeRawUnsafe(`SET search_path TO "${schemaName}";`);

    try {
      // Core inventory tables
      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".inventory_items (
          id TEXT PRIMARY KEY,
          sku TEXT NOT NULL,
          "location_id" TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          allocated INTEGER NOT NULL DEFAULT 0,
          in_transit INTEGER NOT NULL DEFAULT 0,
          version INTEGER NOT NULL,
          UNIQUE(sku, "location_id")
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".products (
          id UUID PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".product_variants (
          id UUID PRIMARY KEY,
          product_id UUID NOT NULL REFERENCES "${schemaName}".products(id) ON DELETE CASCADE,
          sku TEXT NOT NULL UNIQUE,
          tracking_mode TEXT NOT NULL DEFAULT 'quantity',
          costing_method TEXT NOT NULL DEFAULT 'fifo',
          weight_grams INTEGER,
          volume_cubic_meters DOUBLE PRECISION,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".ledger_entries (
          id UUID NOT NULL,
          tenant_id TEXT NOT NULL,
          location_id TEXT NOT NULL,
          variant_id UUID NOT NULL,
          quantity INTEGER NOT NULL,
          reason TEXT NOT NULL,
          actor_id TEXT NOT NULL,
          occurred_at TIMESTAMPTZ NOT NULL,
          reference_id TEXT,
          metadata JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (id, occurred_at)
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".serialized_items (
          id UUID PRIMARY KEY,
          variant_id UUID NOT NULL,
          serial_number TEXT NOT NULL,
          tenant_id TEXT NOT NULL,
          location_id TEXT NOT NULL,
          status TEXT NOT NULL,
          UNIQUE(tenant_id, serial_number)
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".journal_entries (
          id UUID PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          date TIMESTAMPTZ NOT NULL,
          description TEXT NOT NULL,
          method TEXT NOT NULL,
          reference_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".journal_lines (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entry_id UUID NOT NULL REFERENCES "${schemaName}".journal_entries(id) ON DELETE CASCADE,
          account_code TEXT NOT NULL,
          amount_cents INTEGER NOT NULL,
          type TEXT NOT NULL,
          memo TEXT
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".warehouse_locations (
          id TEXT PRIMARY KEY,
          warehouse_id TEXT NOT NULL,
          zone TEXT NOT NULL,
          aisle TEXT NOT NULL,
          rack TEXT NOT NULL,
          shelf TEXT NOT NULL,
          bin TEXT NOT NULL,
          max_weight_grams INTEGER NOT NULL,
          max_volume_cubic_meters DOUBLE PRECISION NOT NULL,
          grid_x INTEGER NOT NULL DEFAULT 0,
          grid_y INTEGER NOT NULL DEFAULT 0,
          width INTEGER NOT NULL DEFAULT 1,
          height INTEGER NOT NULL DEFAULT 1,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(warehouse_id, zone, aisle, rack, shelf, bin)
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".kits (
          id UUID PRIMARY KEY,
          sku TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".kit_components (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          kit_id UUID NOT NULL REFERENCES "${schemaName}".kits(id) ON DELETE CASCADE,
          variant_id UUID NOT NULL,
          quantity INTEGER NOT NULL,
          UNIQUE(kit_id, variant_id)
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".outbox_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Pending',
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          processed_at TIMESTAMPTZ,
          next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".tenant_accounting_configs (
          tenant_id TEXT PRIMARY KEY,
          accounting_method TEXT NOT NULL DEFAULT 'accrual',
          costing_method TEXT NOT NULL DEFAULT 'fifo'
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".notifications (
          id UUID PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'info',
          is_read BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".replenishment_rules (
          id UUID PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          sku TEXT NOT NULL,
          location_id TEXT NOT NULL,
          reorder_point INTEGER NOT NULL,
          reorder_quantity INTEGER NOT NULL,
          safety_stock INTEGER NOT NULL,
          lead_time_days INTEGER NOT NULL,
          replenishment_type TEXT NOT NULL,
          source_location_id TEXT,
          supplier_id TEXT,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          dynamic_rop_enabled BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(tenant_id, sku, location_id)
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".purchase_orders (
          id UUID PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          supplier_id TEXT NOT NULL,
          destination_location_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'DRAFT',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await this.controlPrisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".purchase_order_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          purchase_order_id UUID NOT NULL REFERENCES "${schemaName}".purchase_orders(id) ON DELETE CASCADE,
          variant_id UUID NOT NULL,
          quantity INTEGER NOT NULL,
          UNIQUE(purchase_order_id, variant_id)
        );
      `);

    } finally {
      // Reset search path to public
      await this.controlPrisma.$executeRawUnsafe(`SET search_path TO "public";`);
    }
  }

  /**
   * Seed default data (roles, default accounting config) into the tenant schema.
   */
  private async seedDefaults(
    schemaName: string,
    tenantId: string,
    adminEmail?: string,
    adminName?: string
  ): Promise<void> {
    // Seed default accounting config
    await this.controlPrisma.$executeRawUnsafe(`
      INSERT INTO "${schemaName}".tenant_accounting_configs (tenant_id, accounting_method, costing_method)
      VALUES ('${tenantId}', 'accrual', 'fifo')
      ON CONFLICT (tenant_id) DO NOTHING;
    `);
  }
}
