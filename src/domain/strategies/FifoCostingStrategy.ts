import { ICostingStrategy } from "./ICostingStrategy";
import { InventoryCostLayer } from "../entities/InventoryCostLayer";
import { CostBreakdown } from "../valueObjects/CostBreakdown";
import { ProductVariantId } from "../valueObjects/ProductVariantId";

export class FifoCostingStrategy implements ICostingStrategy {
  public calculateCost(
    layers: InventoryCostLayer[],
    quantity: number,
    variantId: ProductVariantId
  ): CostBreakdown {
    const sorted = [...layers].sort(
      (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime()
    );
    let remaining = quantity;
    let totalCost = 0;

    for (const layer of sorted) {
      if (remaining <= 0) break;
      const consumed = Math.min(remaining, layer.remainingQuantity());
      totalCost += consumed * layer.unitCostCents;
      remaining -= consumed;
    }

    if (remaining > 0) {
      throw new Error("Insufficient cost layers to cover the quantity.");
    }

    return new CostBreakdown(quantity, totalCost);
  }

  public consumeLayers(
    layers: InventoryCostLayer[],
    quantity: number,
    variantId: ProductVariantId
  ): { breakdown: CostBreakdown; sortedLayers: InventoryCostLayer[] } {
    const sorted = [...layers].sort(
      (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime()
    );
    let remaining = quantity;
    let totalCost = 0;

    for (const layer of sorted) {
      if (remaining <= 0) break;
      const consumed = layer.consume(remaining);
      totalCost += consumed * layer.unitCostCents;
      remaining -= consumed;
    }

    if (remaining > 0) {
      throw new Error("Insufficient cost layers to cover the quantity.");
    }

    return {
      breakdown: new CostBreakdown(quantity, totalCost),
      sortedLayers: sorted,
    };
  }
}
