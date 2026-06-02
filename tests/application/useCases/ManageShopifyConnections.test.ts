import { ConnectShopifyStoreUseCase, GetShopifyConnectionsUseCase } from '../../../src/application/useCases/ManageShopifyConnections';
import { IIntegrationRepository } from '../../../src/domain/integrations/repositories/IIntegrationRepository';
import { IntegrationConnection } from '../../../src/domain/integrations/aggregates/IntegrationConnection';
import { IntegrationId } from '../../../src/domain/integrations/valueObjects/IntegrationId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { IntegrationPlatform } from '../../../src/domain/integrations/enums/IntegrationEnums';

describe('ManageShopifyConnections Use Cases', () => {
  let integrationRepo: jest.Mocked<IIntegrationRepository>;

  beforeEach(() => {
    integrationRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
      findByStoreDomain: jest.fn(),
    };
  });

  describe('ConnectShopifyStoreUseCase', () => {
    it('should successfully save a valid shopify connection', async () => {
      const useCase = new ConnectShopifyStoreUseCase(integrationRepo);

      const result = await useCase.execute({
        id: 'int-123',
        tenantId: 'tenant-123',
        storeDomain: 'test-store.myshopify.com',
        accessToken: 'shpat_1234567890',
      });

      expect(result).toBe(true);
      expect(integrationRepo.save).toHaveBeenCalledTimes(1);

      const savedConnection = integrationRepo.save.mock.calls[0][0] as IntegrationConnection;
      expect(savedConnection.id.value).toBe('int-123');
      expect(savedConnection.tenantId.value).toBe('tenant-123');
      expect(savedConnection.platform).toBe(IntegrationPlatform.Shopify);
      expect(savedConnection.storeDomain).toBe('test-store.myshopify.com');
      expect(savedConnection.accessToken).toBe('shpat_1234567890');
      expect(savedConnection.isActive).toBe(true);
    });

    it('should correctly handle activation and deactivation of the connection', async () => {
      const useCase = new ConnectShopifyStoreUseCase(integrationRepo);

      await useCase.execute({
        id: 'int-123',
        tenantId: 'tenant-123',
        storeDomain: 'test-store.myshopify.com',
        accessToken: 'shpat_1234567890',
      });

      const savedConnection = integrationRepo.save.mock.calls[0][0] as IntegrationConnection;

      expect(savedConnection.isActive).toBe(true);

      savedConnection.deactivate();
      expect(savedConnection.isActive).toBe(false);

      savedConnection.activate();
      expect(savedConnection.isActive).toBe(true);
    });

    it('should correctly evaluate equality for IntegrationId and TenantId', async () => {
      const useCase = new ConnectShopifyStoreUseCase(integrationRepo);

      await useCase.execute({
        id: 'int-123',
        tenantId: 'tenant-123',
        storeDomain: 'test-store.myshopify.com',
        accessToken: 'shpat_1234567890',
      });

      const savedConnection = integrationRepo.save.mock.calls[0][0] as IntegrationConnection;

      const sameIntegrationId = new IntegrationId('int-123');
      const differentIntegrationId = new IntegrationId('int-456');
      expect(savedConnection.id.equals(sameIntegrationId)).toBe(true);
      expect(savedConnection.id.equals(differentIntegrationId)).toBe(false);

      const sameTenantId = new TenantId('tenant-123');
      const differentTenantId = new TenantId('tenant-456');
      expect(savedConnection.tenantId.equals(sameTenantId)).toBe(true);
      expect(savedConnection.tenantId.equals(differentTenantId)).toBe(false);
    });

    it('should throw an error if the store domain is not a valid shopify domain', async () => {
      const useCase = new ConnectShopifyStoreUseCase(integrationRepo);

      await expect(useCase.execute({
        id: 'int-123',
        tenantId: 'tenant-123',
        storeDomain: 'invalid-domain.com',
        accessToken: 'shpat_1234567890',
      })).rejects.toThrow('Invalid store domain. Must be a .myshopify.com domain.');

      expect(integrationRepo.save).not.toHaveBeenCalled();
    });

    it('should throw an error if the id is empty', async () => {
      const useCase = new ConnectShopifyStoreUseCase(integrationRepo);

      await expect(useCase.execute({
        id: '',
        tenantId: 'tenant-123',
        storeDomain: 'test-store.myshopify.com',
        accessToken: 'shpat_1234567890',
      })).rejects.toThrow('IntegrationId cannot be empty.');

      expect(integrationRepo.save).not.toHaveBeenCalled();
    });

    it('should throw an error if the tenantId is empty', async () => {
      const useCase = new ConnectShopifyStoreUseCase(integrationRepo);

      await expect(useCase.execute({
        id: 'int-123',
        tenantId: '',
        storeDomain: 'test-store.myshopify.com',
        accessToken: 'shpat_1234567890',
      })).rejects.toThrow('TenantId cannot be empty.');

      expect(integrationRepo.save).not.toHaveBeenCalled();
    });

    it('should propagate errors from the repository', async () => {
      const useCase = new ConnectShopifyStoreUseCase(integrationRepo);

      integrationRepo.save.mockRejectedValue(new Error('Database error'));

      await expect(useCase.execute({
        id: 'int-123',
        tenantId: 'tenant-123',
        storeDomain: 'test-store.myshopify.com',
        accessToken: 'shpat_1234567890',
      })).rejects.toThrow('Database error');

      expect(integrationRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('GetShopifyConnectionsUseCase', () => {
    it('should return all shopify connections for a tenant', async () => {
      const connections = [
        new IntegrationConnection(
          new IntegrationId('int-1'),
          new TenantId('tenant-123'),
          IntegrationPlatform.Shopify,
          'store1.myshopify.com',
          'token1'
        ),
        new IntegrationConnection(
          new IntegrationId('int-2'),
          new TenantId('tenant-123'),
          IntegrationPlatform.Shopify,
          'store2.myshopify.com',
          'token2'
        )
      ];

      integrationRepo.findAllByTenant.mockResolvedValue(connections);

      const useCase = new GetShopifyConnectionsUseCase(integrationRepo);
      const result = await useCase.execute('tenant-123');

      expect(integrationRepo.findAllByTenant).toHaveBeenCalledWith(expect.any(TenantId));
      expect(integrationRepo.findAllByTenant.mock.calls[0][0].value).toBe('tenant-123');

      expect(result).toHaveLength(2);
      expect(result[0].id.value).toBe('int-1');
      expect(result[1].id.value).toBe('int-2');
    });

    it('should return empty array if tenant has no connections', async () => {
      integrationRepo.findAllByTenant.mockResolvedValue([]);

      const useCase = new GetShopifyConnectionsUseCase(integrationRepo);
      const result = await useCase.execute('tenant-123');

      expect(result).toEqual([]);
    });
  });
});
