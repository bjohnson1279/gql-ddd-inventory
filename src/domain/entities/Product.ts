import crypto from 'crypto';
import { ProductId } from '../valueObjects/ProductId';
import { ProductVariant } from './ProductVariant';
import { Sku } from '../valueObjects/Sku';
import { VariantAttribute } from '../valueObjects/VariantAttribute';
import { VariantAttributeSet } from '../valueObjects/VariantAttributeSet';
import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { VariantTrackingMode } from '../enums/VariantEnums';

export class Product {
  private _variants: Map<string, ProductVariant>;
  private _variantsBySku: Map<string, ProductVariant>;
  private _variantsArray: ProductVariant[] | null = null;

  constructor(
    public readonly id: ProductId,
    public readonly name: string,
    variants?: Map<string, ProductVariant>
  ) {
    this._variants = variants ?? new Map<string, ProductVariant>();
    this._variantsBySku = new Map<string, ProductVariant>();
    if (variants) {
      for (const variant of variants.values()) {
        this._variantsBySku.set(variant.sku.value, variant);
      }
    }
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
    this._variantsBySku.set(variant.sku.value, variant);
    this._variantsArray = null; // Invalidate cache

    return variant;
  }

  findVariant(id: ProductVariantId): ProductVariant | undefined {
    return this._variants.get(id.value);
  }

  findVariantBySku(sku: Sku | string): ProductVariant | undefined {
    const skuStr = sku instanceof Sku ? sku.value : sku;
    return this._variantsBySku.get(skuStr);
  }

  get variants(): ReadonlyArray<ProductVariant> {
    if (this._variantsArray === null) {
      this._variantsArray = Array.from(this._variants.values());
    }
    return this._variantsArray;
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
