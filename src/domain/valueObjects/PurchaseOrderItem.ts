import { ProductVariantId } from './ProductVariantId';

export class PurchaseOrderItem {
  constructor(
    public readonly variantId: ProductVariantId,
    public readonly quantity: number
  ) {
    if (quantity <= 0) {
      throw new Error("Quantity must be positive.");
    }
  }
}
