CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Initial Schema for Inventory System

-- 1. Products and Variants
CREATE TABLE products (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_variants (
    id UUID PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT UNIQUE NOT NULL,
    tracking_mode TEXT NOT NULL DEFAULT 'quantity', -- quantity, serial, lot
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE variant_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    UNIQUE(variant_id, name)
);

-- 2. Ledger and Stock
CREATE TABLE ledger_entries (
    id UUID NOT NULL,
    tenant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    variant_id UUID REFERENCES product_variants(id),
    quantity INTEGER NOT NULL, -- signed
    reason TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reference_id TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, occurred_at)
);

SELECT create_hypertable('ledger_entries', 'occurred_at', if_not_exists => TRUE);

CREATE INDEX idx_ledger_variant_location ON ledger_entries(variant_id, location_id);

-- 2.1 TimescaleDB Continuous Aggregate for Stock Velocity
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_stock_velocity
WITH (timescaledb.continuous) AS
SELECT 
  time_bucket('1 day', occurred_at) AS bucket,
  tenant_id,
  variant_id,
  COALESCE(SUM(CASE WHEN quantity < 0 THEN abs(quantity) ELSE 0 END), 0) AS units_dispatched,
  COALESCE(SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END), 0) AS units_received,
  COUNT(*) as transaction_count
FROM ledger_entries
GROUP BY bucket, tenant_id, variant_id;

-- Enable Row-Level Security on the materialized view
ALTER MATERIALIZED VIEW daily_stock_velocity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON daily_stock_velocity;
CREATE POLICY tenant_isolation ON daily_stock_velocity USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Add continuous aggregate policy to update the view automatically in background
SELECT add_continuous_aggregate_policy('daily_stock_velocity',
  start_offset => INTERVAL '1 month',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE);

CREATE TABLE inventory_cost_layers (
    id UUID PRIMARY KEY,
    variant_id UUID REFERENCES product_variants(id),
    initial_quantity INTEGER NOT NULL,
    consumed_quantity INTEGER NOT NULL DEFAULT 0,
    unit_cost_cents INTEGER NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    serial_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Serialized Inventory
CREATE TABLE serialized_items (
    id UUID PRIMARY KEY,
    variant_id UUID REFERENCES product_variants(id),
    serial_number TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    status TEXT NOT NULL, -- pending, in_stock, sold, etc.
    UNIQUE(tenant_id, serial_number)
);

CREATE TABLE serialized_item_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES serialized_items(id) ON DELETE CASCADE,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    reason TEXT,
    actor_id TEXT NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reference_id TEXT
);

-- 4. Barcodes
CREATE TABLE barcodes (
    id UUID PRIMARY KEY,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    symbology TEXT NOT NULL,
    source TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(variant_id, value)
);

-- 5. Integrations
CREATE TABLE integration_connections (
    id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    platform TEXT NOT NULL, -- shopify
    store_domain TEXT NOT NULL,
    access_token TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE external_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    integration_id UUID REFERENCES integration_connections(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL, -- product, variant, location
    internal_id TEXT NOT NULL, -- Can be UUID from our tables
    external_id TEXT NOT NULL, -- Shopify GID
    external_secondary_id TEXT, -- e.g., InventoryItemId
    UNIQUE(integration_id, entity_type, internal_id),
    UNIQUE(integration_id, entity_type, external_id)
);

CREATE TABLE netsuite_journal_mappings (
    id UUID PRIMARY KEY,
    journal_entry_id UUID UNIQUE NOT NULL,
    netsuite_journal_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE xero_journal_mappings (
    id UUID PRIMARY KEY,
    journal_entry_id UUID UNIQUE NOT NULL,
    xero_journal_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quickbooks_journal_mappings (
    id UUID PRIMARY KEY,
    journal_entry_id UUID UNIQUE NOT NULL,
    quickbooks_journal_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

