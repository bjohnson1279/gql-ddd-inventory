import { ConnectAmazonStoreUseCase, GetAmazonConnectionsUseCase } from '../../../src/application/useCases/ManageAmazonConnections';
import { IIntegrationRepository } from '../../../src/domain/integrations/repositories/IIntegrationRepository';
import { IntegrationConnection } from '../../../src/domain/integrations/aggregates/IntegrationConnection';
import { IntegrationId } from '../../../src/domain/integrations/valueObjects/IntegrationId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { IntegrationPlatform } from '../../../src/domain/integrations/enums/IntegrationEnums';

describe('ManageAmazonConnections Use Cases', () => {
  let integrationRepo: jest.Mocked<IIntegrationRepository>;

  beforeEach(() => {
    integrationRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
      findByStoreDomain: jest.fn(),
    };
  });

  describe('ConnectAmazonStoreUseCase', () => {
    it('should successfully save a valid Amazon connection', async () => {
      const useCase = new ConnectAmazonStoreUseCase(integrationRepo);

      const result = await useCase.execute({
        tenantId: 'tenant-123',
        sellerId: 'A1234567890',
        mwsAuthToken: 'amzn.mws.token',
        marketplaceId: 'ATVPDKIKX0DER',
      });

      expect(result).toBe(true);
      expect(integrationRepo.save).toHaveBeenCalledTimes(1);

      const savedConnection = integrationRepo.save.mock.calls[0][0] as IntegrationConnection;
      expect(savedConnection.tenantId.value).toBe('tenant-123');
      expect(savedConnection.platform).toBe(IntegrationPlatform.Amazon);
      expect(savedConnection.storeDomain).toBe('A1234567890');
      expect(savedConnection.accessToken).toBe('ATVPDKIKX0DER');
      expect(savedConnection.isActive).toBe(true);
    });

    it('should propagate errors when tenantId is empty', async () => {
      const useCase = new ConnectAmazonStoreUseCase(integrationRepo);

      await expect(
        useCase.execute({
          tenantId: '',
          sellerId: 'A1234567890',
          mwsAuthToken: 'amzn.mws.token',
          marketplaceId: 'ATVPDKIKX0DER',
        })
      ).rejects.toThrow('TenantId cannot be empty.');

      expect(integrationRepo.save).not.toHaveBeenCalled();
    });

    it('should propagate errors when marketplaceId (accessToken) is empty', async () => {
      const useCase = new ConnectAmazonStoreUseCase(integrationRepo);

      await expect(
        useCase.execute({
          tenantId: 'tenant-123',
          sellerId: 'A1234567890',
          mwsAuthToken: 'amzn.mws.token',
          marketplaceId: '',
        })
      ).rejects.toThrow('Access token cannot be empty.');

      expect(integrationRepo.save).not.toHaveBeenCalled();
    });

    it('should propagate errors from the repository save operation', async () => {
      const useCase = new ConnectAmazonStoreUseCase(integrationRepo);

      integrationRepo.save.mockRejectedValue(new Error('Database error'));

      await expect(
        useCase.execute({
          tenantId: 'tenant-123',
          sellerId: 'A1234567890',
          mwsAuthToken: 'amzn.mws.token',
          marketplaceId: 'ATVPDKIKX0DER',
        })
      ).rejects.toThrow('Database error');

      expect(integrationRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('GetAmazonConnectionsUseCase', () => {
    it('should return mapped Amazon connections for a tenant and filter out non-Amazon platforms', async () => {
      const connections = [
        new IntegrationConnection(
          new IntegrationId('int-1'),
          new TenantId('tenant-123'),
          IntegrationPlatform.Amazon,
          'A1234567890',
          'ATVPDKIKX0DER'
        ),
        new IntegrationConnection(
          new IntegrationId('int-2'),
          new TenantId('tenant-123'),
          IntegrationPlatform.Shopify,
          'store.myshopify.com',
          'shpat_1234567890'
        ),
        new IntegrationConnection(
          new IntegrationId('int-3'),
          new TenantId('tenant-123'),
          IntegrationPlatform.Amazon,
          'B0987654321',
          'A2EUQ1WTGCTBG2'
        ),
      ];

      integrationRepo.findAllByTenant.mockResolvedValue(connections);

      const useCase = new GetAmazonConnectionsUseCase(integrationRepo);
      const result = await useCase.execute('tenant-123');

      expect(integrationRepo.findAllByTenant).toHaveBeenCalledWith(expect.any(TenantId));
      expect(integrationRepo.findAllByTenant.mock.calls[0][0].value).toBe('tenant-123');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'int-1',
        tenantId: 'tenant-123',
        platform: IntegrationPlatform.Amazon,
        sellerId: 'A1234567890',
        marketplaceId: 'ATVPDKIKX0DER',
        isActive: true,
      });
      expect(result[1]).toEqual({
        id: 'int-3',
        tenantId: 'tenant-123',
        platform: IntegrationPlatform.Amazon,
        sellerId: 'B0987654321',
        marketplaceId: 'A2EUQ1WTGCTBG2',
        isActive: true,
      });
    });

    it('should return empty array if tenant has no matching Amazon connections', async () => {
      const connections = [
        new IntegrationConnection(
          new IntegrationId('int-2'),
          new TenantId('tenant-123'),
          IntegrationPlatform.Shopify,
          'store.myshopify.com',
          'shpat_1234567890'
        ),
      ];

      integrationRepo.findAllByTenant.mockResolvedValue(connections);

      const useCase = new GetAmazonConnectionsUseCase(integrationRepo);
      const result = await useCase.execute('tenant-123');

      expect(result).toEqual([]);
    });

    it('should propagate errors when tenantId is invalid', async () => {
      const useCase = new GetAmazonConnectionsUseCase(integrationRepo);

      await expect(useCase.execute('')).rejects.toThrow('TenantId cannot be empty.');

      expect(integrationRepo.findAllByTenant).not.toHaveBeenCalled();
    });

    it('should propagate errors from the repository findAllByTenant operation', async () => {
      const useCase = new GetAmazonConnectionsUseCase(integrationRepo);

      integrationRepo.findAllByTenant.mockRejectedValue(new Error('Database error'));

      await expect(useCase.execute('tenant-123')).rejects.toThrow('Database error');

      expect(integrationRepo.findAllByTenant).toHaveBeenCalledTimes(1);
    });
  });
});
