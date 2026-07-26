import { TenantProvisioner } from '../../../src/infrastructure/persistence/TenantProvisioner';
import { TenantRegistry } from '../../../src/infrastructure/persistence/TenantRegistry';

// Mock the pg Pool module since TenantProvisioner uses raw pg for CREATE/DROP DATABASE
jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  };
  const MockPool = jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(mockClient),
    end: jest.fn().mockResolvedValue(undefined),
    _mockClient: mockClient,
  }));
  return { Pool: MockPool };
});

describe('TenantProvisioner', () => {
  let mockPrisma: any;
  let mockRegistry: jest.Mocked<TenantRegistry>;
  let provisioner: TenantProvisioner;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };

    mockRegistry = {
      registerTenant: jest.fn().mockResolvedValue({
        tenantId: 'new-tenant',
        dbHost: '127.0.0.1',
        dbPort: 5433,
        dbName: 'inventory_tenant_new_tenant',
        dbUser: 'inventory_user',
        dbPassword: 'inventory_password',
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
    it('should register tenant, create database, run migrations, seed defaults, and activate', async () => {
      const dbName = await provisioner.provisionTenant('new-tenant');

      expect(dbName).toBe('inventory_tenant_new_tenant');

      // Should register with registry
      expect(mockRegistry.registerTenant).toHaveBeenCalledWith('new-tenant');

      // Should mark as ACTIVE after successful provisioning
      expect(mockRegistry.updateStatus).toHaveBeenCalledWith('new-tenant', 'ACTIVE');
      expect(mockRegistry.updateMigratedVersion).toHaveBeenCalledWith('new-tenant', '1');
    });

    it('should clean up on migration failure', async () => {
      // Make the pg client's query fail on one of the DDL statements
      const { Pool } = require('pg');
      let callCount = 0;
      const failingClient = {
        query: jest.fn().mockImplementation(async (sql: string) => {
          callCount++;
          // Fail on the 3rd query (after database existence check and CREATE DATABASE)
          if (callCount === 3) {
            throw new Error('DDL migration failed');
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      Pool.mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(failingClient),
        end: jest.fn().mockResolvedValue(undefined),
      }));

      await expect(provisioner.provisionTenant('failing-tenant'))
        .rejects.toThrow('DDL migration failed');

      // Should mark as DEPROVISIONED on failure
      expect(mockRegistry.updateStatus).toHaveBeenCalledWith('failing-tenant', 'DEPROVISIONED');
    });
  });

  describe('deprovisionTenant', () => {
    it('should terminate connections, drop database, and mark as deprovisioned', async () => {
      mockRegistry.lookupTenant.mockResolvedValue({
        tenantId: 'old-tenant',
        dbHost: '127.0.0.1',
        dbPort: 5433,
        dbName: 'inventory_tenant_old_tenant',
        dbUser: 'inventory_user',
        dbPassword: 'inventory_password',
        status: 'ACTIVE',
        provisionedAt: new Date(),
        migratedVersion: '1',
      });

      await provisioner.deprovisionTenant('old-tenant');

      // Should attempt to terminate active connections to the tenant database
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('pg_terminate_backend')
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
