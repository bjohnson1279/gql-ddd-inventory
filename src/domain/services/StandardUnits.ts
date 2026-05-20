import { UnitOfMeasure } from '../valueObjects/UnitOfMeasure';
import { UomCategory } from '../enums/UomCategory';

export class StandardUnits {
  // --- Discrete ---
  static each(): UnitOfMeasure {
    return new UnitOfMeasure('Each', 'ea', UomCategory.Discrete);
  }

  static dozen(): UnitOfMeasure {
    return new UnitOfMeasure('Dozen', 'dz', UomCategory.Discrete);
  }

  // --- Weight ---
  static gram(): UnitOfMeasure {
    return new UnitOfMeasure('Gram', 'g', UomCategory.Weight);
  }

  static kilogram(): UnitOfMeasure {
    return new UnitOfMeasure('Kilogram', 'kg', UomCategory.Weight);
  }

  static ounce(): UnitOfMeasure {
    return new UnitOfMeasure('Ounce', 'oz', UomCategory.Weight);
  }

  static pound(): UnitOfMeasure {
    return new UnitOfMeasure('Pound', 'lb', UomCategory.Weight);
  }

  // --- Volume ---
  static milliliter(): UnitOfMeasure {
    return new UnitOfMeasure('Milliliter', 'ml', UomCategory.Volume);
  }

  static liter(): UnitOfMeasure {
    return new UnitOfMeasure('Liter', 'l', UomCategory.Volume);
  }

  static fluidOunce(): UnitOfMeasure {
    return new UnitOfMeasure('Fluid Ounce', 'fl oz', UomCategory.Volume);
  }

  static gallon(): UnitOfMeasure {
    return new UnitOfMeasure('Gallon', 'gal', UomCategory.Volume);
  }

  static weightFactorToGrams(unit: UnitOfMeasure): number {
    switch (unit.name) {
      case 'Gram': return 1.0;
      case 'Kilogram': return 1000.0;
      case 'Ounce': return 28.3495;
      case 'Pound': return 453.592;
      default: throw new Error(`Unknown weight unit: ${unit.name}`);
    }
  }

  static volumeFactorToMilliliters(unit: UnitOfMeasure): number {
    switch (unit.name) {
      case 'Milliliter': return 1.0;
      case 'Liter': return 1000.0;
      case 'Fluid Ounce': return 29.5735;
      case 'Gallon': return 3785.41;
      default: throw new Error(`Unknown volume unit: ${unit.name}`);
    }
  }
}
