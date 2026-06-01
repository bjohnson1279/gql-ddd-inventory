import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { ProductId } from '../valueObjects/ProductId';
import { Sku } from '../valueObjects/Sku';
import { VariantAttributeSet } from '../valueObjects/VariantAttributeSet';
import { VariantTrackingMode } from '../enums/VariantEnums';

export class ProductVariant {
  constructor(
    public readonly id: ProductVariantId,
    public readonly productId: ProductId,
    public readonly sku: Sku,
    public readonly attributes: VariantAttributeSet,
    public trackingMode: VariantTrackingMode = VariantTrackingMode.Quantity
  ) {}
}
