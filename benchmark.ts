import { CostLayerService } from './src/domain/services/CostLayerService';
import { ProductVariantId } from './src/domain/valueObjects/ProductVariantId';
import { InventoryCostLayer, InventoryCostLayerId } from './src/domain/entities/InventoryCostLayer';
import { IInventoryCostLayerRepository } from './src/domain/repositories/IInventoryCostLayerRepository';
import { SerialNumber } from './src/domain/valueObjects/SerialNumber';
import { CostBreakdown } from './src/domain/valueObjects/CostBreakdown';

class MockRepo implements IInventoryCostLayerRepository {
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
    await new Promise(r => setTimeout(r, 2));
  }

  async saveBatch(layers: InventoryCostLayer[]): Promise<void> {
    for (const layer of layers) {
      const existing = this.layers[layer.variantId.value] || [];
      const index = existing.findIndex(l => l.id.equals(layer.id));
      if (index >= 0) {
        existing[index] = layer;
      } else {
        existing.push(layer);
      }
      this.layers[layer.variantId.value] = existing;
    }
    // Batch save simulated to be faster than N saves
    await new Promise(r => setTimeout(r, 5));
  }

  async getActiveLayers(variantId: ProductVariantId, orderBy?: string): Promise<InventoryCostLayer[]> {
    await new Promise(r => setTimeout(r, 2));
    return this.layers[variantId.value] || [];
  }

  async getActiveLayersBatch(variantIds: ProductVariantId[], orderBy?: string): Promise<Map<string, InventoryCostLayer[]>> {
    await new Promise(r => setTimeout(r, 5));
    const map = new Map();
    for (const v of variantIds) {
      map.set(v.value, this.layers[v.value] || []);
    }
    return map;
  }

  async findBySerial(variantId: ProductVariantId, serialNumber: SerialNumber): Promise<InventoryCostLayer | null> {
    return null;
  }
}

// Monkey-patch CostLayerService for benchmark test
(CostLayerService.prototype as any).consumeFifoLayersBatch = async function(
    items: { variantId: ProductVariantId; quantity: number }[]
  ): Promise<{ breakdowns: Map<string, CostBreakdown>; totalCostCents: number }> {
    let activeLayersMap: Map<string, InventoryCostLayer[]>;
    if (this.layers.getActiveLayersBatch) {
      activeLayersMap = await this.layers.getActiveLayersBatch(items.map((i: any) => i.variantId), 'received_at ASC');
    } else {
      activeLayersMap = new Map();
      await Promise.all(items.map(async (item: any) => {
        const layers = await this.layers.getActiveLayers(item.variantId, 'received_at ASC');
        activeLayersMap.set(item.variantId.value, layers);
      }));
    }

    let totalCostCents = 0;
    const breakdowns = new Map<string, CostBreakdown>();
    const layersToSave: InventoryCostLayer[] = [];

    for (const item of items) {
      const layers = activeLayersMap.get(item.variantId.value) || [];
      const breakdown = this.calculateConsumedCost(layers, item.quantity, true);
      breakdowns.set(item.variantId.value, breakdown);
      totalCostCents += breakdown.totalCostCents;
      layersToSave.push(...layers);
    }

    await this.layers.saveBatch(layersToSave);

    return { breakdowns, totalCostCents };
  };


async function runBenchmark() {
  const repo1 = new MockRepo();
  const service1 = new CostLayerService(repo1);

  const variants = Array.from({ length: 50 }).map((_, i) => new ProductVariantId(`V-${i}`));

  for (const v of variants) {
    const layer = new InventoryCostLayer(
      new InventoryCostLayerId(`L-${v.value}`),
      v,
      100,
      10,
      new Date()
    );
    await repo1.save(layer);
  }

  const startSeq = Date.now();
  for (const v of variants) {
    await service1.consumeFifoLayers(v, 1);
  }
  const endSeq = Date.now();
  console.log(`Time taken sequentially: ${endSeq - startSeq}ms`);

  const repo2 = new MockRepo();
  const service2 = new CostLayerService(repo2);
  for (const v of variants) {
    const layer = new InventoryCostLayer(
      new InventoryCostLayerId(`L-${v.value}`),
      v,
      100,
      10,
      new Date()
    );
    await repo2.save(layer);
  }

  const startBatch = Date.now();
  const batchItems = variants.map(v => ({ variantId: v, quantity: 1 }));
  await (service2 as any).consumeFifoLayersBatch(batchItems);
  const endBatch = Date.now();
  console.log(`Time taken batched: ${endBatch - startBatch}ms`);
}

runBenchmark().catch(console.error);
