import { UnitOfMeasure } from './UnitOfMeasure';
import { UomCategory } from '../enums/UomCategory';
import { StandardUnits } from '../services/StandardUnits';

export class Quantity {
  constructor(
    public readonly amount: number,
    public readonly unit: UnitOfMeasure = StandardUnits.each()
  ) {
    if (amount < 0) {
      throw new Error("Quantity amount cannot be negative.");
    }
  }

  get value(): number {
    return this.amount;
  }

  add(other: Quantity): Quantity {
    this.assertSameUnit(other);
    return new Quantity(this.amount + other.amount, this.unit);
  }

  subtract(other: Quantity): Quantity {
    this.assertSameUnit(other);
    const result = this.amount - other.amount;
    if (result < 0) {
      throw new Error("Resulting quantity would be negative.");
    }
    return new Quantity(result, this.unit);
  }

  multiplyBy(factor: number): Quantity {
    return new Quantity(this.amount * factor, this.unit);
  }

  toBaseInteger(): number {
    if (this.unit.category !== UomCategory.Discrete) {
      throw new Error(
        'Use toBaseInteger() only for discrete quantities. ' +
        'Continuous quantities should be converted to their smallest unit (g, ml) first.'
      );
    }

    if (this.amount % 1 !== 0) {
      throw new Error(
        `Discrete quantity must be a whole number; got ${this.amount} ${this.unit.abbreviation}.`
      );
    }

    return this.amount;
  }

  equals(other: Quantity): boolean {
    return this.amount === other.amount && this.unit.equals(other.unit);
  }

  toString(): string {
    return `${this.amount} ${this.unit.abbreviation}`;
  }

  private assertSameUnit(other: Quantity): void {
    if (!this.unit.equals(other.unit)) {
      throw new Error(
        `Cannot operate on ${this.unit.name} and ${other.unit.name} directly. Convert first.`
      );
    }
  }
}
