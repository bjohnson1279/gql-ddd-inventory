import { VariantAttribute } from './src/domain/valueObjects/VariantAttribute';
import { AssembleKitUseCase } from './src/application/useCases/ManageKits';
import { IKitRepository } from './src/domain/repositories/IKitRepository';
import { IProductRepository } from './src/domain/repositories/IProductRepository';
import { ILedgerRepository } from './src/domain/repositories/ILedgerRepository';
import { IJournalRepository } from './src/domain/repositories/IJournalRepository';
import { IInventoryCostLayerRepository } from './src/domain/repositories/IInventoryCostLayerRepository';
import { ProductVariantId } from './src/domain/valueObjects/ProductVariantId';
import { InventoryCostLayer, InventoryCostLayerId } from './src/domain/entities/InventoryCostLayer';
import { Kit } from './src/domain/entities/Kit';
import { KitId } from './src/domain/valueObjects/KitId';
import { Sku } from './src/domain/valueObjects/Sku';
import { Product } from './src/domain/entities/Product';
import { ProductId } from './src/domain/valueObjects/ProductId';

class MockLayerRepo implements IInventoryCostLayerRepository {
  public layers: Record<string, InventoryCostLayer[]> = {};

  async save(layer: InventoryCostLayer): Promise<void> {
    const existing = this.layers[layer.variantId.value] || [];
    const index = existing.findIndex(l => l.id.equals(layer.id));
    if (index >= 0) {
      existing[index] = layer;
    } else {
      existing.push(layer);
    }
    this.layers[layer.variantId.value] = existing;
    await new Promise(r => setTimeout(r, 2)); // Simulate DB delay
  }

  async getActiveLayers(variantId: ProductVariantId, orderBy?: string): Promise<InventoryCostLayer[]> {
    await new Promise(r => setTimeout(r, 2)); // Simulate DB delay
    return this.layers[variantId.value] || [];
  }

  async saveMany(layers: InventoryCostLayer[]): Promise<void> {}
  async getActiveLayersBatch(variantIds: ProductVariantId[], orderBy?: string): Promise<Map<string, InventoryCostLayer[]>> {
    const map = new Map();
    for (const v of variantIds) {
      map.set(v.value, this.layers[v.value] || []);
    }
    return map;
  }
  async findBySerial(): Promise<any> { return null; }
}

async function runBenchmark() {
  const costLayers = new MockLayerRepo();

  // Create 100 components
  const components = Array.from({ length: 100 }).map((_, i) => ({
    variantId: new ProductVariantId(`V-${i}`),
    quantity: 2
  }));

  for (const comp of components) {
    const layer = new InventoryCostLayer(
      new InventoryCostLayerId(`L-${comp.variantId.value}`),
      comp.variantId,
      1000,
      10,
      new Date()
    );
    costLayers.layers[comp.variantId.value] = [layer];
  }

  const kitSkuStr = 'BENCH-KIT';
  const kitVariantId = new ProductVariantId('V-KIT');
  const kit = new Kit(new KitId('K1'), new Sku(kitSkuStr), 'Bench Kit');
  for (const comp of components) {
    kit.addComponent(comp.variantId, comp.quantity);
  }

  const kitProduct = new Product(new ProductId('P-KIT'), 'Bench Kit Product');
  const kitVariant = kitProduct.addVariant(new Sku(kitSkuStr), [new VariantAttribute('type', 'bundle')]);
  Reflect.set(kitVariant, "id", kitVariantId); // Override for simplicity

  const kitRepo = { findBySku: async () => kit } as unknown as IKitRepository;
  const productRepo = { findBySku: async () => kitProduct } as unknown as IProductRepository;
  const ledgerRepo = {
    currentQuantity: async () => 1000,
    append: async () => {}
  } as unknown as ILedgerRepository;
  const journalRepo = { save: async () => {} } as unknown as IJournalRepository;

  const useCase = new AssembleKitUseCase(kitRepo, productRepo, ledgerRepo, costLayers, journalRepo);

  const start = Date.now();
  await useCase.execute({
    tenantId: 'T1',
    locationId: 'L1',
    kitSku: kitSkuStr,
    quantity: 1,
    actorId: 'A1',
    referenceId: 'REF1'
  });
  const end = Date.now();

  console.log(`AssembleKitUseCase (100 components) execution time: ${end - start}ms`);
}

runBenchmark().catch(console.error);
