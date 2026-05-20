import { Quantity } from '../valueObjects/Quantity';
import { UnitOfMeasure } from '../valueObjects/UnitOfMeasure';
import { ProductUomConfiguration } from '../entities/ProductUomConfiguration';

export class UomConverter {
  /**
   * Convert a quantity from one unit to another.
   * Both units must be compatible (same category) and known to the config.
   */
  convert(
    from: Quantity,
    toUnit: UnitOfMeasure,
    config: ProductUomConfiguration
  ): Quantity {
    if (from.unit.equals(toUnit)) {
      return from;
    }

    if (!from.unit.isCompatibleWith(toUnit)) {
      throw new Error(`Cannot convert ${from.unit.category} to ${toUnit.category}.`);
    }

    // Step 1: convert to base unit
    const inBase = from.amount * config.factorToBase(from.unit);

    // Step 2: convert base to target unit
    const targetFactor = config.factorToBase(toUnit);
    const converted = inBase / targetFactor;

    return new Quantity(converted, toUnit);
  }

  /**
   * Convenience: convert directly to the product's base unit.
   */
  toBaseUnit(quantity: Quantity, config: ProductUomConfiguration): Quantity {
    return this.convert(quantity, config.baseUnit, config);
  }

  /**
   * Convert a unit cost from one unit to another.
   * e.g. $14.40 per case -> $0.60 per each
   */
  convertCost(
    costCentsPerUnit: number,
    perUnit: UnitOfMeasure,
    targetUnit: UnitOfMeasure,
    config: ProductUomConfiguration
  ): number {
    if (perUnit.equals(targetUnit)) {
      return costCentsPerUnit;
    }

    const factorPerToBase = config.factorToBase(perUnit);
    const factorTargetToBase = config.factorToBase(targetUnit);

    const ratio = factorPerToBase / factorTargetToBase;

    return Math.round(costCentsPerUnit / ratio);
  }
}
