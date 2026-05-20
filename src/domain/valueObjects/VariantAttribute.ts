export class VariantAttribute {
  constructor(
    public readonly name: string,
    public readonly value: string
  ) {
    if (!name.trim() || !value.trim()) {
      throw new Error('Attribute name and value must be non-empty.');
    }
  }

  equals(other: VariantAttribute): boolean {
    return this.name === other.name && this.value === other.value;
  }
}
