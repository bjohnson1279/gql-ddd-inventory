import { ICostingStrategy } from "./ICostingStrategy";
import { InventoryCostLayer } from "../entities/InventoryCostLayer";
import { CostBreakdown } from "../valueObjects/CostBreakdown";
import { ProductVariantId } from "../valueObjects/ProductVariantId";

export class WeightedAverageCostingStrategy implements ICostingStrategy {
  public calculateCost(
    layers: InventoryCostLayer[],
    quantity: number,
    variantId: ProductVariantId
  ): CostBreakdown {
    const totalUnits = layers.reduce((sum, l) => sum + l.remainingQuantity(), 0);
    const totalValue = layers.reduce((sum, l) => sum + l.remainingCostCents(), 0);

    if (totalUnits === 0 || totalUnits < quantity) {
      throw new Error(`Insufficient inventory for variant ${variantId.value}`);
    }

    const avgCostCents = totalValue / totalUnits;
    return new CostBreakdown(quantity, Math.round(quantity * avgCostCents));
  }

  public consumeLayers(
    layers: InventoryCostLayer[],
    quantity: number,
    variantId: ProductVariantId
  ): { breakdown: CostBreakdown; sortedLayers: InventoryCostLayer[] } {
    const breakdown = this.calculateCost(layers, quantity, variantId);

    // Consume layers in FIFO order
    const sorted = [...layers].sort(
      (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime()
    );
    let remaining = quantity;

    for (const layer of sorted) {
      if (remaining <= 0) break;
      const consumed = layer.consume(remaining);
      remaining -= consumed;
    }

    return {
      breakdown,
      sortedLayers: sorted,
    };
  }
}
