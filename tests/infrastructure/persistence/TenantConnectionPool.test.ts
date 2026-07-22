import { TenantConnectionPool } from '../../../src/infrastructure/persistence/TenantConnectionPool';
import { TenantRegistry } from '../../../src/infrastructure/persistence/TenantRegistry';

describe('TenantConnectionPool', () => {
  let mockRegistry: jest.Mocked<TenantRegistry>;
  let pool: TenantConnectionPool;

  beforeEach(() => {
    mockRegistry = {
      lookupTenant: jest.fn(),
      listTenants: jest.fn().mockResolvedValue([]),
      registerTenant: jest.fn(),
      updateStatus: jest.fn(),
      updateMigratedVersion: jest.fn(),
      deprovisionTenant: jest.fn(),
    } as any;

    // Use small pool for testing with long idle to avoid eviction during tests
    pool = new TenantConnectionPool(mockRegistry, 3, 60000, 60000);
  });

  afterEach(async () => {
    await pool.shutdown();
  });

  describe('getClient', () => {
    it('should throw if tenant not found in registry', async () => {
      mockRegistry.lookupTenant.mockResolvedValue(null);

      await expect(pool.getClient('nonexistent'))
        .rejects.toThrow('not found in registry');
    });

    it('should throw if tenant is not ACTIVE', async () => {
      mockRegistry.lookupTenant.mockResolvedValue({
        tenantId: 'provisioning-tenant',
        dbUser: 'user',
        dbPassword: 'password',
        dbHost: '127.0.0.1',
        dbPort: 5432,
        dbName: 'inventory_db',
        dbUser: 'user',
        dbPassword: 'password',
        status: 'PROVISIONING',
        provisionedAt: new Date(),
        migratedVersion: '1',
      });

      await expect(pool.getClient('provisioning-tenant'))
        .rejects.toThrow('not active');
    });
  });

  describe('has', () => {
    it('should return false for uncached tenants', () => {
      expect(pool.has('uncached')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return empty stats initially', () => {
      const stats = pool.getStats();
      expect(stats.size).toBe(0);
      expect(stats.maxSize).toBe(3);
      expect(stats.tenantIds).toEqual([]);
    });
  });

  describe('warmPool', () => {
    it('should call listTenants with ACTIVE status', async () => {
      mockRegistry.listTenants.mockResolvedValue([]);

      const warmed = await pool.warmPool();

      expect(warmed).toBe(0);
      expect(mockRegistry.listTenants).toHaveBeenCalledWith('ACTIVE');
    });
  });

  describe('evict', () => {
    it('should be a no-op for uncached tenants', async () => {
      // Should not throw
      await pool.evict('nonexistent');
      expect(pool.has('nonexistent')).toBe(false);
    });
  });

  describe('shutdown', () => {
    it('should clear all connections', async () => {
      await pool.shutdown();
      const stats = pool.getStats();
      expect(stats.size).toBe(0);
    });
  });
});
