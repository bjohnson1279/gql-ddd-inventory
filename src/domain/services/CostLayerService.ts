import { IInventoryCostLayerRepository } from '../repositories/IInventoryCostLayerRepository';
import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { CostBreakdown } from '../valueObjects/CostBreakdown';
import { InventoryCostLayer } from '../entities/InventoryCostLayer';
import { SerialNumber } from '../valueObjects/SerialNumber';
import { CostingMethod } from '../enums/AccountingEnums';

export class CostLayerService {
  constructor(private readonly layers: IInventoryCostLayerRepository) {}

  async calculateCostBatch(
    items: { variantId: ProductVariantId; quantity: number }[],
    globalMethod: CostingMethod = CostingMethod.FIFO,
    methodsMap?: Map<string, CostingMethod>
  ): Promise<(CostBreakdown | null)[]> {
    const methodGroups = new Map<CostingMethod, { item: { variantId: ProductVariantId; quantity: number }, index: number }[]>();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const method = methodsMap?.get(item.variantId.value) || globalMethod;
      const list = methodGroups.get(method) || [];
      list.push({ item, index: i });
      methodGroups.set(method, list);
    }

    const results: (CostBreakdown | null)[] = new Array(items.length).fill(null);

    for (const [method, groupItems] of methodGroups.entries()) {
      const variantIds = groupItems.map(g => g.item.variantId);

      if (method === CostingMethod.WeightedAverageCost) {
        const activeLayersMap = await this.layers.getActiveLayersBatch(variantIds);
        for (const g of groupItems) {
          try {
            const activeLayers = activeLayersMap.get(g.item.variantId.value) || [];
            results[g.index] = this.calculateWeightedAverageCostSync(activeLayers, g.item.quantity, g.item.variantId.value);
          } catch (e) {
            results[g.index] = null;
          }
        }
      } else {
        const orderStr = method === CostingMethod.FEFO
          ? 'expiration_date ASC'
          : method === CostingMethod.LIFO
            ? 'received_at DESC'
            : 'received_at ASC';

        const activeLayersMap = await this.layers.getActiveLayersBatch(variantIds, orderStr);

        for (const g of groupItems) {
          try {
            const activeLayers = activeLayersMap.get(g.item.variantId.value) || [];
            results[g.index] = this.calculateConsumedCost(activeLayers, g.item.quantity);
          } catch (e) {
            results[g.index] = null;
          }
        }
      }
    }

