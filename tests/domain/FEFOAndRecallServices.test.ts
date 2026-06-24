import { FEFOPickingSuggester } from '../../src/domain/services/FEFOPickingSuggester';
import { ProductRecallService } from '../../src/domain/services/ProductRecallService';
import { InMemoryLedgerRepository } from '../../src/infrastructure/persistence/InMemoryLedgerRepository';
import { InMemoryProductRepository } from '../../src/infrastructure/persistence/InMemoryProductRepository';
import { IInventoryCostLayerRepository } from '../../src/domain/repositories/IInventoryCostLayerRepository';
import { InventoryCostLayer, InventoryCostLayerId } from '../../src/domain/entities/InventoryCostLayer';
import { Product } from '../../src/domain/entities/Product';
import { ProductId } from '../../src/domain/valueObjects/ProductId';
import { ProductVariantId } from '../../src/domain/valueObjects/ProductVariantId';
import { Sku } from '../../src/domain/valueObjects/Sku';
import { SerialNumber } from '../../src/domain/valueObjects/SerialNumber';
import { Lot } from '../../src/domain/valueObjects/Lot';
import { LedgerEntry } from '../../src/domain/entities/LedgerEntry';
import { LedgerEntryId } from '../../src/domain/valueObjects/LedgerEntryId';
import { TenantId } from '../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../src/domain/valueObjects/LocationId';
import { ActorId } from '../../src/domain/valueObjects/ActorId';
import { ReasonCode } from '../../src/domain/enums/ReasonCode';
import { VariantAttribute } from '../../src/domain/valueObjects/VariantAttribute';

class InMemoryInventoryCostLayerRepository implements IInventoryCostLayerRepository {
  private layers: InventoryCostLayer[] = [];

  async save(layer: InventoryCostLayer): Promise<void> {
    const idx = this.layers.findIndex(l => l.id.equals(layer.id));
    if (idx !== -1) {
      this.layers[idx] = layer;
    } else {
      this.layers.push(layer);
    }
  }

  async saveBatch(layers: InventoryCostLayer[]): Promise<void> {
    for (const l of layers) {
      await this.save(l);
    }
  }

