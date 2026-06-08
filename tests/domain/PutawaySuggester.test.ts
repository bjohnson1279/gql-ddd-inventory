import { PutawaySuggester } from '../../src/domain/services/PutawaySuggester';
import { InMemoryInventoryRepository } from '../../src/infrastructure/persistence/InMemoryInventoryRepository';
import { InMemoryProductRepository } from '../../src/infrastructure/persistence/InMemoryProductRepository';
import { InMemoryWarehouseLocationRepository } from '../../src/infrastructure/persistence/InMemoryWarehouseLocationRepository';
import { Product } from '../../src/domain/entities/Product';
import { ProductId } from '../../src/domain/valueObjects/ProductId';
import { Sku } from '../../src/domain/valueObjects/Sku';
import { VariantAttribute } from '../../src/domain/valueObjects/VariantAttribute';
import { WarehouseLocation } from '../../src/domain/entities/WarehouseLocation';
import { LocationId } from '../../src/domain/valueObjects/LocationId';
import { InventoryItem } from '../../src/domain/entities/InventoryItem';
import { Quantity } from '../../src/domain/valueObjects/Quantity';

describe('PutawaySuggester', () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let productRepo: InMemoryProductRepository;
  let locationRepo: InMemoryWarehouseLocationRepository;
  let suggester: PutawaySuggester;

  beforeEach(() => {
    inventoryRepo = new InMemoryInventoryRepository();
    productRepo = new InMemoryProductRepository();
    locationRepo = new InMemoryWarehouseLocationRepository();
    suggester = new PutawaySuggester(inventoryRepo, productRepo, locationRepo);
  });

  it('should recommend a location that has enough capacity and matches attributes', async () => {
    // 1. Setup product & variant
    const product = new Product(new ProductId('prod-1'), 'Test Product');
    const variant = product.addVariant(
      new Sku('TEST-SKU'),
      [
        new VariantAttribute('temperatureZone', 'cold'),
        new VariantAttribute('color', 'red')
      ]
    );
    // Set weights and volumes
    (variant as any).weightGrams = 100;
    (variant as any).volumeCubicMeters = 0.1;
    await productRepo.save(product);

    // 2. Setup warehouse locations (one cold, one ambient)
    const coldLoc = WarehouseLocation.parsePath('WH1-COLD-A01-R01-S01-B01', 500, 0.5); // capacity weight=500g, vol=0.5m^3
    const ambientLoc = WarehouseLocation.parsePath('WH1-AMBIENT-A01-R01-S01-B01', 500, 0.5);
    await locationRepo.save(coldLoc);
    await locationRepo.save(ambientLoc);

    // 3. Request suggestion for 3 items (total 300g, 0.3m^3)
    const recs = await suggester.suggestPutaway(new Sku('TEST-SKU'), 3);
    
    expect(recs).toHaveLength(1);
    expect(recs[0].locationId).toBe('WH1-COLD-A01-R01-S01-B01');
    expect(recs[0].quantity).toBe(3);
    expect(recs[0].remainingWeightGrams).toBe(200); // 500 - 300
    expect(recs[0].remainingVolumeCubicMeters).toBeCloseTo(0.2, 5); // 0.5 - 0.3
  });

  it('should throw an error if total capacity is insufficient', async () => {
    const product = new Product(new ProductId('prod-1'), 'Test Product');
    const variant = product.addVariant(new Sku('TEST-SKU'), [new VariantAttribute('color', 'blue')]);
    (variant as any).weightGrams = 200;
    (variant as any).volumeCubicMeters = 0.2;
    await productRepo.save(product);

    const loc = WarehouseLocation.parsePath('WH1-ZONEA-A01-R01-S01-B01', 300, 0.3);
    await locationRepo.save(loc);

    // Requires 2 items (total 400g, 0.4m^3) but location can only fit 1
    await expect(suggester.suggestPutaway(new Sku('TEST-SKU'), 2))
      .rejects.toThrow('Insufficient warehouse capacity to put away the entire quantity');
  });

  it('should split recommendations across multiple locations if single location capacity is exceeded', async () => {
    const product = new Product(new ProductId('prod-1'), 'Test Product');
    const variant = product.addVariant(new Sku('TEST-SKU'), [new VariantAttribute('color', 'blue')]);
    (variant as any).weightGrams = 100;
    (variant as any).volumeCubicMeters = 0.1;
    await productRepo.save(product);

    const loc1 = WarehouseLocation.parsePath('WH1-ZONEA-A01-R01-S01-B01', 250, 0.25); // can fit 2 items
    const loc2 = WarehouseLocation.parsePath('WH1-ZONEA-A01-R01-S01-B02', 300, 0.3);  // can fit 3 items
    await locationRepo.save(loc1);
    await locationRepo.save(loc2);

    // Request suggestion for 4 items
    const recs = await suggester.suggestPutaway(new Sku('TEST-SKU'), 4);

    expect(recs).toHaveLength(2);
    const totalQty = recs.reduce((sum, r) => sum + r.quantity, 0);
    expect(totalQty).toBe(4);
    expect(recs[0].quantity).toBe(3); // First candidate loc2 (higher score/capacity)
    expect(recs[1].quantity).toBe(1); // Second candidate loc1
  });

  it('should respect hazardClass matching and avoid HAZMAT for non-hazmat items', async () => {
    // Hazmat item
    const hazProduct = new Product(new ProductId('p-haz'), 'Chemical');
    const hazVariant = hazProduct.addVariant(new Sku('HAZ-SKU'), [new VariantAttribute('hazardClass', 'flammable')]);
    await productRepo.save(hazProduct);

    // Normal item
    const normalProduct = new Product(new ProductId('p-norm'), 'Soda');
    const normalVariant = normalProduct.addVariant(new Sku('NORM-SKU'), [new VariantAttribute('color', 'black')]);
    await productRepo.save(normalProduct);

    const hazLoc = WarehouseLocation.parsePath('WH1-HAZMAT-A01-R01-S01-B01', 1000, 1.0);
    const standardLoc = WarehouseLocation.parsePath('WH1-FAST-A01-R01-S01-B01', 1000, 1.0);
    await locationRepo.save(hazLoc);
    await locationRepo.save(standardLoc);

    // Hazmat item should go to hazmat location
    const hazRecs = await suggester.suggestPutaway(new Sku('HAZ-SKU'), 1);
    expect(hazRecs[0].locationId).toBe('WH1-HAZMAT-A01-R01-S01-B01');

    // Normal item should go to standard location, NOT hazmat
    const normRecs = await suggester.suggestPutaway(new Sku('NORM-SKU'), 1);
    expect(normRecs[0].locationId).toBe('WH1-FAST-A01-R01-S01-B01');
  });

  it('should prioritize FAST zone and lower aisles for fast-moving items', async () => {
    const product = new Product(new ProductId('prod-1'), 'Hot Item');
    const variant = product.addVariant(new Sku('FAST-SKU'), [new VariantAttribute('velocity', 'fast-moving')]);
    await productRepo.save(product);

    const farLoc = WarehouseLocation.parsePath('WH1-SLOW-A10-R01-S01-B01', 1000, 1.0);
    const fastLoc = WarehouseLocation.parsePath('WH1-FAST-A01-R01-S01-B01', 1000, 1.0);
    await locationRepo.save(farLoc);
    await locationRepo.save(fastLoc);

    const recs = await suggester.suggestPutaway(new Sku('FAST-SKU'), 1);
    expect(recs[0].locationId).toBe('WH1-FAST-A01-R01-S01-B01');
  });
});