    return results;
  }

  async calculateCost(variantId: ProductVariantId, quantity: number, method: CostingMethod = CostingMethod.FIFO): Promise<CostBreakdown> {
    if (method === CostingMethod.WeightedAverageCost) {
      return this.calculateWeightedAverageCost(variantId, quantity);
    }
    const orderStr = method === CostingMethod.FEFO
      ? 'expiration_date ASC'
      : method === CostingMethod.LIFO
        ? 'received_at DESC'
        : 'received_at ASC';

    const activeLayers = await this.layers.getActiveLayers(variantId, orderStr);
    return this.calculateConsumedCost(activeLayers, quantity);
  }

  async consumeLayers(variantId: ProductVariantId, quantity: number, method: CostingMethod = CostingMethod.FIFO): Promise<CostBreakdown> {
    if (method === CostingMethod.WeightedAverageCost) {
      return this.consumeLayers(variantId, quantity, CostingMethod.FIFO);
    }
    const orderStr = method === CostingMethod.FEFO
      ? 'expiration_date ASC'
      : method === CostingMethod.LIFO
        ? 'received_at DESC'
        : 'received_at ASC';

    const activeLayers = await this.layers.getActiveLayers(variantId, orderStr);
    const breakdown = this.calculateConsumedCost(activeLayers, quantity, true);

    if (activeLayers.length > 0) {
      await this.layers.saveBatch(activeLayers);
    }

    return breakdown;
  }

  async consumeLayersBatch(
    items: { variantId: ProductVariantId; quantity: number }[],
    methodsMap?: Map<string, CostingMethod>
  ): Promise<{ breakdowns: Map<string, CostBreakdown>; totalCostCents: number }> {
    const methodGroups = new Map<CostingMethod, typeof items>();
    for (const item of items) {
      const method = methodsMap?.get(item.variantId.value) || CostingMethod.FIFO;
      const list = methodGroups.get(method) || [];
      list.push(item);
      methodGroups.set(method, list);
    }

    let totalCostCents = 0;
    const breakdowns = new Map<string, CostBreakdown>();
    const layersToSave: InventoryCostLayer[] = [];

    for (const [method, groupItems] of methodGroups.entries()) {
      const variantIds = groupItems.map(i => i.variantId);
      const orderStr = method === CostingMethod.FEFO
        ? 'expiration_date ASC'
        : method === CostingMethod.LIFO
          ? 'received_at DESC'
          : 'received_at ASC';

      const activeLayersMap = await this.layers.getActiveLayersBatch(variantIds, orderStr);

      for (const item of groupItems) {
        const activeLayers = activeLayersMap.get(item.variantId.value) || [];
        const breakdown = this.calculateConsumedCost(activeLayers, item.quantity, true);

        const existingBreakdown = breakdowns.get(item.variantId.value);
        if (existingBreakdown) {
          breakdowns.set(
            item.variantId.value,
            new CostBreakdown(
              existingBreakdown.quantity + breakdown.quantity,
              existingBreakdown.totalCostCents + breakdown.totalCostCents
            )
          );
        } else {
          breakdowns.set(item.variantId.value, breakdown);
        }

        totalCostCents += breakdown.totalCostCents;
        layersToSave.push(...activeLayers);
      }
    }

    await this.layers.saveBatch(layersToSave);

    return { breakdowns, totalCostCents };
  }

  async calculateFifoCost(variantId: ProductVariantId, quantity: number): Promise<CostBreakdown> {
    return this.calculateCost(variantId, quantity, CostingMethod.FIFO);
  }

  async consumeFifoLayers(variantId: ProductVariantId, quantity: number): Promise<CostBreakdown> {
    return this.consumeLayers(variantId, quantity, CostingMethod.FIFO);
  }

  async consumeFifoLayersBatch(
    items: { variantId: ProductVariantId; quantity: number }[]
  ): Promise<{ breakdowns: Map<string, CostBreakdown>; totalCostCents: number }> {
    return this.consumeLayersBatch(items);
  }

  calculateWeightedAverageCostSync(activeLayers: InventoryCostLayer[], quantity: number, variantIdValue?: string): CostBreakdown {
    const totalUnits = activeLayers.reduce((sum, l) => sum + l.remainingQuantity(), 0);
    const totalValue = activeLayers.reduce((sum, l) => sum + l.remainingCostCents(), 0);

    if (totalUnits === 0) {
      throw new Error(`Insufficient inventory for variant ${variantIdValue || ''}`);
    }

    const avgCostCents = totalValue / totalUnits;
    return new CostBreakdown(quantity, Math.round(quantity * avgCostCents));
  }

  async calculateWeightedAverageCost(variantId: ProductVariantId, quantity: number): Promise<CostBreakdown> {
    const activeLayers = await this.layers.getActiveLayers(variantId);
    try {
      return this.calculateWeightedAverageCostSync(activeLayers, quantity);
    } catch (e) {
      throw new Error(`Insufficient inventory for variant ${variantId.value}`);
    }
  }

  async costForSerial(variantId: ProductVariantId, serialNumber: SerialNumber): Promise<CostBreakdown> {
    const layer = await this.layers.findBySerial(variantId, serialNumber);
    if (!layer) {
      throw new Error(`No cost layer found for serial ${serialNumber.value}`);
    }
    return new CostBreakdown(1, layer.unitCostCents);
  }

  private calculateConsumedCost(
    layers: InventoryCostLayer[],
    quantity: number,
    mutate: boolean = false
  ): CostBreakdown {
    let remaining = quantity;
    let totalCost = 0;

    for (const layer of layers) {
      if (remaining <= 0) break;

      const available = layer.remainingQuantity();
      const toConsume = Math.min(remaining, available);

      if (mutate) {
        layer.consume(toConsume);
      }

      totalCost += toConsume * layer.unitCostCents;
      remaining -= toConsume;
    }

    if (remaining > 0) {
      throw new Error('Insufficient cost layers to cover the quantity.');
    }

    return new CostBreakdown(quantity, totalCost);
  }
}