  async getActiveLayers(variantId: ProductVariantId, orderBy?: string): Promise<InventoryCostLayer[]> {
    const filtered = this.layers.filter(l => l.variantId.equals(variantId) && l.consumedQuantity < l.initialQuantity);
    
    const isExpiration = orderBy?.toLowerCase().includes('expiration');
    const orderDirection = orderBy?.toLowerCase().includes('desc') ? 'desc' : 'asc';
    
    return filtered.sort((a, b) => {
      if (isExpiration) {
        const expA = a.lot?.expirationDate?.getTime() || Infinity;
        const expB = b.lot?.expirationDate?.getTime() || Infinity;
        if (expA !== expB) {
          return orderDirection === 'desc' ? expB - expA : expA - expB;
        }
      }
      const timeA = a.receivedAt.getTime();
      const timeB = b.receivedAt.getTime();
      return orderDirection === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }

  async getActiveLayersBatch(variantIds: ProductVariantId[], orderBy?: string): Promise<Map<string, InventoryCostLayer[]>> {
    const result = new Map<string, InventoryCostLayer[]>();
    for (const id of variantIds) {
      result.set(id.value, await this.getActiveLayers(id, orderBy));
    }
    return result;
  }

  async findBySerial(variantId: ProductVariantId, serialNumber: SerialNumber): Promise<InventoryCostLayer | null> {
    return this.layers.find(l => l.variantId.equals(variantId) && l.serialNumber?.equals(serialNumber)) || null;
  }
}

describe('FEFO picking and Product Recall Domain Services', () => {
  const tenantId = new TenantId('T1');
  const actorId = new ActorId('U1');
  const sku = new Sku('SKU-LOT');
  
  let productRepo: InMemoryProductRepository;
  let ledgerRepo: InMemoryLedgerRepository;
  let costLayerRepo: InMemoryInventoryCostLayerRepository;
  let variantId: ProductVariantId;

  beforeEach(async () => {
    productRepo = new InMemoryProductRepository();
    ledgerRepo = new InMemoryLedgerRepository();
    costLayerRepo = new InMemoryInventoryCostLayerRepository();

    const product = new Product(new ProductId('prod-1'), 'Lot Managed Product');
    const variant = product.addVariant(sku, [new VariantAttribute('size', 'standard')]);
    variantId = variant.id;
    await productRepo.save(product);
  });

  describe('FEFOPickingSuggester', () => {
    it('should throw error for non-positive pick quantity', async () => {
      const suggester = new FEFOPickingSuggester(costLayerRepo, ledgerRepo, productRepo);
      await expect(suggester.suggestFefoPicking(sku, 0)).rejects.toThrow('Pick quantity must be positive.');
    });

    it('should throw error if SKU not found', async () => {
      const suggester = new FEFOPickingSuggester(costLayerRepo, ledgerRepo, productRepo);
      await expect(suggester.suggestFefoPicking(new Sku('UNKNOWN'), 5)).rejects.toThrow('Product variant with SKU UNKNOWN not found.');
    });

    it('should throw error if there are no lot-controlled inventory layers', async () => {
      const suggester = new FEFOPickingSuggester(costLayerRepo, ledgerRepo, productRepo);
      await expect(suggester.suggestFefoPicking(sku, 5)).rejects.toThrow('No lot-controlled inventory layers found for SKU SKU-LOT.');
    });

    it('should suggest locations and lots based on earliest expiration date', async () => {
      const dateFar = new Date('2026-12-31');
      const dateSoon = new Date('2026-06-30');

      // Create active cost layers
      const layer1 = new InventoryCostLayer(new InventoryCostLayerId('c1'), variantId, 10, 100, new Date('2026-06-01'), undefined, new Lot('LOT-FAR', dateFar));
      const layer2 = new InventoryCostLayer(new InventoryCostLayerId('c2'), variantId, 15, 120, new Date('2026-06-02'), undefined, new Lot('LOT-SOON', dateSoon));
      await costLayerRepo.save(layer1);
      await costLayerRepo.save(layer2);

      // Ledger receipts and balances
      await ledgerRepo.append(new LedgerEntry(
        new LedgerEntryId('l1'), tenantId, new LocationId('LOC-A'), variantId, 10, ReasonCode.PurchaseReceipt, actorId, new Date(), undefined, { lotNumber: 'LOT-FAR' }
      ));
      await ledgerRepo.append(new LedgerEntry(
        new LedgerEntryId('l2'), tenantId, new LocationId('LOC-B'), variantId, 15, ReasonCode.PurchaseReceipt, actorId, new Date(), undefined, { lotNumber: 'LOT-SOON' }
      ));

      const suggester = new FEFOPickingSuggester(costLayerRepo, ledgerRepo, productRepo);
      
      // Pick 18: should pick all 15 of LOT-SOON at LOC-B, and then 3 of LOT-FAR at LOC-A
      const suggestions = await suggester.suggestFefoPicking(sku, 18);
      expect(suggestions).toHaveLength(2);
      
      expect(suggestions[0]).toEqual({
        locationId: 'LOC-B',
        lotNumber: 'LOT-SOON',
        expirationDate: dateSoon,
        quantity: 15
      });
      expect(suggestions[1]).toEqual({
        locationId: 'LOC-A',
        lotNumber: 'LOT-FAR',
        expirationDate: dateFar,
        quantity: 3
      });
    });

    it('should throw error when insufficient stock is available', async () => {
      const dateSoon = new Date('2026-06-30');
      const layer = new InventoryCostLayer(new InventoryCostLayerId('c1'), variantId, 5, 100, new Date(), undefined, new Lot('LOT-1', dateSoon));
      await costLayerRepo.save(layer);

      await ledgerRepo.append(new LedgerEntry(
        new LedgerEntryId('l1'), tenantId, new LocationId('LOC-A'), variantId, 5, ReasonCode.PurchaseReceipt, actorId, new Date(), undefined, { lotNumber: 'LOT-1' }
      ));

      const suggester = new FEFOPickingSuggester(costLayerRepo, ledgerRepo, productRepo);
      await expect(suggester.suggestFefoPicking(sku, 10)).rejects.toThrow('Insufficient lot-controlled inventory available to pick 10 units for SKU SKU-LOT (Missing: 5).');
    });
  });

  describe('ProductRecallService', () => {
    it('should throw error for empty lot number', async () => {
      const service = new ProductRecallService(ledgerRepo);
      await expect(service.traceProductRecall('')).rejects.toThrow('Lot number cannot be empty.');
    });

    it('should throw error for empty lot number (whitespace)', async () => {
      const service = new ProductRecallService(ledgerRepo);
      await expect(service.traceProductRecall('   ')).rejects.toThrow('Lot number cannot be empty.');
    });

    it('should return an empty array if no recall entries are found', async () => {
      const service = new ProductRecallService(ledgerRepo);
      // Mock the repository by relying on the InMemoryLedgerRepository's behavior
      // when no entries match the lot number, it returns an empty array implicitly.
      const dispatches = await service.traceProductRecall('NON-EXISTENT-LOT');
      expect(dispatches).toEqual([]);
    });

    it('should trace only dispatch/deduction ledger entries carrying the lot number', async () => {
      // Append a purchase receipt (positive quantity)
      await ledgerRepo.append(new LedgerEntry(
        new LedgerEntryId('l1'), tenantId, new LocationId('LOC-A'), variantId, 100, ReasonCode.PurchaseReceipt, actorId, new Date(), undefined, { lotNumber: 'BAD-LOT' }
      ));
      
      // Append some dispatches (negative quantity)
      const dispatchDate = new Date('2026-06-05T12:00:00Z');
      await ledgerRepo.append(new LedgerEntry(
        new LedgerEntryId('l2'), tenantId, new LocationId('LOC-A'), variantId, -25, ReasonCode.Sale, actorId, dispatchDate, 'REF-ORDER-1', { lotNumber: 'BAD-LOT' }
      ));
      await ledgerRepo.append(new LedgerEntry(
        new LedgerEntryId('l3'), tenantId, new LocationId('LOC-B'), variantId, -10, ReasonCode.Sale, actorId, dispatchDate, 'REF-ORDER-2', { lotNumber: 'BAD-LOT' }
      ));
      
      // Another lot number
      await ledgerRepo.append(new LedgerEntry(
        new LedgerEntryId('l4'), tenantId, new LocationId('LOC-A'), variantId, -5, ReasonCode.Sale, actorId, dispatchDate, 'REF-ORDER-3', { lotNumber: 'GOOD-LOT' }
      ));

      const service = new ProductRecallService(ledgerRepo);
      const dispatches = await service.traceProductRecall('BAD-LOT');
      
      expect(dispatches).toHaveLength(2);
      expect(dispatches).toContainEqual({
        ledgerEntryId: 'l2',
        locationId: 'LOC-A',
        quantity: 25,
        referenceId: 'REF-ORDER-1',
        occurredAt: dispatchDate,
        actorId: 'U1'
      });
      expect(dispatches).toContainEqual({
        ledgerEntryId: 'l3',
        locationId: 'LOC-B',
        quantity: 10,
        referenceId: 'REF-ORDER-2',
        occurredAt: dispatchDate,
        actorId: 'U1'
      });
    });
  });
});
