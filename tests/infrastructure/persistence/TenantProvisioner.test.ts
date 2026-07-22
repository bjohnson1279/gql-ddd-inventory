import { TenantProvisioner } from '../../../src/infrastructure/persistence/TenantProvisioner';
import { TenantRegistry } from '../../../src/infrastructure/persistence/TenantRegistry';

describe('TenantProvisioner', () => {
  let mockPrisma: any;
  let mockRegistry: jest.Mocked<TenantRegistry>;
  let provisioner: TenantProvisioner;

  beforeEach(() => {
    mockPrisma = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };

    mockRegistry = {
      registerTenant: jest.fn().mockResolvedValue({
        tenantId: 'new-tenant',
        schemaName: 'tenant_new_tenant',
        dbHost: '127.0.0.1',
        dbPort: 5432,
        dbName: 'inventory_db',
        status: 'PROVISIONING',
        provisionedAt: new Date(),
        migratedVersion: '0',
      }),
      lookupTenant: jest.fn(),
      listTenants: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      updateMigratedVersion: jest.fn().mockResolvedValue(undefined),
      deprovisionTenant: jest.fn().mockResolvedValue(undefined),
    } as any;

    provisioner = new TenantProvisioner(mockPrisma, mockRegistry);
  });

  describe('provisionTenant', () => {
    it('should register tenant, create schema, run migrations, seed defaults, and activate', async () => {
      const schemaName = await provisioner.provisionTenant('new-tenant');

      expect(schemaName).toBe('tenant_new_tenant');

      // Should register with registry
      expect(mockRegistry.registerTenant).toHaveBeenCalledWith('new-tenant');

      // Should create schema
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('CREATE SCHEMA IF NOT EXISTS "tenant_new_tenant"')
      );

      // Should set search path for migrations
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('SET search_path TO "tenant_new_tenant"')
      );

      // Should create core tables (spot-check a few)
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('inventory_items')
      );
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('products')
      );
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('ledger_entries')
      );
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('journal_entries')
      );
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('warehouse_locations')
      );

      // Should reset search path back to public
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('SET search_path TO "public"')
      );

      // Should seed default accounting config
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('tenant_accounting_configs')
      );

      // Should mark as ACTIVE
      expect(mockRegistry.updateStatus).toHaveBeenCalledWith('new-tenant', 'ACTIVE');
      expect(mockRegistry.updateMigratedVersion).toHaveBeenCalledWith('new-tenant', '1');
    });

    it('should clean up schema on migration failure', async () => {
      // Make the third $executeRawUnsafe call fail (after CREATE SCHEMA and SET search_path)
      let callCount = 0;
      mockPrisma.$executeRawUnsafe.mockImplementation(async (sql: string) => {
        callCount++;
        if (callCount === 3) {
          throw new Error('Migration failed');
        }
      });

      await expect(provisioner.provisionTenant('failing-tenant'))
        .rejects.toThrow('Migration failed');

      // Should attempt to drop the schema
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('DROP SCHEMA IF EXISTS "tenant_new_tenant" CASCADE')
      );

      // Should mark as DEPROVISIONED
      expect(mockRegistry.updateStatus).toHaveBeenCalledWith('new-tenant', 'DEPROVISIONED');
    });
  });

  describe('deprovisionTenant', () => {
    it('should drop schema and mark as deprovisioned', async () => {
      mockRegistry.lookupTenant.mockResolvedValue({
        tenantId: 'old-tenant',
        schemaName: 'tenant_old_tenant',
        dbHost: '127.0.0.1',
        dbPort: 5432,
        dbName: 'inventory_db',
        status: 'ACTIVE',
        provisionedAt: new Date(),
        migratedVersion: '1',
      });

      await provisioner.deprovisionTenant('old-tenant');

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('DROP SCHEMA IF EXISTS "tenant_old_tenant" CASCADE')
      );
      expect(mockRegistry.deprovisionTenant).toHaveBeenCalledWith('old-tenant');
    });

    it('should throw if tenant not found', async () => {
      mockRegistry.lookupTenant.mockResolvedValue(null);

      await expect(provisioner.deprovisionTenant('nonexistent'))
        .rejects.toThrow('not found');
    });
  });
});
