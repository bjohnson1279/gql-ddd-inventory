import { UomCategory } from '../enums/UomCategory';

export class UnitOfMeasure {
  constructor(
    public readonly name: string,
    public readonly abbreviation: string,
    public readonly category: UomCategory
  ) {
    if (!name.trim() || !abbreviation.trim()) {
      throw new Error('UnitOfMeasure name and abbreviation must be non-empty.');
    }
  }

  equals(other: UnitOfMeasure): boolean {
    return this.name === other.name && this.category === other.category;
  }

  isCompatibleWith(other: UnitOfMeasure): boolean {
    return this.category === other.category;
  }

  toString(): string {
    return `${this.name} (${this.abbreviation})`;
  }
}
