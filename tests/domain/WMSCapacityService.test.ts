import { WarehouseLocation } from '../../src/domain/entities/WarehouseLocation';
import { LocationId } from '../../src/domain/valueObjects/LocationId';
import { Sku } from '../../src/domain/valueObjects/Sku';
import { Product } from '../../src/domain/entities/Product';
import { ProductId } from '../../src/domain/valueObjects/ProductId';
import { VariantAttributeSet } from '../../src/domain/valueObjects/VariantAttributeSet';
import { VariantAttribute } from '../../src/domain/valueObjects/VariantAttribute';
import { ProductVariant } from '../../src/domain/entities/ProductVariant';
import { ProductVariantId } from '../../src/domain/valueObjects/ProductVariantId';
import { InventoryItem } from '../../src/domain/entities/InventoryItem';
import { Quantity } from '../../src/domain/valueObjects/Quantity';
import { CapacityExceededError } from '../../src/domain/exceptions/DomainErrors';
import { WMSCapacityService } from '../../src/domain/services/WMSCapacityService';

import { InMemoryInventoryRepository } from '../../src/infrastructure/persistence/InMemoryInventoryRepository';
import { InMemoryProductRepository } from '../../src/infrastructure/persistence/InMemoryProductRepository';
import { InMemoryWarehouseLocationRepository } from '../../src/infrastructure/persistence/InMemoryWarehouseLocationRepository';

describe('Warehouse Location WMS & Capacity Service', () => {
  const testAttrs = [new VariantAttribute('color', 'blue')];

  function createProductWithVariant(productId: string, skuStr: string, weight: number, volume: number): Product {
    const v = new ProductVariant(
      new ProductVariantId(Math.random().toString()),
      new ProductId(productId),
      new Sku(skuStr),
      new VariantAttributeSet(testAttrs),
      undefined as any,
      weight,
      volume
    );
    const map = new Map<string, ProductVariant>();
    map.set(v.id.value, v);
    return new Product(new ProductId(productId), 'Test Product', map);
  }

  describe('WarehouseLocation Entity', () => {
    it('should parse coordinate paths successfully', () => {
      const loc = WarehouseLocation.parsePath('WH1-ZONEA-A03-R02-S01-B10', 50000, 2.5);
      expect(loc.warehouseId).toBe('WH1');
      expect(loc.zone).toBe('ZONEA');
      expect(loc.aisle).toBe('A03');
      expect(loc.rack).toBe('R02');
      expect(loc.shelf).toBe('S01');
      expect(loc.bin).toBe('B10');
      expect(loc.maxWeightGrams).toBe(50000);
      expect(loc.maxVolumeCubicMeters).toBe(2.5);
    });

    it('should throw error for invalid path length', () => {
      expect(() => WarehouseLocation.parsePath('WH1-ZONEA-A03-R02')).toThrow(
        'Invalid location path format. Expected: WH-ZONE-AISLE-RACK-SHELF-BIN'
      );
    });

    it('should throw error for invalid properties', () => {
      expect(() => new WarehouseLocation(new LocationId('1'), '', 'Z', 'A', 'R', 'S', 'B', 10, 10)).toThrow();
      expect(() => new WarehouseLocation(new LocationId('1'), 'W', 'Z', 'A', 'R', 'S', 'B', -1, 10)).toThrow();
      expect(() => new WarehouseLocation(new LocationId('1'), 'W', 'Z', 'A', 'R', 'S', 'B', 10, 0)).toThrow();
    });
  });

  describe('WMSCapacityService', () => {
    let inventoryRepo: InMemoryInventoryRepository;
    let productRepo: InMemoryProductRepository;
    let locationRepo: InMemoryWarehouseLocationRepository;
    let service: WMSCapacityService;

    beforeEach(() => {
      inventoryRepo = new InMemoryInventoryRepository();
      productRepo = new InMemoryProductRepository();
      locationRepo = new InMemoryWarehouseLocationRepository();
      service = new WMSCapacityService(inventoryRepo, productRepo, locationRepo);
    });

    it('should bypass capacity checks if location is not registered in WMS', async () => {
      await expect(
        service.validateCapacity('WH1-ZONEA-A03-R02-S01-B10', [
          { sku: 'SKU-HEAVY', mode: 'relative', quantity: 99999 }
        ])
      ).resolves.not.toThrow();
    });

    it('should pass capacity check if limits are not breached', async () => {
      const loc = WarehouseLocation.parsePath('WH1-ZONEA-A03-R02-S01-B10', 10000, 1.0);
      await locationRepo.save(loc);

      const product = createProductWithVariant('p1', 'SKU-1', 500, 0.05);
      await productRepo.save(product);

      await expect(
        service.validateCapacity(loc.path, [
          { sku: 'SKU-1', mode: 'relative', quantity: 10 }
        ])
      ).resolves.not.toThrow();
    });

    it('should throw CapacityExceededError if weight limit is breached', async () => {
      const loc = WarehouseLocation.parsePath('WH1-ZONEA-A03-R02-S01-B10', 10000, 5.0);
      await locationRepo.save(loc);

      const product = createProductWithVariant('p1', 'SKU-1', 2000, 0.1);
      await productRepo.save(product);

      await expect(
        service.validateCapacity(loc.path, [
          { sku: 'SKU-1', mode: 'relative', quantity: 6 }
        ])
      ).rejects.toThrow(CapacityExceededError);
    });

    it('should throw CapacityExceededError if volume limit is breached', async () => {
      const loc = WarehouseLocation.parsePath('WH1-ZONEA-A03-R02-S01-B10', 100000, 1.0);
      await locationRepo.save(loc);

      const product = createProductWithVariant('p1', 'SKU-1', 100, 0.3);
      await productRepo.save(product);

      await expect(
        service.validateCapacity(loc.path, [
          { sku: 'SKU-1', mode: 'relative', quantity: 4 }
        ])
      ).rejects.toThrow(CapacityExceededError);
    });

    it('should account for existing inventory items and handle absolute adjustments', async () => {
      const loc = WarehouseLocation.parsePath('WH1-ZONEA-A03-R02-S01-B10', 10000, 1.0);
      await locationRepo.save(loc);

      const product = createProductWithVariant('p1', 'SKU-1', 1000, 0.1);
      await productRepo.save(product);

      const item = new InventoryItem('i1', new Sku('SKU-1'), loc.id, new Quantity(5));
      await inventoryRepo.save(item);

      await expect(
        service.validateCapacity(loc.path, [
          { sku: 'SKU-1', mode: 'relative', quantity: 6 }
        ])
      ).rejects.toThrow(CapacityExceededError);

      await expect(
        service.validateCapacity(loc.path, [
          { sku: 'SKU-1', mode: 'relative', quantity: 4 }
        ])
      ).resolves.not.toThrow();

      await expect(
        service.validateCapacity(loc.path, [
          { sku: 'SKU-1', mode: 'absolute', quantity: 11 }
        ])
      ).rejects.toThrow(CapacityExceededError);

      await expect(
        service.validateCapacity(loc.path, [
          { sku: 'SKU-1', mode: 'absolute', quantity: 9 }
        ])
      ).resolves.not.toThrow();
    });
  });
});
