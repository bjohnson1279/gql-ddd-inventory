import { SyncInventoryToShopify } from '../../../../src/application/integrations/shopify/SyncInventoryToShopify';
import { IIntegrationRepository } from '../../../../src/domain/integrations/repositories/IIntegrationRepository';
import { IExternalMappingRepository } from '../../../../src/domain/integrations/repositories/IExternalMappingRepository';
import { ILedgerRepository } from '../../../../src/domain/repositories/ILedgerRepository';
import { IShopifyClient } from '../../../../src/domain/integrations/services/IShopifyClient';
import { IntegrationConnection } from '../../../../src/domain/integrations/aggregates/IntegrationConnection';
import { IntegrationId } from '../../../../src/domain/integrations/valueObjects/IntegrationId';
import { TenantId } from '../../../../src/domain/valueObjects/TenantId';
import { IntegrationPlatform, ExternalEntityType } from '../../../../src/domain/integrations/enums/IntegrationEnums';
import { ExternalMapping } from '../../../../src/domain/integrations/entities/ExternalMapping';

describe('SyncInventoryToShopify', () => {
  let integrationRepo: jest.Mocked<IIntegrationRepository>;
  let mappingRepo: jest.Mocked<IExternalMappingRepository>;
  let ledgerRepo: jest.Mocked<ILedgerRepository>;
  let shopifyClient: jest.Mocked<IShopifyClient>;
  let useCase: SyncInventoryToShopify;

  beforeEach(() => {
    integrationRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findAllByTenant: jest.fn(),
      findByStoreDomain: jest.fn(),
    };
    mappingRepo = {
      save: jest.fn(),
      saveBatch: jest.fn(),
      findByInternalId: jest.fn(),
      findManyByInternalId: jest.fn(),
      findByExternalId: jest.fn(),
      findByExternalIds: jest.fn(),
      delete: jest.fn(),
    };
    ledgerRepo = {
      append: jest.fn(),
      appendBatch: jest.fn(),
      currentQuantity: jest.fn(),
      currentQuantities: jest.fn(),
      entriesFor: jest.fn(),
      currentQuantityAt: jest.fn(),
      hasAnyEntries: jest.fn(),
    };
    shopifyClient = {
      setInventory: jest.fn(),
      upsertProduct: jest.fn(),
      getInventoryLevels: jest.fn(),
    };

    useCase = new SyncInventoryToShopify(integrationRepo, mappingRepo, ledgerRepo, shopifyClient);
  });

  it('should push inventory to Shopify if mappings exist', async () => {
    const tenantId = 'T1';
    const locationId = 'L1';
    const variantId = 'V1';
    const integrationId = new IntegrationId('I1');

    const connection = new IntegrationConnection(
      integrationId,
      new TenantId(tenantId),
      IntegrationPlatform.Shopify,
      'test.myshopify.com',
      'token'
    );

    integrationRepo.findAllByTenant.mockResolvedValue([connection]);
    ledgerRepo.currentQuantity.mockResolvedValue(10);

    mappingRepo.findManyByInternalId.mockImplementation(async (ids, internalId, type) => {
      if (type === ExternalEntityType.Variant) {
        return ids.map((id: IntegrationId) => new ExternalMapping(new TenantId(tenantId), id, type, variantId, 'ext-v', 'ext-inv'));
      }
      if (type === ExternalEntityType.Location) {
        return ids.map((id: IntegrationId) => new ExternalMapping(new TenantId(tenantId), id, type, locationId, 'ext-loc'));
      }
      return [];
    });

    await useCase.execute(tenantId, locationId, variantId);

    expect(shopifyClient.setInventory).toHaveBeenCalledWith(
      'test.myshopify.com',
      'token',
      'ext-inv',
      'ext-loc',
      10
    );
  });

  it('should skip if no active Shopify connections exist for tenant', async () => {
    integrationRepo.findAllByTenant.mockResolvedValue([]);
    
    await useCase.execute('T1', 'L1', 'V1');

    expect(ledgerRepo.currentQuantity).not.toHaveBeenCalled();
    expect(shopifyClient.setInventory).not.toHaveBeenCalled();
  });
});
