export class ProductVariantId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("ProductVariantId cannot be empty.");
    }
  }

  equals(other: ProductVariantId): boolean {
    return this.value === other.value;
  }
}
