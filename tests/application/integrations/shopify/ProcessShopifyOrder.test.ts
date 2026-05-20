import { ProcessShopifyOrder } from '../../../../src/application/integrations/shopify/ProcessShopifyOrder';
import { IIntegrationRepository } from '../../../../src/domain/integrations/repositories/IIntegrationRepository';
import { IExternalMappingRepository } from '../../../../src/domain/integrations/repositories/IExternalMappingRepository';
import { InventoryService } from '../../../../src/domain/services/InventoryService';
import { IntegrationConnection } from '../../../../src/domain/integrations/aggregates/IntegrationConnection';
import { IntegrationId } from '../../../../src/domain/integrations/valueObjects/IntegrationId';
import { TenantId } from '../../../../src/domain/valueObjects/TenantId';
import { IntegrationPlatform, ExternalEntityType } from '../../../../src/domain/integrations/enums/IntegrationEnums';
import { ExternalMapping } from '../../../../src/domain/integrations/entities/ExternalMapping';

describe('ProcessShopifyOrder', () => {
  let integrationRepo: jest.Mocked<IIntegrationRepository>;
  let mappingRepo: jest.Mocked<IExternalMappingRepository>;
  let inventoryService: jest.Mocked<InventoryService>;
  let useCase: ProcessShopifyOrder;

  beforeEach(() => {
    integrationRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
    };
    mappingRepo = {
      save: jest.fn(),
      findByInternalId: jest.fn(),
      findByExternalId: jest.fn(),
      delete: jest.fn(),
    };
    inventoryService = {
      decrementForSale: jest.fn(),
      decrementForKitSale: jest.fn(),
    } as any;

    useCase = new ProcessShopifyOrder(integrationRepo, mappingRepo, inventoryService);
  });

  it('should decrement internal inventory for Shopify order items', async () => {
    const integrationId = new IntegrationId('I1');
    const tenantId = new TenantId('T1');
    const connection = new IntegrationConnection(integrationId, tenantId, IntegrationPlatform.Shopify, 'test.myshopify.com', 'token');

    integrationRepo.findById.mockResolvedValue(connection);

    mappingRepo.findByExternalId.mockImplementation(async (id, externalId, type) => {
      if (type === ExternalEntityType.Location && externalId === 'ext-loc') {
        return new ExternalMapping(tenantId, id, type, 'int-loc', externalId);
      }
      if (type === ExternalEntityType.Variant && externalId === 'ext-v1') {
        return new ExternalMapping(tenantId, id, type, 'int-v1', externalId);
      }
      return null;
    });

    await useCase.execute({
      integrationId: 'I1',
      shopifyOrderId: '1001',
      shopifyLocationId: 'ext-loc',
      lineItems: [
        { shopifyVariantId: 'ext-v1', quantity: 2 }
      ]
    });

    expect(inventoryService.decrementForSale).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({ value: 'int-loc' }),
      expect.objectContaining({ value: 'int-v1' }),
      2,
      'SHOPIFY-1001',
      expect.objectContaining({ value: 'shopify-integration' })
    );
  });

  it('should throw error if integration connection is inactive', async () => {
    const connection = new IntegrationConnection(new IntegrationId('I1'), new TenantId('T1'), IntegrationPlatform.Shopify, 'test.myshopify.com', 'token', false);
    integrationRepo.findById.mockResolvedValue(connection);

    await expect(useCase.execute({
      integrationId: 'I1',
      shopifyOrderId: '1001',
      shopifyLocationId: 'ext-loc',
      lineItems: []
    })).rejects.toThrow('inactive');
  });

  it('should throw error if location mapping is missing', async () => {
    const connection = new IntegrationConnection(new IntegrationId('I1'), new TenantId('T1'), IntegrationPlatform.Shopify, 'test.myshopify.com', 'token');
    integrationRepo.findById.mockResolvedValue(connection);
    mappingRepo.findByExternalId.mockResolvedValue(null);

    await expect(useCase.execute({
      integrationId: 'I1',
      shopifyOrderId: '1001',
      shopifyLocationId: 'ext-loc',
      lineItems: []
    })).rejects.toThrow('No mapping found for Shopify location');
  });

  it('should warn and skip if variant mapping is missing', async () => {
    const connection = new IntegrationConnection(new IntegrationId('I1'), new TenantId('T1'), IntegrationPlatform.Shopify, 'test.myshopify.com', 'token');
    integrationRepo.findById.mockResolvedValue(connection);
    
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    mappingRepo.findByExternalId.mockImplementation(async (id, externalId, type) => {
      if (type === ExternalEntityType.Location) return new ExternalMapping(new TenantId('T1'), id, type, 'int-l', externalId);
      return null; // Missing variant mapping
    });

    await useCase.execute({
      integrationId: 'I1',
      shopifyOrderId: '1001',
      shopifyLocationId: 'ext-loc',
      lineItems: [{ shopifyVariantId: 'missing-v', quantity: 1 }]
    });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No mapping found for Shopify variant'));
    expect(inventoryService.decrementForSale).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });
});
