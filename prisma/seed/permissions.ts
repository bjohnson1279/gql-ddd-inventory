/**
 * Permission Seed Script
 *
 * Seeds the canonical permission catalog and default role → permission mappings.
 * Run via: npx ts-node prisma/seed/permissions.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Canonical Permission Catalog ─────────────────────────────────────────────

interface PermissionDef {
  id: string;
  resource: string;
  action: string;
  description: string;
}

const PERMISSIONS: PermissionDef[] = [
  // Inventory
  { id: 'inventory:view',      resource: 'inventory', action: 'view',      description: 'View inventory items and stock levels' },
  { id: 'inventory:receive',   resource: 'inventory', action: 'receive',   description: 'Receive stock into locations' },
  { id: 'inventory:dispatch',  resource: 'inventory', action: 'dispatch',  description: 'Dispatch stock from locations' },
  { id: 'inventory:allocate',  resource: 'inventory', action: 'allocate',  description: 'Allocate, release, and fulfill stock reservations' },
  { id: 'inventory:transfer',  resource: 'inventory', action: 'transfer',  description: 'Create and manage inter-location stock transfers' },
  { id: 'inventory:adjust',    resource: 'inventory', action: 'adjust',    description: 'Submit stock adjustments and opening balances' },
  { id: 'inventory:count',     resource: 'inventory', action: 'count',     description: 'Submit physical inventory counts' },

  // Purchase Orders
  { id: 'purchase_order:view',    resource: 'purchase_order', action: 'view',    description: 'View purchase orders' },
  { id: 'purchase_order:create',  resource: 'purchase_order', action: 'create',  description: 'Create new purchase orders' },
  { id: 'purchase_order:place',   resource: 'purchase_order', action: 'place',   description: 'Place (submit) purchase orders to suppliers' },
  { id: 'purchase_order:receive', resource: 'purchase_order', action: 'receive', description: 'Receive goods against purchase orders' },
  { id: 'purchase_order:cancel',  resource: 'purchase_order', action: 'cancel',  description: 'Cancel purchase orders' },
  { id: 'purchase_order:approve', resource: 'purchase_order', action: 'approve', description: 'Approve purchase orders in approval workflows' },

  // Products & Catalog
  { id: 'product:view',   resource: 'product', action: 'view',   description: 'View products and variants' },
  { id: 'product:create', resource: 'product', action: 'create', description: 'Create new products and variants' },
  { id: 'product:edit',   resource: 'product', action: 'edit',   description: 'Edit product details and attributes' },
  { id: 'product:delete', resource: 'product', action: 'delete', description: 'Delete products' },

  // Warehouse
  { id: 'warehouse:view',   resource: 'warehouse', action: 'view',   description: 'View warehouse locations and bin maps' },
  { id: 'warehouse:create', resource: 'warehouse', action: 'create', description: 'Create warehouse locations' },
  { id: 'warehouse:edit',   resource: 'warehouse', action: 'edit',   description: 'Edit warehouse location configurations' },
  { id: 'warehouse:delete', resource: 'warehouse', action: 'delete', description: 'Delete warehouse locations' },

  // Accounting & Finance
  { id: 'accounting:view',           resource: 'accounting', action: 'view',           description: 'View journal entries and valuations' },
  { id: 'accounting:create_journal', resource: 'accounting', action: 'create_journal', description: 'Create journal entries' },
  { id: 'accounting:sync_erp',      resource: 'accounting', action: 'sync_erp',      description: 'Sync journals to ERP systems (QB, NetSuite, Xero)' },
  { id: 'accounting:configure',     resource: 'accounting', action: 'configure',     description: 'Configure tenant accounting and costing methods' },

  // Compliance & Audit
  { id: 'compliance:view',        resource: 'compliance', action: 'view',        description: 'View compliance ledger entries' },
  { id: 'compliance:verify',      resource: 'compliance', action: 'verify',      description: 'Verify compliance ledger integrity' },
  { id: 'compliance:reconstruct', resource: 'compliance', action: 'reconstruct', description: 'Reconstruct historical state from audit trail' },

  // Serialized Items
  { id: 'serial:view',      resource: 'serial', action: 'view',      description: 'View serialized items and transitions' },
  { id: 'serial:receive',   resource: 'serial', action: 'receive',   description: 'Register and receive serialized items' },
  { id: 'serial:sell',      resource: 'serial', action: 'sell',      description: 'Sell serialized items' },
  { id: 'serial:return',    resource: 'serial', action: 'return',    description: 'Return serialized items' },
  { id: 'serial:write_off', resource: 'serial', action: 'write_off', description: 'Write off serialized items' },

  // Kits
  { id: 'kit:view',        resource: 'kit', action: 'view',        description: 'View kits and BOMs' },
  { id: 'kit:assemble',    resource: 'kit', action: 'assemble',    description: 'Assemble kits from components' },
  { id: 'kit:disassemble', resource: 'kit', action: 'disassemble', description: 'Disassemble kits back to components' },
  { id: 'kit:sell',        resource: 'kit', action: 'sell',        description: 'Sell assembled kits' },

  // RMA & Returns
  { id: 'rma:view',      resource: 'rma', action: 'view',      description: 'View RMA requests and quarantine items' },
  { id: 'rma:create',    resource: 'rma', action: 'create',    description: 'Create RMA requests' },
  { id: 'rma:authorize', resource: 'rma', action: 'authorize', description: 'Authorize RMA requests' },
  { id: 'rma:receive',   resource: 'rma', action: 'receive',   description: 'Receive returned items against RMAs' },
  { id: 'rma:resolve',   resource: 'rma', action: 'resolve',   description: 'Resolve quarantine items' },

  // Webhooks
  { id: 'webhook:view',   resource: 'webhook', action: 'view',   description: 'View webhook subscriptions and deliveries' },
  { id: 'webhook:create', resource: 'webhook', action: 'create', description: 'Create webhook subscriptions' },
  { id: 'webhook:edit',   resource: 'webhook', action: 'edit',   description: 'Edit webhook subscriptions' },
  { id: 'webhook:delete', resource: 'webhook', action: 'delete', description: 'Delete webhook subscriptions' },

  // User Management
  { id: 'user:view',       resource: 'user', action: 'view',       description: 'View users in the tenant' },
  { id: 'user:invite',     resource: 'user', action: 'invite',     description: 'Invite new users' },
  { id: 'user:edit_role',  resource: 'user', action: 'edit_role',  description: 'Assign and remove roles from users' },
  { id: 'user:deactivate', resource: 'user', action: 'deactivate', description: 'Deactivate user accounts' },

  // Reports
  { id: 'report:view',     resource: 'report', action: 'view',     description: 'View reports and dashboards' },
  { id: 'report:create',   resource: 'report', action: 'create',   description: 'Create saved report definitions' },
  { id: 'report:export',   resource: 'report', action: 'export',   description: 'Export reports to CSV/PDF/XLSX' },
  { id: 'report:schedule', resource: 'report', action: 'schedule', description: 'Schedule recurring report generation' },

  // Approvals
  { id: 'approval:view',     resource: 'approval', action: 'view',     description: 'View approval workflows and requests' },
  { id: 'approval:submit',   resource: 'approval', action: 'submit',   description: 'Submit items for approval' },
  { id: 'approval:approve',  resource: 'approval', action: 'approve',  description: 'Approve or reject approval requests' },
  { id: 'approval:configure', resource: 'approval', action: 'configure', description: 'Create and configure approval workflows' },
];

// ─── Default Role Definitions ─────────────────────────────────────────────────

interface RoleDef {
  id: string;
  name: string;
  description: string;
  permissionIds: string[];
}

const allPermissionIds = PERMISSIONS.map(p => p.id);
const viewPermissionIds = PERMISSIONS.filter(p => p.action === 'view').map(p => p.id);

const ROLES: RoleDef[] = [
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full access to all resources and actions across the tenant.',
    permissionIds: allPermissionIds,
  },
  {
    id: 'inventory_manager',
    name: 'Inventory Manager',
    description: 'Manages all inventory operations, procurement, warehouse, kits, serials, and returns.',
    permissionIds: [
      ...PERMISSIONS.filter(p => ['inventory', 'purchase_order', 'warehouse', 'kit', 'serial', 'rma', 'product'].includes(p.resource)).map(p => p.id),
      'report:view', 'report:export',
      'approval:view', 'approval:submit', 'approval:approve',
    ],
  },
  {
    id: 'warehouse_operator',
    name: 'Warehouse Operator',
    description: 'Performs day-to-day warehouse floor operations: receiving, dispatching, counting, and kit assembly.',
    permissionIds: [
      'inventory:view', 'inventory:receive', 'inventory:dispatch', 'inventory:allocate', 'inventory:transfer', 'inventory:count',
      'serial:view', 'serial:receive',
      'kit:view', 'kit:assemble', 'kit:disassemble',
      'warehouse:view',
      'product:view',
      'rma:view', 'rma:receive',
      'purchase_order:view', 'purchase_order:receive',
    ],
  },
  {
    id: 'finance_auditor',
    name: 'Finance Auditor',
    description: 'Read access to all financial data including accounting, compliance, and reports.',
    permissionIds: [
      ...PERMISSIONS.filter(p => ['accounting', 'compliance', 'report'].includes(p.resource)).map(p => p.id),
      'inventory:view',
      'purchase_order:view',
      'rma:view',
      'product:view',
      'approval:view',
    ],
  },
  {
    id: 'read_only',
    name: 'Read Only',
    description: 'View-only access to all resources. Cannot perform any mutations.',
    permissionIds: viewPermissionIds,
  },
];

// ─── Seed Execution ───────────────────────────────────────────────────────────

async function seed() {
  console.log('🔐 Seeding permissions catalog...');

  // Upsert all permissions
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { id: perm.id },
      update: { resource: perm.resource, action: perm.action, description: perm.description },
      create: perm,
    });
  }
  console.log(`   ✅ ${PERMISSIONS.length} permissions seeded.`);

  // Upsert all default roles
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: { name: role.name, description: role.description },
      create: { id: role.id, name: role.name, description: role.description, isCustom: false },
    });

    // Clear existing role-permission mappings and re-create
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: role.permissionIds.map(permId => ({
        roleId: role.id,
        permissionId: permId,
      })),
      skipDuplicates: true,
    });
  }
  console.log(`   ✅ ${ROLES.length} default roles seeded with permission mappings.`);

  console.log('🔐 Permission seed complete.');
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

export { PERMISSIONS, ROLES };
