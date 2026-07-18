import { Quantity } from '../../../src/domain/valueObjects/Quantity';
import { StandardUnits } from '../../../src/domain/services/StandardUnits';

describe('Quantity Value Object', () => {
  describe('creation', () => {
    it('should create a valid quantity with default unit (each)', () => {
      const q = new Quantity(10);
      expect(q.amount).toBe(10);
      expect(q.value).toBe(10);
      expect(q.unit.name).toBe('Each');
    });

    it('should create a valid quantity with specific unit', () => {
      const q = new Quantity(5.5, StandardUnits.kilogram());
      expect(q.amount).toBe(5.5);
      expect(q.unit.name).toBe('Kilogram');
    });

    it('should throw an error for negative amount', () => {
      expect(() => new Quantity(-1)).toThrow('Quantity amount cannot be negative.');
    });
  });

  describe('add', () => {
    it('should add two quantities with the same unit', () => {
      const q1 = new Quantity(10, StandardUnits.kilogram());
      const q2 = new Quantity(5, StandardUnits.kilogram());
      const result = q1.add(q2);
      expect(result.amount).toBe(15);
      expect(result.unit.name).toBe('Kilogram');
    });

    it('should throw an error when adding quantities with different units', () => {
      const q1 = new Quantity(10, StandardUnits.each());
      const q2 = new Quantity(5, StandardUnits.kilogram());
      expect(() => q1.add(q2)).toThrow('Cannot operate on different units: Each vs Kilogram');
    });
  });

  describe('subtract', () => {
    it('should subtract two quantities with the same unit', () => {
      const q1 = new Quantity(10, StandardUnits.kilogram());
      const q2 = new Quantity(3, StandardUnits.kilogram());
      const result = q1.subtract(q2);
      expect(result.amount).toBe(7);
      expect(result.unit.name).toBe('Kilogram');
    });

    it('should throw an error when subtracting quantities with different units', () => {
      const q1 = new Quantity(10, StandardUnits.each());
      const q2 = new Quantity(5, StandardUnits.kilogram());
      expect(() => q1.subtract(q2)).toThrow('Cannot operate on different units: Each vs Kilogram');
    });

    it('should throw an error if the resulting quantity would be negative', () => {
      const q1 = new Quantity(5, StandardUnits.kilogram());
      const q2 = new Quantity(10, StandardUnits.kilogram());
      expect(() => q1.subtract(q2)).toThrow('Resulting quantity would be negative.');
    });
  });

  describe('multiplyBy', () => {
    it('should multiply the quantity by a factor', () => {
      const q = new Quantity(10, StandardUnits.kilogram());
      const result = q.multiplyBy(2.5);
      expect(result.amount).toBe(25);
      expect(result.unit.name).toBe('Kilogram');
    });
  });

  describe('toBaseInteger', () => {
    it('should return the amount for discrete quantities', () => {
      const q = new Quantity(5, StandardUnits.each());
      expect(q.toBaseInteger()).toBe(5);
    });

    it('should throw an error for continuous quantities', () => {
      const q = new Quantity(5, StandardUnits.kilogram());
      expect(() => q.toBaseInteger()).toThrow(
        'Use toBaseInteger() only for discrete quantities. ' +
        'Continuous quantities should be converted to their smallest unit (g, ml) first.'
      );
    });

    it('should throw an error for discrete quantities that are not whole numbers', () => {
      const q = new Quantity(5.5, StandardUnits.each());
      expect(() => q.toBaseInteger()).toThrow('Discrete quantity must be a whole number; got 5.5 ea.');
    });
  });

  describe('equals', () => {
    it('should return true for identical quantities', () => {
      const q1 = new Quantity(10, StandardUnits.kilogram());
      const q2 = new Quantity(10, StandardUnits.kilogram());
      expect(q1.equals(q2)).toBe(true);
    });

    it('should return false for different amounts', () => {
      const q1 = new Quantity(10, StandardUnits.kilogram());
      const q2 = new Quantity(5, StandardUnits.kilogram());
      expect(q1.equals(q2)).toBe(false);
    });

    it('should return false for different units', () => {
      const q1 = new Quantity(10, StandardUnits.each());
      const q2 = new Quantity(10, StandardUnits.kilogram());
      expect(q1.equals(q2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should format the quantity correctly', () => {
      const q = new Quantity(10, StandardUnits.kilogram());
      expect(q.toString()).toBe('10 kg');
    });
  });

  describe('assertSameUnit (indirect)', () => {
    it('should pass silently when operating on quantities with the same unit (via add)', () => {
      const q1 = new Quantity(10, StandardUnits.kilogram());
      const q2 = new Quantity(5, StandardUnits.kilogram());
      // Tested indirectly via add
      expect(() => q1.add(q2)).not.toThrow();
    });

    it('should throw an error when operating on quantities with different units (via add)', () => {
      const q1 = new Quantity(10, StandardUnits.each());
      const q2 = new Quantity(5, StandardUnits.kilogram());
      // Tested indirectly via add
      expect(() => q1.add(q2)).toThrow('Cannot operate on different units: Each vs Kilogram');
    });

    it('should pass silently when operating on quantities with the same unit (via subtract)', () => {
      const q1 = new Quantity(10, StandardUnits.kilogram());
      const q2 = new Quantity(5, StandardUnits.kilogram());
      // Tested indirectly via subtract
      expect(() => q1.subtract(q2)).not.toThrow();
    });

    it('should throw an error when operating on quantities with different units (via subtract)', () => {
      const q1 = new Quantity(10, StandardUnits.each());
      const q2 = new Quantity(5, StandardUnits.kilogram());
      // Tested indirectly via subtract
      expect(() => q1.subtract(q2)).toThrow('Cannot operate on different units: Each vs Kilogram');
    });
  });
});
