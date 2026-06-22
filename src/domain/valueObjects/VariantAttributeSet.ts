import { VariantAttribute } from './VariantAttribute';

export class VariantAttributeSet {
  private readonly attributes: VariantAttribute[];

  constructor(attributes: VariantAttribute[]) {
    if (attributes.length === 0) {
      throw new Error('A variant must have at least one attribute.');
    }

    // Sort by attribute name for consistent comparison
    this.attributes = [...attributes].sort((a, b) => a.name.localeCompare(b.name));
  }

  equals(other: VariantAttributeSet): boolean {
    if (this.attributes.length !== other.attributes.length) {
      return false;
    }
    return this.attributes.every((attr, i) => attr.equals(other.attributes[i]));
  }

  // Return ReadonlyArray to avoid O(N) memory allocation overhead on every access while preventing mutations
  all(): ReadonlyArray<VariantAttribute> {
    return this.attributes;
  }

  toJSON() {
    return this.attributes.map(a => ({ name: a.name, value: a.value }));
  }
}
