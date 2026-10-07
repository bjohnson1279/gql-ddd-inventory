import { GetWooCommerceConnectionsUseCase, ConnectWooCommerceStoreUseCase } from '../../../src/application/useCases/ManageWooCommerceConnections';
import { IIntegrationRepository } from '../../../src/domain/integrations/repositories/IIntegrationRepository';
import { IntegrationConnection } from '../../../src/domain/integrations/aggregates/IntegrationConnection';
import { IntegrationId } from '../../../src/domain/integrations/valueObjects/IntegrationId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { IntegrationPlatform } from '../../../src/domain/integrations/enums/IntegrationEnums';

describe('ManageWooCommerceConnections Use Cases', () => {
  let integrationRepo: jest.Mocked<IIntegrationRepository>;

  beforeEach(() => {
    integrationRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
      findByStoreDomain: jest.fn(),
    };
  });

  describe('GetWooCommerceConnectionsUseCase', () => {
    it('should return mapped woocommerce connections for a tenant', async () => {
      const connections = [
        new IntegrationConnection(
          new IntegrationId('int-1'),
          new TenantId('tenant-123'),
          IntegrationPlatform.WooCommerce,
          'https://store1.example.com',
          'consumer_key_1'
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

      const useCase = new GetWooCommerceConnectionsUseCase(integrationRepo);
      const result = await useCase.execute('tenant-123');

      expect(integrationRepo.findAllByTenant).toHaveBeenCalledWith(expect.any(TenantId));
      expect(integrationRepo.findAllByTenant.mock.calls[0][0].value).toBe('tenant-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'int-1',
        tenantId: 'tenant-123',
        platform: IntegrationPlatform.WooCommerce,
        storeUrl: 'https://store1.example.com',
        isActive: true,
      });
    });

    it('should return empty array if tenant has no connections', async () => {
      integrationRepo.findAllByTenant.mockResolvedValue([]);

      const useCase = new GetWooCommerceConnectionsUseCase(integrationRepo);
      const result = await useCase.execute('tenant-123');

      expect(result).toEqual([]);
    });
  });

  describe('ConnectWooCommerceStoreUseCase', () => {
    it('should successfully save a valid woocommerce connection', async () => {
      const useCase = new ConnectWooCommerceStoreUseCase(integrationRepo);

      const result = await useCase.execute({
        tenantId: 'tenant-123',
        storeUrl: 'https://mywoostore.com',
        consumerKey: 'ck_12345',
        consumerSecret: 'cs_12345',
      });

      expect(result).toBe(true);
      expect(integrationRepo.save).toHaveBeenCalledTimes(1);

      const savedConnection = integrationRepo.save.mock.calls[0][0] as IntegrationConnection;
      expect(savedConnection.tenantId.value).toBe('tenant-123');
      expect(savedConnection.platform).toBe(IntegrationPlatform.WooCommerce);
      expect(savedConnection.storeDomain).toBe('https://mywoostore.com');
      expect(savedConnection.accessToken).toBe('ck_12345');
      expect(savedConnection.isActive).toBe(true);
    });

    it('should propagate errors when store domain is invalid and prevent saving', async () => {
      const useCase = new ConnectWooCommerceStoreUseCase(integrationRepo);

      await expect(useCase.execute({
        tenantId: 'tenant-123',
        storeUrl: 'invalid-url.com',
        consumerKey: 'ck_12345',
        consumerSecret: 'cs_12345',
      })).rejects.toThrow('Invalid store domain for WooCommerce. Must be a valid URL.');

      expect(integrationRepo.save).not.toHaveBeenCalled();
    });

    it('should propagate errors when consumerKey is empty and prevent saving', async () => {
      const useCase = new ConnectWooCommerceStoreUseCase(integrationRepo);

      await expect(useCase.execute({
        tenantId: 'tenant-123',
        storeUrl: 'https://mywoostore.com',
        consumerKey: '',
        consumerSecret: 'cs_12345',
      })).rejects.toThrow('Access token cannot be empty.');

      expect(integrationRepo.save).not.toHaveBeenCalled();
    });

    it('should propagate repository errors when saving fails', async () => {
      const useCase = new ConnectWooCommerceStoreUseCase(integrationRepo);

      integrationRepo.save.mockRejectedValue(new Error('Database write error'));

      await expect(useCase.execute({
        tenantId: 'tenant-123',
        storeUrl: 'https://mywoostore.com',
        consumerKey: 'ck_12345',
        consumerSecret: 'cs_12345',
      })).rejects.toThrow('Database write error');

      expect(integrationRepo.save).toHaveBeenCalledTimes(1);
    });
  });
});
