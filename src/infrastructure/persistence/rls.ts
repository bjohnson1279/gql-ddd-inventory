import { PrismaClient, Prisma } from "@prisma/client";

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
  const ALLOWED_TABLES = new Set(rlsTables);

  for (const table of rlsTables) {
    try {
      if (!ALLOWED_TABLES.has(table) || !/^[a-zA-Z0-9_]+$/.test(table)) {
        throw new Error(`Invalid table name: ${table}`);
      }

      // 1. Enable RLS
      await prisma.$executeRaw`ALTER TABLE ${Prisma.raw(`"${table}"`)} ENABLE ROW LEVEL SECURITY;`;
      // 2. Force RLS for table owners (Prisma connections)
      await prisma.$executeRaw`ALTER TABLE ${Prisma.raw(`"${table}"`)} FORCE ROW LEVEL SECURITY;`;
      // 3. Drop existing policy if it exists
      await prisma.$executeRaw`DROP POLICY IF EXISTS tenant_isolation ON ${Prisma.raw(`"${table}"`)};`;
      // 4. Create policy to filter by current tenant ID
      await prisma.$executeRaw`
        CREATE POLICY tenant_isolation ON ${Prisma.raw(`"${table}"`)}
        USING ("tenant_id" = current_setting('app.current_tenant_id', true));
      `;
    } catch (err: any) {
      console.warn(`[RLS Setup Warning] Could not enable RLS on table "${table}":`, err.message);
    }
  }
}
