import { IInventoryCostLayerRepository } from '../repositories/IInventoryCostLayerRepository';
import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { CostBreakdown } from '../valueObjects/CostBreakdown';
import { InventoryCostLayer } from '../entities/InventoryCostLayer';
import { SerialNumber } from '../valueObjects/SerialNumber';

export class CostLayerService {
  constructor(private readonly layers: IInventoryCostLayerRepository) {}

  async calculateFifoCost(variantId: ProductVariantId, quantity: number): Promise<CostBreakdown> {
    const activeLayers = await this.layers.getActiveLayers(variantId, 'received_at ASC');
    return this.calculateConsumedCost(activeLayers, quantity);
  }

  async consumeFifoLayers(variantId: ProductVariantId, quantity: number): Promise<CostBreakdown> {
    const activeLayers = await this.layers.getActiveLayers(variantId, 'received_at ASC');
    const breakdown = this.calculateConsumedCost(activeLayers, quantity, true);

    for (const layer of activeLayers) {
      await this.layers.save(layer);
    }

    return breakdown;
  }

  async consumeFifoLayersBatch(
    items: { variantId: ProductVariantId; quantity: number }[]
  ): Promise<{ breakdowns: Map<string, CostBreakdown>; totalCostCents: number }> {
    const variantIds = items.map(i => i.variantId);
    const activeLayersMap = await this.layers.getActiveLayersBatch(variantIds, 'received_at ASC');

    let totalCostCents = 0;
    const breakdowns = new Map<string, CostBreakdown>();
    const layersToSave: InventoryCostLayer[] = [];

    for (const item of items) {
      const activeLayers = activeLayersMap.get(item.variantId.value) || [];
      const breakdown = this.calculateConsumedCost(activeLayers, item.quantity, true);
      breakdowns.set(item.variantId.value, breakdown);
      totalCostCents += breakdown.totalCostCents;
      layersToSave.push(...activeLayers);
    }

    await this.layers.saveBatch(layersToSave);

    return { breakdowns, totalCostCents };
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
