import { ProductUomConfiguration } from '../../../src/domain/entities/ProductUomConfiguration';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { UnitOfMeasure } from '../../../src/domain/valueObjects/UnitOfMeasure';
import { UomCategory } from '../../../src/domain/enums/UomCategory';
import { StandardUnits } from '../../../src/domain/services/StandardUnits';

describe('ProductUomConfiguration', () => {
  const testSku = new Sku('TEST-SKU-123');
  const baseDiscrete = StandardUnits.each();
  const dozen = StandardUnits.dozen();
  const otherDiscrete = new UnitOfMeasure('Box', 'bx', UomCategory.Discrete);
  const baseWeight = StandardUnits.gram();

  describe('instantiation', () => {
    it('initializes with base unit as default purchase and sale unit, and no conversion rules', () => {
      const config = new ProductUomConfiguration(testSku, baseDiscrete);

      expect(config.sku).toBe(testSku);
      expect(config.baseUnit).toBe(baseDiscrete);
      expect(config.purchaseUnit).toBe(baseDiscrete);
      expect(config.saleUnit).toBe(baseDiscrete);
      expect(config.conversionRules).toHaveLength(0);
    });
  });

  describe('addConversionRule', () => {
    it('successfully adds a valid conversion rule', () => {
      const config = new ProductUomConfiguration(testSku, baseDiscrete);
      config.addConversionRule(dozen, 12, '1 Dozen = 12 Each');

      expect(config.conversionRules).toHaveLength(1);
      expect(config.conversionRules[0].unit).toBe(dozen);
      expect(config.conversionRules[0].factorToBase).toBe(12);
      expect(config.conversionRules[0].label).toBe('1 Dozen = 12 Each');
    });

    it('throws an error when adding an incompatible unit', () => {
      const config = new ProductUomConfiguration(testSku, baseDiscrete);

      expect(() => {
        config.addConversionRule(baseWeight, 100);
      }).toThrow('Unit Gram is not compatible with base unit Each.');
    });

    it('throws an error when adding a rule for the base unit itself', () => {
      const config = new ProductUomConfiguration(testSku, baseDiscrete);

      expect(() => {
        config.addConversionRule(baseDiscrete, 1);
      }).toThrow('Cannot add a conversion rule for the base unit itself.');
    });

    it('throws an error when a rule for the unit already exists', () => {
      const config = new ProductUomConfiguration(testSku, baseDiscrete);
      config.addConversionRule(dozen, 12);

      expect(() => {
        config.addConversionRule(dozen, 24);
      }).toThrow('A conversion rule for Dozen already exists.');
    });
  });

  describe('removeConversionRule', () => {
    it('removes an existing conversion rule', () => {
      const config = new ProductUomConfiguration(testSku, baseDiscrete);
      config.addConversionRule(dozen, 12);
      expect(config.conversionRules).toHaveLength(1);

      config.removeConversionRule(dozen);
      expect(config.conversionRules).toHaveLength(0);
    });

    it('silently ignores attempting to remove a non-existent rule', () => {
      const config = new ProductUomConfiguration(testSku, baseDiscrete);
      expect(config.conversionRules).toHaveLength(0);

      config.removeConversionRule(dozen);
      expect(config.conversionRules).toHaveLength(0);
    });
  });

  describe('setPurchaseUnit and setSaleUnit', () => {
    it('successfully sets to base unit', () => {
      const config = new ProductUomConfiguration(testSku, baseDiscrete);

      config.setPurchaseUnit(baseDiscrete);
      config.setSaleUnit(baseDiscrete);

      expect(config.purchaseUnit).toBe(baseDiscrete);
      expect(config.saleUnit).toBe(baseDiscrete);
    });

    it('successfully sets to a unit with a defined conversion rule', () => {
      const config = new ProductUomConfiguration(testSku, baseDiscrete);
      config.addConversionRule(dozen, 12);

      config.setPurchaseUnit(dozen);
      config.setSaleUnit(dozen);

      expect(config.purchaseUnit).toBe(dozen);
      expect(config.saleUnit).toBe(dozen);
    });

    it('throws an error when setting to an unknown unit', () => {
      const config = new ProductUomConfiguration(testSku, baseDiscrete);

      expect(() => {
        config.setPurchaseUnit(otherDiscrete);
      }).toThrow('Unit Box has no conversion rule defined.');

      expect(() => {
        config.setSaleUnit(otherDiscrete);
      }).toThrow('Unit Box has no conversion rule defined.');
    });
  });

  describe('factorToBase', () => {
    it('returns 1.0 for the base unit', () => {
      const config = new ProductUomConfiguration(testSku, baseDiscrete);
      expect(config.factorToBase(baseDiscrete)).toBe(1.0);
    });

    it('returns the correct factor from a custom conversion rule', () => {
      const config = new ProductUomConfiguration(testSku, baseDiscrete);
      config.addConversionRule(dozen, 12);
      expect(config.factorToBase(dozen)).toBe(12);
    });

    it('returns correct factors for standard Weight conversions', () => {
      const kg = StandardUnits.kilogram();
      const gram = StandardUnits.gram();
      const config = new ProductUomConfiguration(testSku, gram);

      expect(config.factorToBase(kg)).toBe(1000);
    });

    it('returns correct factors for standard Volume conversions', () => {
      const liter = StandardUnits.liter();
      const ml = StandardUnits.milliliter();
      const config = new ProductUomConfiguration(testSku, ml);

      expect(config.factorToBase(liter)).toBe(1000);
    });

    it('throws an error for an unknown unit', () => {
      const config = new ProductUomConfiguration(testSku, baseDiscrete);

      expect(() => {
        config.factorToBase(otherDiscrete);
      }).toThrow('No conversion rule found for Box -> Each.');
    });
  });
});
