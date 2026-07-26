import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { TenantRegistry } from './TenantRegistry';

/**
 * TenantProvisioner handles the lifecycle of creating and tearing down
 * isolated PostgreSQL databases for tenants.
 *
 * With the "separate databases" strategy:
 *   1. Registry registers the tenant (status: PROVISIONING)
 *   2. Provisioner creates a new PostgreSQL database via the control connection
 *   3. Provisioner connects to the new database and runs DDL migrations
 *   4. Provisioner seeds default data
 *   5. Registry updates status to ACTIVE
 *
 * NOTE: PostgreSQL requires CREATE/DROP DATABASE to run outside a transaction,
 * so we use a raw `pg` Pool connection for those operations rather than Prisma.
 */
export class TenantProvisioner {
  constructor(
    private readonly controlPrisma: PrismaClient,
    private readonly registry: TenantRegistry
  ) {}

  /**
   * Provision a new tenant: create database, run migrations, seed data.
   * Returns the database name for the newly provisioned tenant.
   */
  async provisionTenant(tenantId: string, adminEmail?: string, adminName?: string): Promise<string> {
    // 1. Register in control plane
    const entry = await this.registry.registerTenant(tenantId);
    const dbName = entry.dbName;

    try {
      // 2. Create the tenant's dedicated PostgreSQL database
      //    CREATE DATABASE cannot run inside a transaction, so we use
      //    a raw pg client on the control database.
      await this.createDatabase(dbName);
      console.log(`[TenantProvisioner] Created database "${dbName}" for tenant "${tenantId}".`);

      // 3. Connect to the new database and run DDL migrations
      await this.runMigrationsOnTenantDb(entry);
      console.log(`[TenantProvisioner] Migrations complete for database "${dbName}".`);

      // 4. Seed default data
      await this.seedDefaultsOnTenantDb(entry, tenantId);
      console.log(`[TenantProvisioner] Default data seeded in database "${dbName}".`);

      // 5. Mark tenant as ACTIVE
      await this.registry.updateStatus(tenantId, 'ACTIVE');
      await this.registry.updateMigratedVersion(tenantId, '1');

      console.log(`[TenantProvisioner] Tenant "${tenantId}" is now ACTIVE.`);
      return dbName;

    } catch (err: any) {
      console.error(`[TenantProvisioner] Failed to provision tenant "${tenantId}":`, err.message);
      // Attempt cleanup — drop the database if it was created
      try {
        await this.dropDatabase(dbName);
      } catch (cleanupErr: any) {
        console.error(`[TenantProvisioner] Cleanup failed for "${dbName}":`, cleanupErr.message);
      }
      await this.registry.updateStatus(tenantId, 'DEPROVISIONED');
      throw err;
    }
  }

