import { InventoryCostLayer } from "../entities/InventoryCostLayer";
import { CostBreakdown } from "../valueObjects/CostBreakdown";
import { ProductVariantId } from "../valueObjects/ProductVariantId";

export interface ICostingStrategy {
  calculateCost(
    layers: InventoryCostLayer[],
    quantity: number,
    variantId: ProductVariantId
  ): CostBreakdown;

  consumeLayers(
    layers: InventoryCostLayer[],
    quantity: number,
    variantId: ProductVariantId
  ): { breakdown: CostBreakdown; sortedLayers: InventoryCostLayer[] };
}
