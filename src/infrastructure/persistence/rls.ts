import { PrismaClient } from "@prisma/client";

export const rlsTables = [
  "ledger_entries",
  "serialized_items",
  "integration_connections",
  "external_mappings",
  "journal_entries",
  "stock_onboardings",
  "notifications",
  "audit_discrepancies",
  "purchase_orders",
  "inventory_audits",
  "rmas",
  "quarantine_items",
  "users",
  "api_tokens",
  "tenant_accounting_configs",
];

export async function enableRowLevelSecurity(prisma: PrismaClient): Promise<void> {
  console.log("Setting up PostgreSQL Row-Level Security (RLS) policies for GraphQL backend...");

  const ALLOWED_TABLES = new Set(rlsTables);

  for (const table of rlsTables) {
    try {
      if (!ALLOWED_TABLES.has(table) || !/^[a-z_]+$/i.test(table)) {
        throw new Error(`Invalid table name: ${table}`);
      }

      // 1. Enable RLS
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      // 2. Force RLS for table owners (Prisma connections)
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
      // 3. Drop existing policy if it exists
      await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS tenant_isolation ON "${table}";`);
      // 4. Create policy to filter by current tenant ID
      await prisma.$executeRawUnsafe(`
        CREATE POLICY tenant_isolation ON "${table}"
        USING ("tenant_id" = current_setting('app.current_tenant_id', true));
      `);
      console.log(`Successfully enabled RLS on table "${table}".`);
    } catch (err: any) {
      console.log(`[RLS Setup Warning] Could not enable RLS on table "${table}":`, err.message);
    }
  }
}
