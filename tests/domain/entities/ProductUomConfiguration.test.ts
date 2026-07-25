import { ProductUomConfiguration } from '../../../src/domain/entities/ProductUomConfiguration';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { StandardUnits } from '../../../src/domain/services/StandardUnits';
import { UnitOfMeasure } from '../../../src/domain/valueObjects/UnitOfMeasure';
import { UomCategory } from '../../../src/domain/enums/UomCategory';

describe('ProductUomConfiguration', () => {
  let sku: Sku;
  let baseUnit: UnitOfMeasure;
  let config: ProductUomConfiguration;

  beforeEach(() => {
    sku = new Sku('TEST-SKU-001');
    baseUnit = StandardUnits.each();
    config = new ProductUomConfiguration(sku, baseUnit);
  });

  describe('Initialization', () => {
    it('should initialize with correct sku and baseUnit', () => {
      expect(config.sku).toBe(sku);
      expect(config.baseUnit).toBe(baseUnit);
    });

    it('should set purchaseUnit and saleUnit to baseUnit by default', () => {
      expect(config.purchaseUnit).toBe(baseUnit);
      expect(config.saleUnit).toBe(baseUnit);
    });

    it('should initialize with empty conversion rules', () => {
      expect(config.conversionRules).toEqual([]);
    });
  });

  describe('addConversionRule', () => {
    it('should add a valid conversion rule successfully', () => {
      const dozen = StandardUnits.dozen();
      config.addConversionRule(dozen, 12, 'Dozen Box');

      expect(config.conversionRules.length).toBe(1);
      const rule = config.conversionRules[0];
      expect(rule.unit).toBe(dozen);
      expect(rule.factorToBase).toBe(12);
      expect(rule.label).toBe('Dozen Box');
    });

    it('should throw error when adding rule with incompatible categories', () => {
      const weightUnit = StandardUnits.kilogram();
      expect(() => {
        config.addConversionRule(weightUnit, 1000);
      }).toThrow(`Unit ${weightUnit.name} is not compatible with base unit ${baseUnit.name}.`);
    });

    it('should throw error when adding rule for the base unit itself', () => {
      expect(() => {
        config.addConversionRule(baseUnit, 1);
      }).toThrow('Cannot add a conversion rule for the base unit itself.');
    });

    it('should throw error when adding duplicate rules', () => {
      const dozen = StandardUnits.dozen();
      config.addConversionRule(dozen, 12);

      expect(() => {
        config.addConversionRule(dozen, 24);
      }).toThrow(`A conversion rule for ${dozen.name} already exists.`);
    });
  });

  describe('removeConversionRule', () => {
    it('should successfully remove an existing rule', () => {
      const dozen = StandardUnits.dozen();
      config.addConversionRule(dozen, 12);
      expect(config.conversionRules.length).toBe(1);

      config.removeConversionRule(dozen);
      expect(config.conversionRules.length).toBe(0);
    });

    it('should safely ignore removing a non-existent rule', () => {
      const dozen = StandardUnits.dozen();
      config.addConversionRule(dozen, 12);
      expect(config.conversionRules.length).toBe(1);

      const anotherUnit = new UnitOfMeasure('Pallet', 'pal', UomCategory.Discrete);
      config.removeConversionRule(anotherUnit);
      expect(config.conversionRules.length).toBe(1);
    });
  });

  describe('setPurchaseUnit / setSaleUnit', () => {
    it('should allow setting purchase and sale unit to baseUnit', () => {
      config.setPurchaseUnit(baseUnit);
      config.setSaleUnit(baseUnit);

      expect(config.purchaseUnit).toBe(baseUnit);
      expect(config.saleUnit).toBe(baseUnit);
    });

    it('should allow setting to a unit with a valid conversion rule', () => {
      const dozen = StandardUnits.dozen();
      config.addConversionRule(dozen, 12);

      config.setPurchaseUnit(dozen);
      config.setSaleUnit(dozen);

      expect(config.purchaseUnit).toBe(dozen);
      expect(config.saleUnit).toBe(dozen);
    });

    it('should throw error when setting purchase unit to an unknown unit', () => {
      const unknownUnit = StandardUnits.dozen();
      expect(() => {
        config.setPurchaseUnit(unknownUnit);
      }).toThrow(`Unit ${unknownUnit.name} has no conversion rule defined.`);
    });

    it('should throw error when setting sale unit to an unknown unit', () => {
      const unknownUnit = StandardUnits.dozen();
      expect(() => {
        config.setSaleUnit(unknownUnit);
      }).toThrow(`Unit ${unknownUnit.name} has no conversion rule defined.`);
    });
  });

  describe('factorToBase', () => {
    it('should return 1.0 for the base unit', () => {
      expect(config.factorToBase(baseUnit)).toBe(1.0);
    });

    it('should return correct values from manually added conversion rules', () => {
      const dozen = StandardUnits.dozen();
      config.addConversionRule(dozen, 12);

      expect(config.factorToBase(dozen)).toBe(12);
    });

    it('should work properly for predefined units in Weight category', () => {
      const weightConfig = new ProductUomConfiguration(sku, StandardUnits.kilogram());

      const gram = StandardUnits.gram();
      expect(weightConfig.factorToBase(gram)).toBe(1.0 / 1000.0);

      const pound = StandardUnits.pound();
      const lbFactor = StandardUnits.weightFactorToGrams(pound);
      const kgFactor = StandardUnits.weightFactorToGrams(StandardUnits.kilogram());
      expect(weightConfig.factorToBase(pound)).toBe(lbFactor / kgFactor);
    });

    it('should work properly for predefined units in Volume category', () => {
      const volumeConfig = new ProductUomConfiguration(sku, StandardUnits.liter());

      const ml = StandardUnits.milliliter();
      expect(volumeConfig.factorToBase(ml)).toBe(1.0 / 1000.0);

      const gal = StandardUnits.gallon();
      const galFactor = StandardUnits.volumeFactorToMilliliters(gal);
      const literFactor = StandardUnits.volumeFactorToMilliliters(StandardUnits.liter());
      expect(volumeConfig.factorToBase(gal)).toBe(galFactor / literFactor);
    });

    it('should throw error for unknown units without conversion rule', () => {
      const unknownUnit = StandardUnits.dozen();
      expect(() => {
        config.factorToBase(unknownUnit);
      }).toThrow(`No conversion rule found for ${unknownUnit.name} -> ${baseUnit.name}.`);
    });
  });
});
