import { SyncProductFromShopify } from '../../../../src/application/integrations/shopify/SyncProductFromShopify';
import { IProductRepository } from '../../../../src/domain/repositories/IProductRepository';
import { IExternalMappingRepository } from '../../../../src/domain/integrations/repositories/IExternalMappingRepository';
import { Product } from '../../../../src/domain/entities/Product';
import { ProductId } from '../../../../src/domain/valueObjects/ProductId';
import { IntegrationId } from '../../../../src/domain/integrations/valueObjects/IntegrationId';
import { TenantId } from '../../../../src/domain/valueObjects/TenantId';
import { ExternalMapping } from '../../../../src/domain/integrations/entities/ExternalMapping';
import { ExternalEntityType } from '../../../../src/domain/integrations/enums/IntegrationEnums';

describe('SyncProductFromShopify', () => {
  let productRepo: jest.Mocked<IProductRepository>;
  let mappingRepo: jest.Mocked<IExternalMappingRepository>;
  let useCase: SyncProductFromShopify;

  beforeEach(() => {
    productRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findBySku: jest.fn(),
      findAll: jest.fn(),
    };
    mappingRepo = {
      save: jest.fn(),
      findByInternalId: jest.fn(),
      findByExternalId: jest.fn(),
      findByExternalIds: jest.fn(),
      delete: jest.fn(),
    };
    useCase = new SyncProductFromShopify(productRepo, mappingRepo);
  });

  it('should create a new product and variant when no mapping exists', async () => {
    const integrationId = 'I1';
    const tenantId = 'T1';
    
    mappingRepo.findByExternalId.mockResolvedValue(null);

    await useCase.execute(integrationId, tenantId, {
      id: 'shop-p-1',
      title: 'Cool T-Shirt',
      variants: [
        { id: 'shop-v-1', sku: 'TSHIRT-BLUE', inventoryItemId: 'shop-inv-1', title: 'Blue' }
      ]
    });

    expect(productRepo.save).toHaveBeenCalled();
    expect(mappingRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      entityType: ExternalEntityType.Product,
      externalId: 'shop-p-1'
    }));
    expect(mappingRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      entityType: ExternalEntityType.Variant,
      externalId: 'shop-v-1',
      externalSecondaryId: 'shop-inv-1'
    }));
  });

  it('should throw error if mapping exists but product not found in repository', async () => {
    const integrationId = 'I1';
    const tenantId = 'T1';
    
    mappingRepo.findByExternalId.mockResolvedValue(new ExternalMapping(new TenantId(tenantId), new IntegrationId(integrationId), ExternalEntityType.Product, 'internal-p', 'shop-p-1'));
    productRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(integrationId, tenantId, {
      id: 'shop-p-1',
      title: 'Missing',
      variants: []
    })).rejects.toThrow('Product internal-p not found but mapping exists');
  });
});
