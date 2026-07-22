import { TenantRegistry, TenantRegistryEntry } from '../../../src/infrastructure/persistence/TenantRegistry';

describe('TenantRegistry', () => {
  let mockPrisma: any;
  let registry: TenantRegistry;

  beforeEach(() => {
    mockPrisma = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };
    registry = new TenantRegistry(mockPrisma);
  });

  describe('registerTenant', () => {
    it('should register a new tenant with sanitized schema name', async () => {
      const entry = await registry.registerTenant('acme-corp');

      expect(entry.tenantId).toBe('acme-corp');
      expect(entry.schemaName).toBe('tenant_acme_corp');
      expect(entry.status).toBe('PROVISIONING');
      expect(entry.migratedVersion).toBe('0');
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO tenant_registry")
      );
    });

    it('should use default host/port/db from env when not provided', async () => {
      const entry = await registry.registerTenant('tenant-1');

      expect(entry.dbHost).toBeTruthy();
      expect(entry.dbPort).toBeGreaterThan(0);
      expect(entry.dbName).toBeTruthy();
    });

    it('should use custom host/port/db when provided', async () => {
      const entry = await registry.registerTenant('tenant-1', 'db.example.com', 5433, 'custom_db');

      expect(entry.dbHost).toBe('db.example.com');
      expect(entry.dbPort).toBe(5433);
      expect(entry.dbName).toBe('custom_db');
    });

    it('should throw if tenant already registered and active', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{
        tenant_id: 'acme-corp',
        schema_name: 'tenant_acme_corp',
        db_host: '127.0.0.1',
        db_port: 5432,
        db_name: 'inventory_db',
        status: 'ACTIVE',
        provisioned_at: new Date(),
        migrated_version: '1',
      }]);

      await expect(registry.registerTenant('acme-corp'))
        .rejects.toThrow('already registered');
    });

    it('should allow re-registration of deprovisioned tenants', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{
        tenant_id: 'old-tenant',
        schema_name: 'tenant_old_tenant',
        db_host: '127.0.0.1',
        db_port: 5432,
        db_name: 'inventory_db',
        status: 'DEPROVISIONED',
        provisioned_at: new Date(),
        migrated_version: '1',
      }]);

      const entry = await registry.registerTenant('old-tenant');
      expect(entry.status).toBe('PROVISIONING');
    });

    it('should sanitize special characters in tenant ID for schema name', async () => {
      const entry = await registry.registerTenant('tenant@2024!special');
      expect(entry.schemaName).toBe('tenant_tenant_2024_special');
    });
  });

  describe('lookupTenant', () => {
    it('should return null when tenant not found', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await registry.lookupTenant('nonexistent');
      expect(result).toBeNull();
    });

    it('should return the registry entry when found', async () => {
      const row = {
        tenant_id: 'acme-corp',
        schema_name: 'tenant_acme_corp',
        db_host: '127.0.0.1',
        db_port: 5432,
        db_name: 'inventory_db',
        status: 'ACTIVE',
        provisioned_at: new Date('2026-01-01'),
        migrated_version: '3',
      };
      mockPrisma.$queryRawUnsafe.mockResolvedValue([row]);

      const result = await registry.lookupTenant('acme-corp');

      expect(result).not.toBeNull();
      expect(result!.tenantId).toBe('acme-corp');
      expect(result!.schemaName).toBe('tenant_acme_corp');
      expect(result!.status).toBe('ACTIVE');
      expect(result!.migratedVersion).toBe('3');
    });
  });

  describe('listTenants', () => {
    it('should list all tenants when no status filter provided', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { tenant_id: 't1', schema_name: 's1', db_host: 'h', db_port: 5432, db_name: 'd', status: 'ACTIVE', provisioned_at: new Date(), migrated_version: '1' },
        { tenant_id: 't2', schema_name: 's2', db_host: 'h', db_port: 5432, db_name: 'd', status: 'DEPROVISIONED', provisioned_at: new Date(), migrated_version: '1' },
      ]);

      const tenants = await registry.listTenants();
      expect(tenants).toHaveLength(2);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.not.stringContaining("WHERE status")
      );
    });

    it('should filter by status when provided', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { tenant_id: 't1', schema_name: 's1', db_host: 'h', db_port: 5432, db_name: 'd', status: 'ACTIVE', provisioned_at: new Date(), migrated_version: '1' },
      ]);

      const tenants = await registry.listTenants('ACTIVE');
      expect(tenants).toHaveLength(1);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("WHERE status = 'ACTIVE'")
      );
    });
  });

  describe('updateStatus', () => {
    it('should execute update SQL', async () => {
      await registry.updateStatus('acme-corp', 'ACTIVE');

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE tenant_registry SET status = 'ACTIVE'")
      );
    });
  });

  describe('deprovisionTenant', () => {
    it('should mark tenant as DEPROVISIONED', async () => {
      await registry.deprovisionTenant('acme-corp');

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("DEPROVISIONED")
      );
    });
  });
});
