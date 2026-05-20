import { ProductVariantId } from './ProductVariantId';

export class StockOnboardingItem {
  constructor(
    public readonly variantId: ProductVariantId,
    public readonly quantity: number,
    public readonly unitCostCents: number
  ) {
    if (quantity < 0) {
      throw new Error('Opening balance quantity cannot be negative.');
    }
    if (!Number.isInteger(quantity)) {
        throw new Error('Opening balance quantity must be an integer.');
    }
    if (unitCostCents < 0) {
      throw new Error('Unit cost cannot be negative.');
    }
    if (!Number.isInteger(unitCostCents)) {
        throw new Error('Unit cost must be an integer (cents).');
    }
  }
}