  /**
   * Deprovision a tenant: drop database, mark as deprovisioned.
   */
  async deprovisionTenant(tenantId: string): Promise<void> {
    const entry = await this.registry.lookupTenant(tenantId);
    if (!entry) {
      throw new Error(`Tenant "${tenantId}" not found in registry.`);
    }

    // Force-disconnect any remaining connections to the tenant database
    try {
      await this.controlPrisma.$executeRawUnsafe(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '${entry.dbName}'
          AND pid <> pg_backend_pid();
      `);
    } catch (err: any) {
      // Non-fatal — tenant DB may already be disconnected
      console.log(`[TenantProvisioner] Could not terminate connections to "${entry.dbName}":`, err.message);
    }

    await this.dropDatabase(entry.dbName);
    console.log(`[TenantProvisioner] Dropped database "${entry.dbName}".`);

    await this.registry.deprovisionTenant(tenantId);
    console.log(`[TenantProvisioner] Tenant "${tenantId}" deprovisioned.`);
  }

  // ──────────────────────────────────────────────
  // Database lifecycle (raw pg — outside transactions)
  // ──────────────────────────────────────────────

  /**
   * Create a new PostgreSQL database.
   * Uses a raw pg Pool because CREATE DATABASE cannot run inside a transaction.
   */
  private async createDatabase(dbName: string): Promise<void> {
    const controlPool = this.getControlPool();
    const client = await controlPool.connect();
    try {
      // Check if database already exists
      const result = await client.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]
      );
      if (result.rows.length === 0) {
        await client.query(`CREATE DATABASE "${dbName}"`);
      }
    } finally {
      client.release();
      await controlPool.end();
    }
  }

  /**
   * Drop a PostgreSQL database.
   */
  private async dropDatabase(dbName: string): Promise<void> {
    const controlPool = this.getControlPool();
    const client = await controlPool.connect();
    try {
      await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    } finally {
      client.release();
      await controlPool.end();
    }
  }

  /**
   * Get a raw pg Pool to the control database for DDL operations
   * that can't run inside Prisma transactions.
   */
  private getControlPool(): Pool {
    const connectionString = process.env.DATABASE_URL ||
      `postgresql://${process.env.DB_USER || 'inventory_user'}:${process.env.DB_PASSWORD || 'inventory_password'}@${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || '5433'}/${process.env.DB_NAME || 'inventory_db'}`;
    return new Pool({ connectionString, max: 2 });
  }

  /**
   * Get a raw pg Pool connected to a specific tenant database.
   */
  private getTenantPool(entry: { dbHost: string; dbPort: number; dbName: string; dbUser: string; dbPassword: string }): Pool {
    const connectionString = `postgresql://${entry.dbUser}:${entry.dbPassword}@${entry.dbHost}:${entry.dbPort}/${entry.dbName}`;
    return new Pool({ connectionString, max: 2 });
  }

  // ──────────────────────────────────────────────
  // DDL Migrations (run on tenant database)
  // ──────────────────────────────────────────────

  /**
   * Connect to the tenant's dedicated database and run DDL migrations.
   */
  private async runMigrationsOnTenantDb(entry: { dbHost: string; dbPort: number; dbName: string; dbUser: string; dbPassword: string }): Promise<void> {
    const tenantPool = this.getTenantPool(entry);
    const client = await tenantPool.connect();

    try {
      // Core inventory tables — no schema prefix needed since each tenant
      // has their own database and we use the default `public` schema.

      await client.query(`
        CREATE TABLE IF NOT EXISTS inventory_items (
          id TEXT PRIMARY KEY,
          sku TEXT NOT NULL,
          "location_id" TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          allocated INTEGER NOT NULL DEFAULT 0,
          in_transit INTEGER NOT NULL DEFAULT 0,
          version INTEGER NOT NULL,
          UNIQUE(sku, "location_id")
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS products (
          id UUID PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS product_variants (
          id UUID PRIMARY KEY,
          product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          sku TEXT NOT NULL UNIQUE,
          tracking_mode TEXT NOT NULL DEFAULT 'quantity',
          costing_method TEXT NOT NULL DEFAULT 'fifo',
          weight_grams INTEGER,
          volume_cubic_meters DOUBLE PRECISION,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS variant_attributes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          value TEXT NOT NULL,
          UNIQUE(variant_id, name)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS ledger_entries (
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
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS inventory_cost_layers (
          id UUID PRIMARY KEY,
          variant_id UUID NOT NULL,
          initial_quantity INTEGER NOT NULL,
          consumed_quantity INTEGER NOT NULL DEFAULT 0,
          unit_cost_cents INTEGER NOT NULL,
          received_at TIMESTAMPTZ NOT NULL,
          serial_number TEXT,
          lot_number TEXT,
          expiration_date TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_cost_layers_variant_received ON inventory_cost_layers(variant_id, received_at)
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS serialized_items (
          id UUID PRIMARY KEY,
          variant_id UUID NOT NULL,
          serial_number TEXT NOT NULL,
          tenant_id TEXT NOT NULL,
          location_id TEXT NOT NULL,
          status TEXT NOT NULL,
          UNIQUE(tenant_id, serial_number)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS serialized_item_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          item_id UUID NOT NULL REFERENCES serialized_items(id) ON DELETE CASCADE,
          from_status TEXT NOT NULL,
          to_status TEXT NOT NULL,
          reason TEXT,
          actor_id TEXT NOT NULL,
          occurred_at TIMESTAMPTZ NOT NULL,
          reference_id TEXT
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS barcodes (
          id UUID PRIMARY KEY,
          variant_id UUID NOT NULL,
          value TEXT NOT NULL,
          symbology TEXT NOT NULL,
          source TEXT NOT NULL,
          is_primary BOOLEAN DEFAULT FALSE,
          assigned_at TIMESTAMPTZ NOT NULL,
          UNIQUE(variant_id, value)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS journal_entries (
          id UUID PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          date TIMESTAMPTZ NOT NULL,
          description TEXT NOT NULL,
          method TEXT NOT NULL,
          reference_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS journal_lines (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
          account_code TEXT NOT NULL,
          amount_cents INTEGER NOT NULL,
          type TEXT NOT NULL,
          memo TEXT
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS kits (
          id UUID PRIMARY KEY,
          sku TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS kit_components (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          kit_id UUID NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
          variant_id UUID NOT NULL,
          quantity INTEGER NOT NULL,
          UNIQUE(kit_id, variant_id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS warehouse_locations (
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
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS stock_transfers (
          id UUID PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          source_location_id TEXT NOT NULL,
          destination_location_id TEXT NOT NULL,
          status TEXT NOT NULL,
          reference_id TEXT,
          dispatched_at TIMESTAMPTZ,
          received_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS stock_transfer_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
          variant_id UUID NOT NULL,
          quantity INTEGER NOT NULL,
          UNIQUE(transfer_id, variant_id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS replenishment_rules (
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
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS purchase_orders (
          id UUID PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          supplier_id TEXT NOT NULL,
          destination_location_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'DRAFT',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS purchase_order_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
          variant_id UUID NOT NULL,
          quantity INTEGER NOT NULL,
          UNIQUE(purchase_order_id, variant_id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS outbox_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Pending',
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          processed_at TIMESTAMPTZ,
          next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS tenant_accounting_configs (
          tenant_id TEXT PRIMARY KEY,
          accounting_method TEXT NOT NULL DEFAULT 'accrual',
          costing_method TEXT NOT NULL DEFAULT 'fifo'
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'info',
          is_read BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS demand_forecasts (
          id UUID PRIMARY KEY,
          sku TEXT NOT NULL,
          location_id TEXT NOT NULL,
          forecasted_quantity INTEGER NOT NULL,
          period_start TIMESTAMPTZ NOT NULL,
          period_end TIMESTAMPTZ NOT NULL,
          confidence_level DOUBLE PRECISION NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(sku, location_id, period_start, period_end)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS rmas (
          id UUID PRIMARY KEY,
          rma_number TEXT NOT NULL UNIQUE,
          tenant_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          location_id TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS rma_items (
          id UUID PRIMARY KEY,
          rma_id UUID NOT NULL REFERENCES rmas(id) ON DELETE CASCADE,
          variant_id UUID NOT NULL,
          quantity INTEGER NOT NULL,
          received_quantity INTEGER NOT NULL DEFAULT 0,
          unit_cost_cents INTEGER NOT NULL,
          status TEXT NOT NULL,
          disposition TEXT
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS quarantine_items (
          id UUID PRIMARY KEY,
          variant_id UUID NOT NULL,
          quantity INTEGER NOT NULL,
          reason TEXT NOT NULL,
          status TEXT NOT NULL,
          location_id TEXT NOT NULL,
          tenant_id TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          resolved_at TIMESTAMPTZ
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS webhook_subscriptions (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          tenant_id TEXT NOT NULL,
          target_url TEXT NOT NULL,
          secret TEXT NOT NULL,
          event_types TEXT[] NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS webhook_deliveries (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          tenant_id TEXT NOT NULL,
          subscription_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Pending',
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          processed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS "ComplianceLedgerModel" (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          "sequenceNumber" INTEGER NOT NULL UNIQUE,
          "tenantId" TEXT NOT NULL,
          "eventType" TEXT NOT NULL,
          payload TEXT NOT NULL,
          timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "previousHash" TEXT NOT NULL,
          hash TEXT NOT NULL,
          signature TEXT NOT NULL
        )
      `);

    } finally {
      client.release();
      await tenantPool.end();
    }
  }

  // ──────────────────────────────────────────────
  // Seed data (run on tenant database)
  // ──────────────────────────────────────────────

  /**
   * Seed default data into the tenant database.
   */
  private async seedDefaultsOnTenantDb(
    entry: { dbHost: string; dbPort: number; dbName: string; dbUser: string; dbPassword: string },
    tenantId: string
  ): Promise<void> {
    const tenantPool = this.getTenantPool(entry);
    const client = await tenantPool.connect();

    try {
      await client.query(`
        INSERT INTO tenant_accounting_configs (tenant_id, accounting_method, costing_method)
        VALUES ($1, 'accrual', 'fifo')
        ON CONFLICT (tenant_id) DO NOTHING
      `, [tenantId]);
    } finally {
      client.release();
      await tenantPool.end();
    }
  }
}
