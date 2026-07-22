-- Migration: Create tenant_registry table in the control (public) schema
-- This table serves as the control-plane metadata store that maps
-- tenant IDs to their isolated PostgreSQL schemas.
--
-- Part of Roadmap 6.1: Dynamic Multi-Database Tenant Provisioning

CREATE TABLE IF NOT EXISTS tenant_registry (
  tenant_id    TEXT PRIMARY KEY,
  schema_name  TEXT NOT NULL UNIQUE,
  db_host      TEXT NOT NULL DEFAULT '127.0.0.1',
  db_port      INTEGER NOT NULL DEFAULT 5432,
  db_name      TEXT NOT NULL DEFAULT 'inventory_db',
  status       TEXT NOT NULL DEFAULT 'PROVISIONING'
                CHECK (status IN ('PROVISIONING', 'ACTIVE', 'MIGRATING', 'DEPROVISIONED')),
  provisioned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  migrated_version TEXT NOT NULL DEFAULT '0'
);

-- Index for fast lookups by status (used by TenantConnectionPool.warmPool)
CREATE INDEX IF NOT EXISTS idx_tenant_registry_status ON tenant_registry (status);

-- Comment for documentation
COMMENT ON TABLE tenant_registry IS 'Control-plane registry mapping tenants to isolated PostgreSQL schemas. Part of the Dynamic Multi-Database Tenant Provisioning system (Roadmap 6.1).';
