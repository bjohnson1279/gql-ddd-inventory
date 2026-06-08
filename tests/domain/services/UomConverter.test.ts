import { UomConverter } from '../../../src/domain/services/UomConverter';
import { Quantity } from '../../../src/domain/valueObjects/Quantity';
import { UnitOfMeasure } from '../../../src/domain/valueObjects/UnitOfMeasure';
import { ProductUomConfiguration } from '../../../src/domain/entities/ProductUomConfiguration';
import { StandardUnits } from '../../../src/domain/services/StandardUnits';
import { Sku } from '../../../src/domain/valueObjects/Sku';

describe('UomConverter', () => {
  const sku = new Sku('TEST-1');
  let converter: UomConverter;
  let config: ProductUomConfiguration;

  beforeEach(() => {
    converter = new UomConverter();
    config = new ProductUomConfiguration(sku, StandardUnits.each());
    config.addConversionRule(StandardUnits.dozen(), 12);
  });

  describe('convert()', () => {
    it('should return the original quantity if units are the same', () => {
      const qty = new Quantity(5, StandardUnits.each());
      const result = converter.convert(qty, StandardUnits.each(), config);
      expect(result).toBe(qty);
    });

    it('should convert from base to another unit correctly', () => {
      const qty = new Quantity(24, StandardUnits.each());
      const result = converter.convert(qty, StandardUnits.dozen(), config);
      expect(result.amount).toBe(2);
      expect(result.unit.equals(StandardUnits.dozen())).toBe(true);
    });

    it('should convert from another unit to base correctly', () => {
      const qty = new Quantity(3, StandardUnits.dozen());
      const result = converter.convert(qty, StandardUnits.each(), config);
      expect(result.amount).toBe(36);
      expect(result.unit.equals(StandardUnits.each())).toBe(true);
    });

    it('should throw an error if units are incompatible', () => {
      const qty = new Quantity(5, StandardUnits.each());
      expect(() => {
        converter.convert(qty, StandardUnits.kilogram(), config);
      }).toThrow('Cannot convert discrete to weight.');
    });
  });

  describe('toBaseUnit()', () => {
    it('should convert a quantity to the base unit', () => {
      const qty = new Quantity(5, StandardUnits.dozen());
      const result = converter.toBaseUnit(qty, config);
      expect(result.amount).toBe(60);
      expect(result.unit.equals(StandardUnits.each())).toBe(true);
    });
  });

  describe('convertCost()', () => {
    it('should return the original cost if units are the same', () => {
      const cost = converter.convertCost(120, StandardUnits.each(), StandardUnits.each(), config);
      expect(cost).toBe(120);
    });

    it('should convert cost from a larger unit to a smaller unit', () => {
      // 1440 cents per dozen -> 120 cents per each
      const cost = converter.convertCost(1440, StandardUnits.dozen(), StandardUnits.each(), config);
      expect(cost).toBe(120);
    });

    it('should convert cost from a smaller unit to a larger unit', () => {
      // 120 cents per each -> 1440 cents per dozen
      const cost = converter.convertCost(120, StandardUnits.each(), StandardUnits.dozen(), config);
      expect(cost).toBe(1440);
    });
  });
});
