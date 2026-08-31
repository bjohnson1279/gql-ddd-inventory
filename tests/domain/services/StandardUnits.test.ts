import { StandardUnits } from '../../../src/domain/services/StandardUnits';
import { UnitOfMeasure } from '../../../src/domain/valueObjects/UnitOfMeasure';
import { UomCategory } from '../../../src/domain/enums/UomCategory';

describe('StandardUnits', () => {
  describe('Discrete units', () => {
    it('should create an each unit', () => {
      const uom = StandardUnits.each();
      expect(uom.name).toBe('Each');
      expect(uom.abbreviation).toBe('ea');
      expect(uom.category).toBe(UomCategory.Discrete);
    });

    it('should create a dozen unit', () => {
      const uom = StandardUnits.dozen();
      expect(uom.name).toBe('Dozen');
      expect(uom.abbreviation).toBe('dz');
      expect(uom.category).toBe(UomCategory.Discrete);
    });
  });

  describe('Weight units', () => {
    it('should create a gram unit', () => {
      const uom = StandardUnits.gram();
      expect(uom.name).toBe('Gram');
      expect(uom.abbreviation).toBe('g');
      expect(uom.category).toBe(UomCategory.Weight);
    });

    it('should create a kilogram unit', () => {
      const uom = StandardUnits.kilogram();
      expect(uom.name).toBe('Kilogram');
      expect(uom.abbreviation).toBe('kg');
      expect(uom.category).toBe(UomCategory.Weight);
    });

    it('should create an ounce unit', () => {
      const uom = StandardUnits.ounce();
      expect(uom.name).toBe('Ounce');
      expect(uom.abbreviation).toBe('oz');
      expect(uom.category).toBe(UomCategory.Weight);
    });

    it('should create a pound unit', () => {
      const uom = StandardUnits.pound();
      expect(uom.name).toBe('Pound');
      expect(uom.abbreviation).toBe('lb');
      expect(uom.category).toBe(UomCategory.Weight);
    });
  });

  describe('Volume units', () => {
    it('should create a milliliter unit', () => {
      const uom = StandardUnits.milliliter();
      expect(uom.name).toBe('Milliliter');
      expect(uom.abbreviation).toBe('ml');
      expect(uom.category).toBe(UomCategory.Volume);
    });

    it('should create a liter unit', () => {
      const uom = StandardUnits.liter();
      expect(uom.name).toBe('Liter');
      expect(uom.abbreviation).toBe('l');
      expect(uom.category).toBe(UomCategory.Volume);
    });

    it('should create a fluid ounce unit', () => {
      const uom = StandardUnits.fluidOunce();
      expect(uom.name).toBe('Fluid Ounce');
      expect(uom.abbreviation).toBe('fl oz');
      expect(uom.category).toBe(UomCategory.Volume);
    });

    it('should create a gallon unit', () => {
      const uom = StandardUnits.gallon();
      expect(uom.name).toBe('Gallon');
      expect(uom.abbreviation).toBe('gal');
      expect(uom.category).toBe(UomCategory.Volume);
    });
  });

  describe('weightFactorToGrams', () => {
    it('should return correct factor for Gram', () => {
      expect(StandardUnits.weightFactorToGrams(StandardUnits.gram())).toBe(1.0);
    });

    it('should return correct factor for Kilogram', () => {
      expect(StandardUnits.weightFactorToGrams(StandardUnits.kilogram())).toBe(1000.0);
    });

    it('should return correct factor for Ounce', () => {
      expect(StandardUnits.weightFactorToGrams(StandardUnits.ounce())).toBe(28.3495);
    });

    it('should return correct factor for Pound', () => {
      expect(StandardUnits.weightFactorToGrams(StandardUnits.pound())).toBe(453.592);
    });

    it('should throw error for unknown weight unit', () => {
      const unknownUnit = new UnitOfMeasure('Stone', 'st', UomCategory.Weight);
      expect(() => StandardUnits.weightFactorToGrams(unknownUnit)).toThrow('Unknown weight unit: Stone');
    });
  });

  describe('volumeFactorToMilliliters', () => {
    it('should return correct factor for Milliliter', () => {
      expect(StandardUnits.volumeFactorToMilliliters(StandardUnits.milliliter())).toBe(1.0);
    });

    it('should return correct factor for Liter', () => {
      expect(StandardUnits.volumeFactorToMilliliters(StandardUnits.liter())).toBe(1000.0);
    });

    it('should return correct factor for Fluid Ounce', () => {
      expect(StandardUnits.volumeFactorToMilliliters(StandardUnits.fluidOunce())).toBe(29.5735);
    });

    it('should return correct factor for Gallon', () => {
      expect(StandardUnits.volumeFactorToMilliliters(StandardUnits.gallon())).toBe(3785.41);
    });

    it('should throw error for unknown volume unit', () => {
      const unknownUnit = new UnitOfMeasure('Pint', 'pt', UomCategory.Volume);
      expect(() => StandardUnits.volumeFactorToMilliliters(unknownUnit)).toThrow('Unknown volume unit: Pint');
    });
  });
});
