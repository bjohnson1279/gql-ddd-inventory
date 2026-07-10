import { IInventoryCostLayerRepository } from '../repositories/IInventoryCostLayerRepository';
import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { CostBreakdown } from '../valueObjects/CostBreakdown';
import { InventoryCostLayer } from '../entities/InventoryCostLayer';
import { SerialNumber } from '../valueObjects/SerialNumber';
import { CostingMethod } from '../enums/AccountingEnums';
import { CostingStrategyRegistry } from '../strategies/CostingStrategyRegistry';

export class CostLayerService {
  constructor(private readonly layers: IInventoryCostLayerRepository) {}

  async calculateCost(variantId: ProductVariantId, quantity: number, method: CostingMethod = CostingMethod.FIFO): Promise<CostBreakdown> {
    if (method === CostingMethod.SpecificIdentification) {
      throw new Error("SpecificIdentification requires serial numbers. Use a dedicated path.");
    }
    if (method === CostingMethod.WeightedAverageCost) {
      return this.calculateWeightedAverageCost(variantId, quantity);
    }
    const activeLayers = await this.layers.getActiveLayers(variantId);
    const strategy = CostingStrategyRegistry.get(method);
    return strategy.calculateCost(activeLayers, quantity, variantId);
  }

  async consumeLayers(variantId: ProductVariantId, quantity: number, method: CostingMethod = CostingMethod.FIFO): Promise<CostBreakdown> {
    if (method === CostingMethod.SpecificIdentification) {
      throw new Error("SpecificIdentification requires serial numbers. Use a dedicated path.");
    }
    if (method === CostingMethod.WeightedAverageCost) {
      return this.consumeLayers(variantId, quantity, CostingMethod.FIFO);
    }
    const activeLayers = await this.layers.getActiveLayers(variantId);
    const strategy = CostingStrategyRegistry.get(method);
    const { breakdown, sortedLayers } = strategy.consumeLayers(activeLayers, quantity, variantId);

    if (sortedLayers.length > 0) {
      await this.layers.saveBatch(sortedLayers);
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
      const activeLayersMap = await this.layers.getActiveLayersBatch(variantIds);

      for (const item of groupItems) {
        const activeLayers = activeLayersMap.get(item.variantId.value) || [];
        const activeMethod = method === CostingMethod.WeightedAverageCost ? CostingMethod.FIFO : method;
        const strategy = CostingStrategyRegistry.get(activeMethod);
        const { breakdown, sortedLayers } = strategy.consumeLayers(activeLayers, item.quantity, item.variantId);

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
        layersToSave.push(...sortedLayers);
      }
    }

    await this.layers.saveBatch(layersToSave);

    return { breakdowns, totalCostCents };
  }


  async calculateCostBatch(
    items: { variantId: ProductVariantId; quantity: number }[],
    methodsMap?: Map<string, CostingMethod>
  ): Promise<(CostBreakdown | null)[]> {
    const methodGroups = new Map<CostingMethod, { item: { variantId: ProductVariantId; quantity: number }, index: number }[]>();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const method = methodsMap?.get(item.variantId.value) || CostingMethod.FIFO;
      const list = methodGroups.get(method) || [];
      list.push({ item, index: i });
      methodGroups.set(method, list);
    }

    const results: (CostBreakdown | null)[] = new Array(items.length).fill(null);

    for (const [method, groupItems] of methodGroups.entries()) {
      const variantIds = groupItems.map(g => g.item.variantId);

      // Calculate activeLayers map in bulk
      let activeLayersMap = new Map<string, InventoryCostLayer[]>();
      if (method !== CostingMethod.SpecificIdentification) {
        activeLayersMap = await this.layers.getActiveLayersBatch(variantIds);
      }

      for (const { item, index } of groupItems) {
        try {
          if (method === CostingMethod.SpecificIdentification) {
             throw new Error("SpecificIdentification requires serial numbers. Use a dedicated path.");
          } else if (method === CostingMethod.WeightedAverageCost) {
             const activeLayersForVariant = activeLayersMap.get(item.variantId.value) || [];
             results[index] = this.calculateWeightedAverageCostSync(activeLayersForVariant, item.quantity, item.variantId.value);
          } else {
             const activeLayersForVariant = activeLayersMap.get(item.variantId.value) || [];
             const strategy = CostingStrategyRegistry.get(method);
             results[index] = strategy.calculateCost(activeLayersForVariant, item.quantity, item.variantId);
          }
        } catch (e) {
          results[index] = null;
        }
      }
    }

    return results;
  }

  // Backwards compatibility helpers
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
      return this.calculateWeightedAverageCostSync(activeLayers, quantity, variantId.value);
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
}
