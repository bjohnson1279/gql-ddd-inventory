import { ProductId } from '../valueObjects/ProductId';
import { ProductVariant } from './ProductVariant';
import { Sku } from '../valueObjects/Sku';
import { VariantAttribute } from '../valueObjects/VariantAttribute';
import { VariantAttributeSet } from '../valueObjects/VariantAttributeSet';
import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { VariantTrackingMode } from '../enums/VariantEnums';

export class Product {
  private _variants: Map<string, ProductVariant>;

  constructor(
    public readonly id: ProductId,
    public readonly name: string,
    variants?: Map<string, ProductVariant>
  ) {
    this._variants = variants ?? new Map<string, ProductVariant>();
  }

  addVariant(sku: Sku, attributes: VariantAttribute[], trackingMode: VariantTrackingMode = VariantTrackingMode.Quantity): ProductVariant {
    const attributeSet = new VariantAttributeSet(attributes);

    // Enforce uniqueness — no duplicate attribute combos per product
    for (const existing of this._variants.values()) {
      if (existing.attributes.equals(attributeSet)) {
        throw new Error(`A variant with these attributes already exists on product ${this.id.value}.`);
      }
    }

    const variant = new ProductVariant(
      new ProductVariantId(this.generateId()),
      this.id,
      sku,
      attributeSet,
      trackingMode
    );

    this._variants.set(variant.id.value, variant);

    return variant;
  }

  findVariant(id: ProductVariantId): ProductVariant | undefined {
    return this._variants.get(id.value);
  }

  get variants(): ProductVariant[] {
    return Array.from(this._variants.values());
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
