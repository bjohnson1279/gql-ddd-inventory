import { ConversionRule } from '../../../src/domain/entities/ConversionRule';
import { ConversionRuleId } from '../../../src/domain/valueObjects/ConversionRuleId';
import { UnitOfMeasure } from '../../../src/domain/valueObjects/UnitOfMeasure';
import { UomCategory } from '../../../src/domain/enums/UomCategory';

describe('ConversionRule', () => {
  const ruleId = new ConversionRuleId('rule-1');
  const unit = new UnitOfMeasure('Kilogram', 'kg', UomCategory.Weight);

  describe('instantiation', () => {
    it('creates a valid ConversionRule with positive factorToBase and label', () => {
      const rule = new ConversionRule(ruleId, unit, 1000, '1 kg = 1000 g');

      expect(rule.id).toBe(ruleId);
      expect(rule.unit).toBe(unit);
      expect(rule.factorToBase).toBe(1000);
      expect(rule.label).toBe('1 kg = 1000 g');
    });

    it('creates a valid ConversionRule without optional label', () => {
      const rule = new ConversionRule(ruleId, unit, 2.5);

      expect(rule.id).toBe(ruleId);
      expect(rule.unit).toBe(unit);
      expect(rule.factorToBase).toBe(2.5);
      expect(rule.label).toBeUndefined();
    });

    it('throws an error when factorToBase is zero', () => {
      expect(() => new ConversionRule(ruleId, unit, 0)).toThrow('Factor to base must be positive.');
    });

    it('throws an error when factorToBase is negative', () => {
      expect(() => new ConversionRule(ruleId, unit, -1.5)).toThrow('Factor to base must be positive.');
    });
  });
});
