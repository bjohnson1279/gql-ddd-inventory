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

    it('should initialize with empty conversion rules', () => {
      expect(config.conversionRules).toEqual([]);
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

      expect(() => {
        config.addConversionRule(baseWeight, 100);
      }).toThrow('Unit Gram is not compatible with base unit Each.');

    it('throws an error when adding a rule for the base unit itself', () => {

        config.addConversionRule(baseDiscrete, 1);
      }).toThrow('Cannot add a conversion rule for the base unit itself.');

    it('throws an error when a rule for the unit already exists', () => {
    it('should add a valid conversion rule successfully', () => {
      const dozen = StandardUnits.dozen();
      config.addConversionRule(dozen, 12, 'Dozen Box');

      expect(config.conversionRules.length).toBe(1);
      const rule = config.conversionRules[0];
      expect(rule.unit).toBe(dozen);
      expect(rule.factorToBase).toBe(12);
      expect(rule.label).toBe('Dozen Box');

    it('should throw error when adding rule with incompatible categories', () => {
      const weightUnit = StandardUnits.kilogram();
        config.addConversionRule(weightUnit, 1000);
      }).toThrow(`Unit ${weightUnit.name} is not compatible with base unit ${baseUnit.name}.`);

    it('should throw error when adding rule for the base unit itself', () => {
        config.addConversionRule(baseUnit, 1);

    it('should throw error when adding duplicate rules', () => {
      config.addConversionRule(dozen, 12);

      expect(() => {
        config.addConversionRule(dozen, 24);
      }).toThrow('A conversion rule for Dozen already exists.');
      }).toThrow(`A conversion rule for ${dozen.name} already exists.`);
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

  });

  describe('setPurchaseUnit and setSaleUnit', () => {
    it('successfully sets to base unit', () => {

      config.setPurchaseUnit(baseDiscrete);
      config.setSaleUnit(baseDiscrete);

      expect(config.purchaseUnit).toBe(baseDiscrete);
      expect(config.saleUnit).toBe(baseDiscrete);

    it('successfully sets to a unit with a defined conversion rule', () => {
    it('should successfully remove an existing rule', () => {
      const dozen = StandardUnits.dozen();
      expect(config.conversionRules.length).toBe(1);

      expect(config.conversionRules.length).toBe(0);

    it('should safely ignore removing a non-existent rule', () => {

      const anotherUnit = new UnitOfMeasure('Pallet', 'pal', UomCategory.Discrete);
      config.removeConversionRule(anotherUnit);

  describe('setPurchaseUnit / setSaleUnit', () => {
    it('should allow setting purchase and sale unit to baseUnit', () => {
      config.setPurchaseUnit(baseUnit);
      config.setSaleUnit(baseUnit);

      expect(config.purchaseUnit).toBe(baseUnit);
      expect(config.saleUnit).toBe(baseUnit);

    it('should allow setting to a unit with a valid conversion rule', () => {
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

        config.setSaleUnit(otherDiscrete);
    it('should throw error when setting purchase unit to an unknown unit', () => {
      const unknownUnit = StandardUnits.dozen();
        config.setPurchaseUnit(unknownUnit);
      }).toThrow(`Unit ${unknownUnit.name} has no conversion rule defined.`);
    });

    it('should throw error when setting sale unit to an unknown unit', () => {
        config.setSaleUnit(unknownUnit);
    });
  });

  describe('factorToBase', () => {
    it('returns 1.0 for the base unit', () => {
      const config = new ProductUomConfiguration(testSku, baseDiscrete);
      expect(config.factorToBase(baseDiscrete)).toBe(1.0);
    });

    it('returns the correct factor from a custom conversion rule', () => {
      config.addConversionRule(dozen, 12);
      expect(config.factorToBase(dozen)).toBe(12);

    it('returns correct factors for standard Weight conversions', () => {
      const kg = StandardUnits.kilogram();
      const gram = StandardUnits.gram();
      const config = new ProductUomConfiguration(testSku, gram);

      expect(config.factorToBase(kg)).toBe(1000);

    it('returns correct factors for standard Volume conversions', () => {
      const liter = StandardUnits.liter();
      const ml = StandardUnits.milliliter();
      const config = new ProductUomConfiguration(testSku, ml);

      expect(config.factorToBase(liter)).toBe(1000);

    it('throws an error for an unknown unit', () => {

      expect(() => {
        config.factorToBase(otherDiscrete);
      }).toThrow('No conversion rule found for Box -> Each.');
    it('should return 1.0 for the base unit', () => {
      expect(config.factorToBase(baseUnit)).toBe(1.0);

    it('should return correct values from manually added conversion rules', () => {
      const dozen = StandardUnits.dozen();


    it('should work properly for predefined units in Weight category', () => {
      const weightConfig = new ProductUomConfiguration(sku, StandardUnits.kilogram());

      expect(weightConfig.factorToBase(gram)).toBe(1.0 / 1000.0);

      const pound = StandardUnits.pound();
      const lbFactor = StandardUnits.weightFactorToGrams(pound);
      const kgFactor = StandardUnits.weightFactorToGrams(StandardUnits.kilogram());
      expect(weightConfig.factorToBase(pound)).toBe(lbFactor / kgFactor);

    it('should work properly for predefined units in Volume category', () => {
      const volumeConfig = new ProductUomConfiguration(sku, StandardUnits.liter());

      expect(volumeConfig.factorToBase(ml)).toBe(1.0 / 1000.0);

      const gal = StandardUnits.gallon();
      const galFactor = StandardUnits.volumeFactorToMilliliters(gal);
      const literFactor = StandardUnits.volumeFactorToMilliliters(StandardUnits.liter());
      expect(volumeConfig.factorToBase(gal)).toBe(galFactor / literFactor);

    it('should throw error for unknown units without conversion rule', () => {
      const unknownUnit = StandardUnits.dozen();
        config.factorToBase(unknownUnit);
      }).toThrow(`No conversion rule found for ${unknownUnit.name} -> ${baseUnit.name}.`);
    });
  });
});
