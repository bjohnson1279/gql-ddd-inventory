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
