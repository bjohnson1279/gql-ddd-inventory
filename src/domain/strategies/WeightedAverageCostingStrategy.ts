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
    let totalUnits = 0;
    let totalValue = 0;
    for (let i = 0; i < layers.length; i++) {
      totalUnits += layers[i].remainingQuantity();
      totalValue += layers[i].remainingCostCents();
    }

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
