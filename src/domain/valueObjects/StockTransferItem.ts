import { ProductVariantId } from './ProductVariantId';

export class StockTransferItem {
  constructor(
    public readonly variantId: ProductVariantId,
    public readonly quantity: number
  ) {
    if (quantity <= 0) {
      throw new Error('Stock transfer item quantity must be positive.');
    }
    if (!Number.isInteger(quantity)) {
      throw new Error('Stock transfer item quantity must be an integer.');
    }
  }
}
