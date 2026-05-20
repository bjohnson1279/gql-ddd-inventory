import { ConversionRuleId } from '../valueObjects/ConversionRuleId';
import { UnitOfMeasure } from '../valueObjects/UnitOfMeasure';

export class ConversionRule {
  constructor(
    public readonly id: ConversionRuleId,
    public readonly unit: UnitOfMeasure,
    public readonly factorToBase: number,
    public readonly label?: string
  ) {
    if (factorToBase <= 0) {
      throw new Error('Factor to base must be positive.');
    }
  }
}
