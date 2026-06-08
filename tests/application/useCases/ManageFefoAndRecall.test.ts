import {
  UpdateVariantCostingMethodUseCase,
  ReceiveStockWithLotUseCase,
  SuggestFefoPickingUseCase,
  TraceProductRecallUseCase
} from '../../../src/application/useCases/ManageFefoAndRecall';
import { FEFOPickingSuggester } from '../../../src/domain/services/FEFOPickingSuggester';
import { ProductRecallService } from '../../../src/domain/services/ProductRecallService';
import { InMemoryInventoryRepository } from '../../../src/infrastructure/persistence/InMemoryInventoryRepository';
import { InMemoryProductRepository } from '../../../src/infrastructure/persistence/InMemoryProductRepository';
import { InMemoryLedgerRepository } from '../../../src/infrastructure/persistence/InMemoryLedgerRepository';
import { IInventoryCostLayerRepository } from '../../../src/domain/repositories/IInventoryCostLayerRepository';
import { InventoryCostLayer, InventoryCostLayerId } from '../../../src/domain/entities/InventoryCostLayer';
import { Product } from '../../../src/domain/entities/Product';
import { ProductId } from '../../../src/domain/valueObjects/ProductId';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { CostingMethod } from '../../../src/domain/enums/AccountingEnums';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { SerialNumber } from '../../../src/domain/valueObjects/SerialNumber';
import { VariantAttribute } from '../../../src/domain/valueObjects/VariantAttribute';

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

describe('ManageFefoAndRecall Use Cases', () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let productRepo: InMemoryProductRepository;
  let ledgerRepo: InMemoryLedgerRepository;
  let costLayerRepo: InMemoryInventoryCostLayerRepository;

  beforeEach(() => {
    inventoryRepo = new InMemoryInventoryRepository();
    productRepo = new InMemoryProductRepository();
    ledgerRepo = new InMemoryLedgerRepository();
    costLayerRepo = new InMemoryInventoryCostLayerRepository();
  });

  it('should update costing method on product variant', async () => {
    const product = new Product(new ProductId('prod-1'), 'Product A');
    const variant = product.addVariant(new Sku('SKU-1'), [new VariantAttribute('size', 'standard')]);
    expect(variant.costingMethod).toBe(CostingMethod.FIFO);
    await productRepo.save(product);

    const useCase = new UpdateVariantCostingMethodUseCase(productRepo);
    const updated = await useCase.execute('SKU-1', CostingMethod.FEFO);
    expect(updated.costingMethod).toBe(CostingMethod.FEFO);

    const reloadedProduct = await productRepo.findById(product.id);
    expect(reloadedProduct?.variants[0].costingMethod).toBe(CostingMethod.FEFO);
  });

  it('should receive stock with a lot and generate a cost layer and ledger entry', async () => {
    const product = new Product(new ProductId('prod-1'), 'Product A');
    const variant = product.addVariant(new Sku('SKU-1'), [new VariantAttribute('size', 'standard')]);
    await productRepo.save(product);

    const useCase = new ReceiveStockWithLotUseCase(
      inventoryRepo,
      productRepo,
      ledgerRepo,
      costLayerRepo
    );

    const expiry = new Date('2026-12-31T00:00:00Z');
    const success = await useCase.execute({
      sku: 'SKU-1',
      locationId: 'LOC-A',
      quantity: 50,
      unitCostCents: 1500,
      lotNumber: 'LOT-XYZ',
      expirationDate: expiry,
      tenantId: 'tenant-1',
      actorId: 'user-1'
    });

    expect(success).toBe(true);

    // Verify inventory level
    const invItem = await inventoryRepo.findBySkuAndLocation('SKU-1', 'LOC-A');
    expect(invItem).not.toBeNull();
    expect(invItem?.quantity.value).toBe(50);

    // Verify ledger entry
    const entries = await ledgerRepo.entriesFor(variant.id);
    expect(entries).toHaveLength(1);
    expect(entries[0].quantity).toBe(50);
    expect(entries[0].metadata).toEqual({
      lotNumber: 'LOT-XYZ',
      expirationDate: expiry.toISOString()
    });

    // Verify cost layer
    const activeLayers = await costLayerRepo.getActiveLayers(variant.id);
    expect(activeLayers).toHaveLength(1);
    expect(activeLayers[0].initialQuantity).toBe(50);
    expect(activeLayers[0].unitCostCents).toBe(1500);
    expect(activeLayers[0].lot?.lotNumber).toBe('LOT-XYZ');
  });

  it('should suggest picking and trace recall', async () => {
    const product = new Product(new ProductId('prod-1'), 'Product A');
    const variant = product.addVariant(new Sku('SKU-1'), [new VariantAttribute('size', 'standard')]);
    await productRepo.save(product);

    const receiveUseCase = new ReceiveStockWithLotUseCase(
      inventoryRepo,
      productRepo,
      ledgerRepo,
      costLayerRepo
    );

    const expiry = new Date('2026-12-31T00:00:00Z');
    await receiveUseCase.execute({
      sku: 'SKU-1',
      locationId: 'LOC-A',
      quantity: 50,
      unitCostCents: 1500,
      lotNumber: 'LOT-XYZ',
      expirationDate: expiry,
      tenantId: 'tenant-1',
      actorId: 'user-1'
    });

    // Suggest FEFO picking
    const picker = new FEFOPickingSuggester(costLayerRepo, ledgerRepo, productRepo);
    const pickingUseCase = new SuggestFefoPickingUseCase(picker);
    const suggestions = await pickingUseCase.execute('SKU-1', 20);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].lotNumber).toBe('LOT-XYZ');
    expect(suggestions[0].quantity).toBe(20);

    // Trace recall
    const recallService = new ProductRecallService(ledgerRepo);
    const recallUseCase = new TraceProductRecallUseCase(recallService);
    
    // Create a dispatch ledger entry to simulate order fullfilment of the bad lot
    const { LedgerEntry } = require('../../../src/domain/entities/LedgerEntry');
    const { LedgerEntryId } = require('../../../src/domain/valueObjects/LedgerEntryId');
    const { TenantId } = require('../../../src/domain/valueObjects/TenantId');
    const { LocationId } = require('../../../src/domain/valueObjects/LocationId');
    const { ActorId } = require('../../../src/domain/valueObjects/ActorId');
    const { ReasonCode } = require('../../../src/domain/enums/ReasonCode');

    await ledgerRepo.append(new LedgerEntry(
      new LedgerEntryId('l-dispatch'),
      new TenantId('tenant-1'),
      new LocationId('LOC-A'),
      variant.id,
      -10,
      ReasonCode.Sale,
      new ActorId('user-1'),
      new Date(),
      'REF-123',
      { lotNumber: 'LOT-XYZ' }
    ));

    const dispatches = await recallUseCase.execute('LOT-XYZ');
    expect(dispatches).toHaveLength(1);
    expect(dispatches[0].quantity).toBe(10);
    expect(dispatches[0].locationId).toBe('LOC-A');
  });
});
