import { PutawaySuggester } from '../../../src/domain/services/PutawaySuggester';
import { IInventoryRepository } from '../../../src/domain/repositories/IInventoryRepository';
import { IProductRepository } from '../../../src/domain/repositories/IProductRepository';
import { IWarehouseLocationRepository } from '../../../src/domain/repositories/IWarehouseLocationRepository';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { Product } from '../../../src/domain/entities/Product';
import { ProductId } from '../../../src/domain/valueObjects/ProductId';
import { WarehouseLocation } from '../../../src/domain/entities/WarehouseLocation';
import { InventoryItem } from '../../../src/domain/entities/InventoryItem';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { Quantity } from '../../../src/domain/valueObjects/Quantity';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { VariantAttributeSet } from '../../../src/domain/valueObjects/VariantAttributeSet';
import { VariantAttribute } from '../../../src/domain/valueObjects/VariantAttribute';
import { VariantTrackingMode } from '../../../src/domain/enums/VariantEnums';
import { ProductVariant } from '../../../src/domain/entities/ProductVariant';

describe('PutawaySuggester', () => {
  let mockInventoryRepo: jest.Mocked<IInventoryRepository>;
  let mockProductRepo: jest.Mocked<IProductRepository>;
  let mockLocationRepo: jest.Mocked<IWarehouseLocationRepository>;
  let suggester: PutawaySuggester;

  beforeEach(() => {
    mockInventoryRepo = {
      findById: jest.fn(),
      findBySku: jest.fn(),
      findBySkuAndLocation: jest.fn(),
      findBySkuAndLocationBatch: jest.fn(),
      findByLocation: jest.fn(),
      findByLocationsBatch: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
      saveBatch: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
    };
    mockProductRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      findBySku: jest.fn(),
      findBySkus: jest.fn().mockResolvedValue([]),
      findSkuByVariantId: jest.fn(),
      findSkusByVariantIds: jest.fn(),
      findAll: jest.fn(),
    };
    mockLocationRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      delete: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
    };
    suggester = new PutawaySuggester(mockInventoryRepo, mockProductRepo, mockLocationRepo);
  });

  const createProduct = (skuStr: string, attrs: VariantAttribute[] = [new VariantAttribute('default', 'true')], weight = 100, volume = 0.5) => {
    const sku = new Sku(skuStr);
    const product = new Product(new ProductId('prod-1'), 'Test Product');
    const variant = new ProductVariant(
      new ProductVariantId('var-1'),
      product.id,
      sku,
      new VariantAttributeSet(attrs),
      VariantTrackingMode.Quantity,
      weight,
      volume
    );
    // Use private fields to bypass product's generation and focus on mock data
    (product as any)._variants = new Map([[variant.id.value, variant]]);
    (product as any)._variantsBySku = new Map([[sku.value, variant]]);
    return { sku, product, variant };
  };

  it('throws Error if quantity is non-positive', async () => {
    await expect(suggester.suggestPutaway(new Sku('TEST'), 0)).rejects.toThrow("Quantity to put away must be positive.");
    await expect(suggester.suggestPutaway(new Sku('TEST'), -5)).rejects.toThrow("Quantity to put away must be positive.");
  });

  it('throws Error if product is not found', async () => {
    mockProductRepo.findBySku.mockResolvedValue(null);
    await expect(suggester.suggestPutaway(new Sku('TEST-1'), 10)).rejects.toThrow("Product variant with SKU TEST-1 not found.");
  });

  it('throws Error if product has no matching variant', async () => {
    const sku = new Sku('TEST-1');
    const product = new Product(new ProductId('prod-1'), 'Test');
    mockProductRepo.findBySku.mockResolvedValue(product);
    await expect(suggester.suggestPutaway(sku, 10)).rejects.toThrow("Product variant with SKU TEST-1 not found.");
  });

  it('returns empty array if no locations exist', async () => {
    const { sku, product } = createProduct('TEST-1');
    mockProductRepo.findBySku.mockResolvedValue(product);
    mockLocationRepo.findAll.mockResolvedValue([]);

    const result = await suggester.suggestPutaway(sku, 10);
    expect(result).toEqual([]);
  });

  it('suggests location correctly for standard product without existing inventory', async () => {
    const { sku, product } = createProduct('TEST-1', [new VariantAttribute('Color', 'Blue')], 100, 1);
    mockProductRepo.findBySku.mockResolvedValue(product);
    const loc = new WarehouseLocation(new LocationId('WH1-A-A01-R01-S01-B01'), 'WH1', 'STANDARD', 'A01', 'R01', 'S01', 'B01', 1000, 10);
    mockLocationRepo.findAll.mockResolvedValue([loc]);
    mockInventoryRepo.findByLocationsBatch.mockResolvedValue([]);

    const recommendations = await suggester.suggestPutaway(sku, 5);
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toEqual({
      locationId: loc.id.value,
      quantity: 5,
      remainingWeightGrams: 500,
      remainingVolumeCubicMeters: 5
    });
  });

  it('accounts for existing inventory in location', async () => {
    const { sku, product, variant } = createProduct('TEST-1', [new VariantAttribute('Color', 'Blue')], 100, 1);
    mockProductRepo.findBySku.mockResolvedValue(product);
    const loc = new WarehouseLocation(new LocationId('WH1-A-A01-R01-S01-B01'), 'WH1', 'STANDARD', 'A01', 'R01', 'S01', 'B01', 1000, 10);
    mockLocationRepo.findAll.mockResolvedValue([loc]);

    const item = new InventoryItem('item-1', sku, loc.id, new Quantity(5));
    mockInventoryRepo.findByLocationsBatch.mockResolvedValue([item]);
    mockProductRepo.findBySkus.mockResolvedValue([product]);

    const recommendations = await suggester.suggestPutaway(sku, 2);
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toEqual({
      locationId: loc.id.value,
      quantity: 2,
      remainingWeightGrams: 300, // 1000 - (5*100) - (2*100)
      remainingVolumeCubicMeters: 3 // 10 - (5*1) - (2*1)
    });
  });

  it('prioritizes matching temperature zone', async () => {
    const { sku, product } = createProduct('TEST-1', [new VariantAttribute('temperatureZone', 'cold')]);
    mockProductRepo.findBySku.mockResolvedValue(product);

    const locWarm = new WarehouseLocation(new LocationId('loc-warm'), 'WH1', 'warm', 'A01', 'R01', 'S01', 'B01', 1000, 10);
    const locCold = new WarehouseLocation(new LocationId('loc-cold'), 'WH1', 'cold', 'A01', 'R01', 'S01', 'B01', 1000, 10);
    mockLocationRepo.findAll.mockResolvedValue([locWarm, locCold]);

    const recommendations = await suggester.suggestPutaway(sku, 5);
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].locationId).toBe('loc-cold');
  });

  it('prioritizes HAZMAT zone if hazard class is present, and avoids HAZMAT for standard products', async () => {
    const { sku: skuHazmat, product: prodHazmat } = createProduct('HAZ-1', [new VariantAttribute('hazardClass', 'flammable')]);
    const { sku: skuStd, product: prodStd } = createProduct('STD-1', [new VariantAttribute('color', 'red')]);

    const locHazmat = new WarehouseLocation(new LocationId('loc-hazmat'), 'WH1', 'hazmat', 'A01', 'R01', 'S01', 'B01', 1000, 10);
    const locStd = new WarehouseLocation(new LocationId('loc-std'), 'WH1', 'standard', 'A01', 'R01', 'S01', 'B01', 1000, 10);
    mockLocationRepo.findAll.mockResolvedValue([locHazmat, locStd]);

    // Test Hazmat product
    mockProductRepo.findBySku.mockResolvedValue(prodHazmat);
    let recs = await suggester.suggestPutaway(skuHazmat, 1);
    expect(recs).toHaveLength(1);
    expect(recs[0].locationId).toBe('loc-hazmat');

    // Test Standard product
    mockProductRepo.findBySku.mockResolvedValue(prodStd);
    recs = await suggester.suggestPutaway(skuStd, 1);
    expect(recs).toHaveLength(1);
    expect(recs[0].locationId).toBe('loc-std');
  });

  it('prioritizes FAST zone and A01-A03 aisles for fast-moving items', async () => {
    const { sku, product } = createProduct('FAST-1', [new VariantAttribute('velocity', 'fast-moving')]);
    mockProductRepo.findBySku.mockResolvedValue(product);

    const locSlow = new WarehouseLocation(new LocationId('loc-slow'), 'WH1', 'standard', 'B01', 'R01', 'S01', 'B01', 1000, 10);
    const locAisleA02 = new WarehouseLocation(new LocationId('loc-a02'), 'WH1', 'standard', 'A02', 'R01', 'S01', 'B01', 1000, 10);
    const locFast = new WarehouseLocation(new LocationId('loc-fast'), 'WH1', 'fast', 'A01', 'R01', 'S01', 'B01', 1000, 10);

    mockLocationRepo.findAll.mockResolvedValue([locSlow, locAisleA02, locFast]);

    const recs = await suggester.suggestPutaway(sku, 1);
    // Should prioritize locFast over locAisleA02, but both over locSlow. locFast gets 50+30=80, locAisleA02 gets 30, locSlow gets 0
    expect(recs).toHaveLength(1);
    expect(recs[0].locationId).toBe('loc-fast');
  });

  it('splits quantities across multiple locations when necessary', async () => {
    const { sku, product } = createProduct('TEST-1', [new VariantAttribute('Color', 'Blue')], 100, 1); // 100g, 1 m3 per unit
    mockProductRepo.findBySku.mockResolvedValue(product);

    // Each location can hold exactly 5 units (500g, 5 m3)
    const loc1 = new WarehouseLocation(new LocationId('loc-1'), 'WH1', 'standard', 'A01', 'R01', 'S01', 'B01', 500, 5);
    const loc2 = new WarehouseLocation(new LocationId('loc-2'), 'WH1', 'standard', 'A02', 'R01', 'S01', 'B01', 500, 5);
    mockLocationRepo.findAll.mockResolvedValue([loc1, loc2]);

    const recs = await suggester.suggestPutaway(sku, 8); // 8 units requested
    expect(recs).toHaveLength(2);

    // Ordered by score (0), then remaining weight desc
    const q1 = recs.find(r => r.locationId === 'loc-1')?.quantity;
    const q2 = recs.find(r => r.locationId === 'loc-2')?.quantity;

    // One should have 5, one should have 3
    expect(new Set([q1, q2])).toEqual(new Set([5, 3]));
  });

  it('throws Error when insufficient total capacity', async () => {
    const { sku, product } = createProduct('TEST-1', [new VariantAttribute('Color', 'Blue')], 100, 1);
    mockProductRepo.findBySku.mockResolvedValue(product);

    const loc1 = new WarehouseLocation(new LocationId('loc-1'), 'WH1', 'standard', 'A01', 'R01', 'S01', 'B01', 500, 5); // fits 5
    mockLocationRepo.findAll.mockResolvedValue([loc1]);

    await expect(suggester.suggestPutaway(sku, 6)).rejects.toThrow(`Insufficient warehouse capacity to put away the entire quantity of 6 units for SKU ${sku.value}.`);
  });
});
