import { WMSCapacityService } from '../../../src/domain/services/WMSCapacityService';
import { IInventoryRepository } from '../../../src/domain/repositories/IInventoryRepository';
import { IProductRepository } from '../../../src/domain/repositories/IProductRepository';
import { IWarehouseLocationRepository } from '../../../src/domain/repositories/IWarehouseLocationRepository';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { CapacityExceededError } from '../../../src/domain/exceptions/DomainErrors';
import { WarehouseLocation } from '../../../src/domain/entities/WarehouseLocation';
import { InventoryItem } from '../../../src/domain/entities/InventoryItem';
import { Quantity } from '../../../src/domain/valueObjects/Quantity';
import { Product } from '../../../src/domain/entities/Product';
import { ProductId } from '../../../src/domain/valueObjects/ProductId';
import { VariantTrackingMode } from '../../../src/domain/enums/VariantEnums';

describe('WMSCapacityService', () => {
  let inventoryRepository: jest.Mocked<IInventoryRepository>;
  let productRepository: jest.Mocked<IProductRepository>;
  let locationRepository: jest.Mocked<IWarehouseLocationRepository>;
  let service: WMSCapacityService;

  beforeEach(() => {
    inventoryRepository = {
      findById: jest.fn(),
      findBySku: jest.fn(),
      findBySkuAndLocation: jest.fn(),
      findBySkuAndLocationBatch: jest.fn(),
      findByLocation: jest.fn(),
      save: jest.fn(),
      saveBatch: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<IInventoryRepository>;

    productRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      findBySku: jest.fn(),
      findBySkus: jest.fn(),
      findSkuByVariantId: jest.fn(),
      findSkusByVariantIds: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<IProductRepository>;

    locationRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      delete: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<IWarehouseLocationRepository>;

    service = new WMSCapacityService(
      inventoryRepository,
      productRepository,
      locationRepository
    );
  });

  const setupMocks = (
    maxWeight: number,
    maxVolume: number,
    currentQty: number,
    variantWeight: number,
    variantVolume: number
  ) => {
    const location = new WarehouseLocation(
      new LocationId('WH1-ZONEA-A03-R02-S01-B10'),
      'WH1',
      'ZONEA',
      'A03',
      'R02',
      'S01',
      'B10',
      maxWeight,
      maxVolume
    );

    const sku = new Sku('TEST-SKU');
    const item = InventoryItem.createNew('item-1', sku.value, location.id.value);
    item.receiveStock(new Quantity(currentQty));

    const product = new Product(new ProductId('prod-1'), 'Test Product');
    const variant = product.addVariant(sku, [
      { name: 'Color', value: 'Red', equals: () => false } as any // Simplified for mock
    ], VariantTrackingMode.Quantity);
    Object.defineProperty(variant, 'weightGrams', { value: variantWeight, writable: true });
    Object.defineProperty(variant, 'volumeCubicMeters', { value: variantVolume, writable: true });

    locationRepository.findById.mockResolvedValue(location);
    inventoryRepository.findByLocation.mockResolvedValue([item]);
    productRepository.findBySkus.mockResolvedValue([product]);
  };

  it('should pass if total capacity is under limits (relative adjustment)', async () => {
    setupMocks(1000, 10, 2, 100, 1);
    await expect(
      service.validateCapacity('WH1-ZONEA-A03-R02-S01-B10', [
        { sku: 'TEST-SKU', mode: 'relative', quantity: 3 },
      ])
    ).resolves.not.toThrow();
  });

  it('should pass if total capacity is under limits (absolute adjustment)', async () => {
    setupMocks(1000, 10, 10, 100, 1);
    await expect(
      service.validateCapacity('WH1-ZONEA-A03-R02-S01-B10', [
        { sku: 'TEST-SKU', mode: 'absolute', quantity: 5 },
      ])
    ).resolves.not.toThrow();
  });

  it('should throw CapacityExceededError due to weight limit', async () => {
    setupMocks(1000, 10, 2, 400, 1);
    await expect(
      service.validateCapacity('WH1-ZONEA-A03-R02-S01-B10', [
        { sku: 'TEST-SKU', mode: 'relative', quantity: 1 },
      ])
    ).rejects.toThrow(CapacityExceededError);
  });

  it('should throw CapacityExceededError due to volume limit', async () => {
    setupMocks(1000, 10, 2, 100, 4);
    await expect(
      service.validateCapacity('WH1-ZONEA-A03-R02-S01-B10', [
        { sku: 'TEST-SKU', mode: 'relative', quantity: 1 },
      ])
    ).rejects.toThrow(CapacityExceededError);
  });

  it('should return immediately if location is not found', async () => {
    locationRepository.findById.mockResolvedValue(null);
    await expect(
      service.validateCapacity('WH1-ZONEA-A03-R02-S01-B10', [
        { sku: 'TEST-SKU', mode: 'relative', quantity: 100 },
      ])
    ).resolves.not.toThrow();
    expect(inventoryRepository.findByLocation).not.toHaveBeenCalled();
  });

  it('should handle zero active skus gracefully', async () => {
    setupMocks(1000, 10, 2, 100, 1);
    await expect(
      service.validateCapacity('WH1-ZONEA-A03-R02-S01-B10', [
        { sku: 'TEST-SKU', mode: 'absolute', quantity: 0 },
      ])
    ).resolves.not.toThrow();
    expect(productRepository.findBySkus).not.toHaveBeenCalled();
  });
});
