import { Sku } from '../../src/domain/valueObjects/Sku';
import { StandardUnits } from '../../src/domain/services/StandardUnits';
import { ProductUomConfiguration } from '../../src/domain/entities/ProductUomConfiguration';
import { UomConverter } from '../../src/domain/services/UomConverter';
import { Quantity } from '../../src/domain/valueObjects/Quantity';

describe('UoM Conversions', () => {
  const sku = new Sku('WIDGET-1');
  const converter = new UomConverter();

  it('should convert discrete units correctly', () => {
    const config = new ProductUomConfiguration(sku, StandardUnits.each());
    config.addConversionRule(StandardUnits.dozen(), 12);
    
    const dozenQty = new Quantity(2, StandardUnits.dozen());
    const eachQty = converter.toBaseUnit(dozenQty, config);
    
    expect(eachQty.amount).toBe(24);
    expect(eachQty.unit.equals(StandardUnits.each())).toBe(true);
  });

  it('should convert weight units correctly', () => {
    const config = new ProductUomConfiguration(sku, StandardUnits.kilogram());
    
    const gramQty = new Quantity(500, StandardUnits.gram());
    const kgQty = converter.toBaseUnit(gramQty, config);
    
    expect(kgQty.amount).toBe(0.5);
    expect(kgQty.unit.equals(StandardUnits.kilogram())).toBe(true);
  });

  it('should convert volume units correctly', () => {
    const config = new ProductUomConfiguration(sku, StandardUnits.liter());
    
    const mlQty = new Quantity(1500, StandardUnits.milliliter());
    const lQty = converter.toBaseUnit(mlQty, config);
    
    expect(lQty.amount).toBe(1.5);
    expect(lQty.unit.equals(StandardUnits.liter())).toBe(true);
  });

  it('should convert cost correctly', () => {
    const config = new ProductUomConfiguration(sku, StandardUnits.each());
    config.addConversionRule(StandardUnits.dozen(), 12);
    
    const costPerDozen = 1440; // $14.40
    const costPerEach = converter.convertCost(
      costPerDozen,
      StandardUnits.dozen(),
      StandardUnits.each(),
      config
    );
    
    expect(costPerEach).toBe(120); // $1.20
  });

  it('should throw error for incompatible units', () => {
    const config = new ProductUomConfiguration(sku, StandardUnits.each());
    const qty = new Quantity(1, StandardUnits.kilogram());
    
    expect(() => converter.toBaseUnit(qty, config)).toThrow('Cannot convert weight to discrete');
  });

  describe('Quantity', () => {
    it('should add quantities of the same unit', () => {
      const q1 = new Quantity(10, StandardUnits.each());
      const q2 = new Quantity(5, StandardUnits.each());
      const result = q1.add(q2);
      expect(result.amount).toBe(15);
    });

    it('should throw error when adding different units', () => {
      const q1 = new Quantity(10, StandardUnits.each());
      const q2 = new Quantity(5, StandardUnits.dozen());
      expect(() => q1.add(q2)).toThrow('Cannot operate on different units: Each vs Dozen');
    });

    it('should subtract quantities of the same unit', () => {
      const q1 = new Quantity(10, StandardUnits.each());
      const q2 = new Quantity(4, StandardUnits.each());
      const result = q1.subtract(q2);
      expect(result.amount).toBe(6);
    });

    it('should throw error when subtracting more than available', () => {
      const q1 = new Quantity(10, StandardUnits.each());
      const q2 = new Quantity(15, StandardUnits.each());
      expect(() => q1.subtract(q2)).toThrow('Resulting quantity would be negative');
    });

    it('should multiply quantity by factor', () => {
      const q1 = new Quantity(10, StandardUnits.each());
      const result = q1.multiplyBy(2.5);
      expect(result.amount).toBe(25);
    });

    it('should convert to base integer for discrete units', () => {
      const q = new Quantity(10, StandardUnits.each());
      expect(q.toBaseInteger()).toBe(10);
    });

    it('should throw error when converting non-integer discrete quantity to base integer', () => {
      const q = new Quantity(10.5, StandardUnits.each());
      expect(() => q.toBaseInteger()).toThrow('Discrete quantity must be a whole number');
    });

    it('should throw error when calling toBaseInteger on non-discrete unit', () => {
      const q = new Quantity(10, StandardUnits.gram());
      expect(() => q.toBaseInteger()).toThrow('Use toBaseInteger() only for discrete quantities');
    });
  });

  describe('ProductUomConfiguration', () => {
    it('should manage purchase and sale units', () => {
      const config = new ProductUomConfiguration(sku, StandardUnits.each());
      config.addConversionRule(StandardUnits.dozen(), 12);
      
      config.setPurchaseUnit(StandardUnits.dozen());
      config.setSaleUnit(StandardUnits.each());
      
      expect(config.purchaseUnit.equals(StandardUnits.dozen())).toBe(true);
      expect(config.saleUnit.equals(StandardUnits.each())).toBe(true);
    });

    it('should throw error when setting unknown unit as purchase/sale unit', () => {
      const config = new ProductUomConfiguration(sku, StandardUnits.each());
      expect(() => config.setPurchaseUnit(StandardUnits.dozen())).toThrow('has no conversion rule defined');
    });

    it('should remove conversion rule', () => {
      const config = new ProductUomConfiguration(sku, StandardUnits.each());
      config.addConversionRule(StandardUnits.dozen(), 12);
      expect(config.conversionRules).toHaveLength(1);
      
      config.removeConversionRule(StandardUnits.dozen());
      expect(config.conversionRules).toHaveLength(0);
    });

    it('should throw error when adding duplicate conversion rule', () => {
      const config = new ProductUomConfiguration(sku, StandardUnits.each());
      config.addConversionRule(StandardUnits.dozen(), 12);
      expect(() => config.addConversionRule(StandardUnits.dozen(), 12)).toThrow('already exists');
    });

    it('should throw error for incompatible base unit conversion', () => {
      const config = new ProductUomConfiguration(sku, StandardUnits.each());
      expect(() => config.addConversionRule(StandardUnits.kilogram(), 1))
        .toThrow('Unit Kilogram is not compatible with base unit Each.');
    });

    it('should throw error when adding a conversion rule for the base unit itself', () => {
      const config = new ProductUomConfiguration(sku, StandardUnits.each());
      expect(() => config.addConversionRule(StandardUnits.each(), 1))
        .toThrow('Cannot add a conversion rule for the base unit itself.');
    });
  });
});
