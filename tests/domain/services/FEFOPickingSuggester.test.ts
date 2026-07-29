import { FEFOPickingSuggester } from '../../../src/domain/services/FEFOPickingSuggester';
import { IInventoryCostLayerRepository } from '../../../src/domain/repositories/IInventoryCostLayerRepository';
import { ILedgerRepository } from '../../../src/domain/repositories/ILedgerRepository';
import { IProductRepository } from '../../../src/domain/repositories/IProductRepository';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { Product } from '../../../src/domain/entities/Product';
import { ProductId } from '../../../src/domain/valueObjects/ProductId';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { InventoryCostLayer, InventoryCostLayerId } from '../../../src/domain/entities/InventoryCostLayer';
import { Lot } from '../../../src/domain/valueObjects/Lot';
import { LedgerEntry } from '../../../src/domain/entities/LedgerEntry';
import { LedgerEntryId } from '../../../src/domain/valueObjects/LedgerEntryId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { ActorId } from '../../../src/domain/valueObjects/ActorId';
import { ReasonCode } from '../../../src/domain/enums/ReasonCode';

describe('FEFOPickingSuggester', () => {
  let mockCostLayers: jest.Mocked<IInventoryCostLayerRepository>;
  let mockLedgerRepo: jest.Mocked<ILedgerRepository>;
  let mockProductRepo: jest.Mocked<IProductRepository>;
  let suggester: FEFOPickingSuggester;

  beforeEach(() => {
    mockCostLayers = {
      save: jest.fn(),
      saveBatch: jest.fn(),
      getActiveLayers: jest.fn(),
      getActiveLayersBatch: jest.fn(),
      findBySerial: jest.fn(),
    };
    mockLedgerRepo = {
      append: jest.fn(),
      appendBatch: jest.fn(),
      currentQuantity: jest.fn(),
      currentQuantities: jest.fn(),
      entriesFor: jest.fn(),
      entriesForBatch: jest.fn(),
      findRecallEntries: jest.fn(),
      currentQuantityAt: jest.fn(),
      hasAnyEntries: jest.fn(),
      hasAnyEntriesBatch: jest.fn(),
    };
    mockProductRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      findBySku: jest.fn(),
      findBySkus: jest.fn(),
      findSkuByVariantId: jest.fn(),
      findSkusByVariantIds: jest.fn(),
      findAll: jest.fn(),
    };
    suggester = new FEFOPickingSuggester(mockCostLayers, mockLedgerRepo, mockProductRepo);
  });

  const createDummyProduct = (skuStr: string) => {
    const product = new Product(new ProductId('prod-1'), 'Test Product');
    product.addVariant(new Sku(skuStr), [{ name: 'Color', value: 'Red' }] as any);
    return product;
  };

  const createLayer = (lotStr: string, expirationDate: Date) => {
    return new InventoryCostLayer(
      new InventoryCostLayerId(`layer-${lotStr}`),
      new ProductVariantId('var-1'),
      100,
      1000,
      new Date(),
      undefined,
      new Lot(lotStr, expirationDate)
    );
  };

  const createEntry = (lotStr: string, locationStr: string, qty: number) => {
    return new LedgerEntry(
      new LedgerEntryId(`entry-${Date.now()}-${Math.random()}`),
      new TenantId('tenant-1'),
      new LocationId(locationStr),
      new ProductVariantId('var-1'),
      qty,
      ReasonCode.PurchaseReceipt,
      new ActorId('actor-1'),
      new Date(),
      undefined,
      { lotNumber: lotStr }
    );
  };

  describe('suggestFefoPicking', () => {
    it('throws error if quantity is <= 0', async () => {
      await expect(suggester.suggestFefoPicking(new Sku('TEST-1'), 0)).rejects.toThrow('Pick quantity must be positive.');
    });

    it('throws error if product is not found', async () => {
      mockProductRepo.findBySku.mockResolvedValue(null);
      await expect(suggester.suggestFefoPicking(new Sku('TEST-1'), 10)).rejects.toThrow('Product variant with SKU TEST-1 not found.');
    });

    it('throws error if variant is not found in product', async () => {
      const product = new Product(new ProductId('prod-1'), 'Test');
      mockProductRepo.findBySku.mockResolvedValue(product);
      await expect(suggester.suggestFefoPicking(new Sku('TEST-1'), 10)).rejects.toThrow('Product variant with SKU TEST-1 not found.');
    });

    it('throws error if no lot-controlled layers found', async () => {
      const sku = new Sku('TEST-1');
      const product = createDummyProduct('TEST-1');
      mockProductRepo.findBySku.mockResolvedValue(product);
      mockCostLayers.getActiveLayers.mockResolvedValue([]);

      await expect(suggester.suggestFefoPicking(sku, 10)).rejects.toThrow('No lot-controlled inventory layers found for SKU TEST-1.');
    });

    it('suggests picking from single location and single lot', async () => {
      const sku = new Sku('TEST-1');
      const product = createDummyProduct('TEST-1');
      mockProductRepo.findBySku.mockResolvedValue(product);

      const layer1 = createLayer('LOT-A', new Date('2024-01-01'));
      mockCostLayers.getActiveLayers.mockResolvedValue([layer1]);

      const entries = [createEntry('LOT-A', 'LOC-1', 50)];
      mockLedgerRepo.entriesFor.mockResolvedValue(entries);

      const suggestions = await suggester.suggestFefoPicking(sku, 20);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toEqual({
        locationId: 'LOC-1',
        lotNumber: 'LOT-A',
        expirationDate: layer1.lot!.expirationDate,
        quantity: 20
      });
    });

    it('prioritizes lots by expiration date (FEFO) and spans multiple locations', async () => {
      const sku = new Sku('TEST-1');
      const product = createDummyProduct('TEST-1');
      mockProductRepo.findBySku.mockResolvedValue(product);

      // Layers returned in FEFO order
      const layerExpiringSoon = createLayer('LOT-SOON', new Date('2024-01-01'));
      const layerExpiringLate = createLayer('LOT-LATE', new Date('2024-12-31'));
      mockCostLayers.getActiveLayers.mockResolvedValue([layerExpiringSoon, layerExpiringLate]);

      const entries = [
        createEntry('LOT-SOON', 'LOC-1', 10), // Lot soon has 10 at LOC-1
        createEntry('LOT-SOON', 'LOC-2', 5),  // Lot soon has 5 at LOC-2
        createEntry('LOT-LATE', 'LOC-2', 20)  // Lot late has 20 at LOC-2
      ];
      mockLedgerRepo.entriesFor.mockResolvedValue(entries);

      // Need 25 total. Should take 10 from LOT-SOON LOC-1, 5 from LOT-SOON LOC-2, and 10 from LOT-LATE LOC-2
      const suggestions = await suggester.suggestFefoPicking(sku, 25);

      expect(suggestions).toHaveLength(3);

      expect(suggestions[0]).toEqual(expect.objectContaining({ lotNumber: 'LOT-SOON', locationId: 'LOC-1', quantity: 10 }));
      expect(suggestions[1]).toEqual(expect.objectContaining({ lotNumber: 'LOT-SOON', locationId: 'LOC-2', quantity: 5 }));
      expect(suggestions[2]).toEqual(expect.objectContaining({ lotNumber: 'LOT-LATE', locationId: 'LOC-2', quantity: 10 }));
    });

    it('ignores locations with zero or negative balances for a lot', async () => {
      const sku = new Sku('TEST-1');
      const product = createDummyProduct('TEST-1');
      mockProductRepo.findBySku.mockResolvedValue(product);

      const layer1 = createLayer('LOT-A', new Date('2024-01-01'));
      mockCostLayers.getActiveLayers.mockResolvedValue([layer1]);

      const entries = [
        createEntry('LOT-A', 'LOC-1', 20),
        createEntry('LOT-A', 'LOC-1', -20), // Net 0 for LOC-1
        createEntry('LOT-A', 'LOC-2', 15)   // Net 15 for LOC-2
      ];
      mockLedgerRepo.entriesFor.mockResolvedValue(entries);

      const suggestions = await suggester.suggestFefoPicking(sku, 10);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toEqual(expect.objectContaining({ locationId: 'LOC-2', quantity: 10 }));
    });

    it('throws error if insufficient inventory available', async () => {
      const sku = new Sku('TEST-1');
      const product = createDummyProduct('TEST-1');
      mockProductRepo.findBySku.mockResolvedValue(product);

      const layer1 = createLayer('LOT-A', new Date('2024-01-01'));
      mockCostLayers.getActiveLayers.mockResolvedValue([layer1]);

      const entries = [createEntry('LOT-A', 'LOC-1', 10)];
      mockLedgerRepo.entriesFor.mockResolvedValue(entries);

      // Request 15, but only 10 available
      await expect(suggester.suggestFefoPicking(sku, 15)).rejects.toThrow('Insufficient lot-controlled inventory available to pick 15 units for SKU TEST-1 (Missing: 5).');
    });

    it('skips layers with missing balances for the lot completely', async () => {
      const sku = new Sku('TEST-1');
      const product = createDummyProduct('TEST-1');
      mockProductRepo.findBySku.mockResolvedValue(product);

      const layer1 = createLayer('LOT-GHOST', new Date('2024-01-01')); // Active layer, no ledger entries
      const layer2 = createLayer('LOT-REAL', new Date('2024-02-01'));
      mockCostLayers.getActiveLayers.mockResolvedValue([layer1, layer2]);

      const entries = [createEntry('LOT-REAL', 'LOC-1', 10)];
      mockLedgerRepo.entriesFor.mockResolvedValue(entries);

      const suggestions = await suggester.suggestFefoPicking(sku, 10);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toEqual(expect.objectContaining({ lotNumber: 'LOT-REAL', quantity: 10 }));
    });
  });
});
