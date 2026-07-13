import { IntegrationId } from '../../src/domain/integrations/valueObjects/IntegrationId';
import { ActorId } from '../../src/domain/valueObjects/ActorId';
import { BarcodeAssignmentId } from '../../src/domain/valueObjects/BarcodeAssignmentId';
import { ConversionRuleId } from '../../src/domain/valueObjects/ConversionRuleId';
import { JournalEntryId } from '../../src/domain/valueObjects/JournalEntryId';
import { KitId } from '../../src/domain/valueObjects/KitId';
import { LedgerEntryId } from '../../src/domain/valueObjects/LedgerEntryId';
import { ProductId } from '../../src/domain/valueObjects/ProductId';
import { ProductVariantId } from '../../src/domain/valueObjects/ProductVariantId';
import { SerializedItemId } from '../../src/domain/valueObjects/SerializedItemId';
import { StockOnboardingId } from '../../src/domain/valueObjects/StockOnboardingId';
import { TenantId } from '../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../src/domain/valueObjects/LocationId';
import { SerialNumber } from '../../src/domain/valueObjects/SerialNumber';
import { Sku } from '../../src/domain/valueObjects/Sku';
import { Barcode } from '../../src/domain/valueObjects/Barcode';
import { BarcodeSymbology } from '../../src/domain/enums/BarcodeEnums';
import { Quantity } from '../../src/domain/valueObjects/Quantity';
import { StandardUnits } from '../../src/domain/services/StandardUnits';
import { UnitOfMeasure } from '../../src/domain/valueObjects/UnitOfMeasure';
import { UomCategory } from '../../src/domain/enums/UomCategory';
import { VariantAttribute } from '../../src/domain/valueObjects/VariantAttribute';
import { KitComponent } from '../../src/domain/valueObjects/KitComponent';
import { JournalLine } from '../../src/domain/entities/JournalLine';
import { AccountCode } from '../../src/domain/valueObjects/AccountCode';
import { DebitCredit } from '../../src/domain/enums/AccountingEnums';
import { InventoryCostLayer, InventoryCostLayerId } from '../../src/domain/entities/InventoryCostLayer';
import { ConversionRule } from '../../src/domain/entities/ConversionRule';

describe('Domain Validation Suite', () => {
  describe('ID-based Value Objects', () => {
    const idClasses = [
      { name: 'IntegrationId', cls: IntegrationId },
      { name: 'ActorId', cls: ActorId },
      { name: 'BarcodeAssignmentId', cls: BarcodeAssignmentId },
      { name: 'ConversionRuleId', cls: ConversionRuleId },
      { name: 'JournalEntryId', cls: JournalEntryId },
      { name: 'KitId', cls: KitId },
      { name: 'LedgerEntryId', cls: LedgerEntryId },
      { name: 'ProductId', cls: ProductId },
      { name: 'ProductVariantId', cls: ProductVariantId },
      { name: 'SerializedItemId', cls: SerializedItemId },
      { name: 'StockOnboardingId', cls: StockOnboardingId },
      { name: 'TenantId', cls: TenantId },
      { name: 'LocationId', cls: LocationId },
    ];

    idClasses.forEach(({ name, cls }) => {
      it(`${name} should throw error when empty`, () => {
        expect(() => new (cls as any)('')).toThrow(`${name} cannot be empty`);
        expect(() => new (cls as any)('   ')).toThrow(`${name} cannot be empty`);
      });

      it(`${name} should correctly compare equality`, () => {
        const id1 = new (cls as any)('ID-1');
        const id2 = new (cls as any)('ID-1');
        const id3 = new (cls as any)('ID-2');
        expect(id1.equals(id2)).toBe(true);
        expect(id1.equals(id3)).toBe(false);
      });
    });
  });

  describe('Complex Value Objects', () => {
    it('SerialNumber should validate correctly', () => {
      expect(() => new SerialNumber('')).toThrow('Serial number cannot be empty');
      expect(() => new SerialNumber('a'.repeat(101))).toThrow('cannot exceed 100 characters');
      expect(() => new SerialNumber('INVALID!@#')).toThrow('contains invalid characters');
    });

    it('Sku should validate correctly', () => {
      expect(() => new Sku('')).toThrow('SKU cannot be empty');
      expect(() => new Sku('INVALID SKU!')).toThrow('alphanumeric characters and hyphens');
    });

    it('Barcode should validate symbology-specific length rules', () => {
      expect(() => new Barcode(BarcodeSymbology.UPC_A, '123')).toThrow('must be exactly 12 digits');
      expect(() => new Barcode(BarcodeSymbology.EAN_13, '123')).toThrow('must be exactly 13 digits');
      expect(() => new Barcode(BarcodeSymbology.EAN_8, '123')).toThrow('must be exactly 8 digits');
      expect(() => new Barcode(BarcodeSymbology.UPC_E, '123')).toThrow('must be exactly 8 digits');
      expect(() => new Barcode(BarcodeSymbology.ITF_14, '123')).toThrow('must be exactly 14 digits');
      expect(() => new Barcode(BarcodeSymbology.CODE_128, '')).toThrow('cannot be empty');
    });

    it('Barcode should validate symbology-specific numeric rules', () => {
      expect(() => new Barcode(BarcodeSymbology.UPC_A, '12345678901A')).toThrow('must contain only digits');
      expect(() => new Barcode(BarcodeSymbology.EAN_13, '123456789012A')).toThrow('must contain only digits');
      expect(() => new Barcode(BarcodeSymbology.EAN_8, '1234567A')).toThrow('must contain only digits');
      expect(() => new Barcode(BarcodeSymbology.UPC_E, '1234567A')).toThrow('must contain only digits');
      expect(() => new Barcode(BarcodeSymbology.ITF_14, '1234567890123A')).toThrow('must contain only digits');
    });

    it('Barcode should allow valid symbology inputs', () => {
      expect(new Barcode(BarcodeSymbology.UPC_A, '123456789012').value).toBe('123456789012');
      expect(new Barcode(BarcodeSymbology.EAN_13, '1234567890123').value).toBe('1234567890123');
      expect(new Barcode(BarcodeSymbology.EAN_8, '12345678').value).toBe('12345678');
      expect(new Barcode(BarcodeSymbology.UPC_E, '12345678').value).toBe('12345678');
      expect(new Barcode(BarcodeSymbology.ITF_14, '12345678901234').value).toBe('12345678901234');
      expect(new Barcode(BarcodeSymbology.CODE_128, 'VALID-128').value).toBe('VALID-128');
      expect(new Barcode(BarcodeSymbology.QR, 'ANYTHING_GOES').value).toBe('ANYTHING_GOES');
    });

    it('Quantity should throw error for negative amount', () => {
      expect(() => new Quantity(-1)).toThrow('amount cannot be negative');
    });

    it('UnitOfMeasure should throw error for empty name/abbreviation', () => {
      expect(() => new UnitOfMeasure('', 'ea', UomCategory.Discrete)).toThrow('must be non-empty');
      expect(() => new UnitOfMeasure('Each', '', UomCategory.Discrete)).toThrow('must be non-empty');
    });

    it('VariantAttribute should throw error for empty name/value', () => {
      expect(() => new VariantAttribute('', 'Red')).toThrow('must be non-empty');
      expect(() => new VariantAttribute('Color', '')).toThrow('must be non-empty');
    });

    it('KitComponent should throw error for quantity < 1', () => {
      expect(() => new KitComponent(new ProductVariantId('V1'), 0)).toThrow('must be at least 1');
    });

    it('StockOnboardingItem should throw for negative or non-integer values', () => {
      const { StockOnboardingItem } = require('../../src/domain/valueObjects/StockOnboardingItem');
      const vId = new ProductVariantId('V1');
      expect(() => new StockOnboardingItem(vId, -1, 100)).toThrow('cannot be negative');
      expect(() => new StockOnboardingItem(vId, 1.5, 100)).toThrow('must be an integer');
      expect(() => new StockOnboardingItem(vId, 10, -1)).toThrow('Unit cost cannot be negative');
      expect(() => new StockOnboardingItem(vId, 10, 1.5)).toThrow('Unit cost must be an integer');
    });
  });

  describe('Domain Services - StandardUnits', () => {
    it('should have correct factors for all weight units', () => {
      expect(StandardUnits.weightFactorToGrams(StandardUnits.gram())).toBe(1.0);
      expect(StandardUnits.weightFactorToGrams(StandardUnits.kilogram())).toBe(1000.0);
      expect(StandardUnits.weightFactorToGrams(StandardUnits.ounce())).toBeCloseTo(28.3495);
      expect(StandardUnits.weightFactorToGrams(StandardUnits.pound())).toBeCloseTo(453.592);
      expect(() => StandardUnits.weightFactorToGrams(StandardUnits.each())).toThrow('Unknown weight unit');
    });

    it('should have correct factors for all volume units', () => {
      expect(StandardUnits.volumeFactorToMilliliters(StandardUnits.milliliter())).toBe(1.0);
      expect(StandardUnits.volumeFactorToMilliliters(StandardUnits.liter())).toBe(1000.0);
      expect(StandardUnits.volumeFactorToMilliliters(StandardUnits.fluidOunce())).toBeCloseTo(29.5735);
      expect(StandardUnits.volumeFactorToMilliliters(StandardUnits.gallon())).toBeCloseTo(3785.41);
      expect(() => StandardUnits.volumeFactorToMilliliters(StandardUnits.each())).toThrow('Unknown volume unit');
    });
  });

  describe('AccountCode', () => {
    it('should correctly initialize all standard accounts', () => {
      expect(AccountCode.cash().code).toBe('1000');
      expect(AccountCode.accountsReceivable().code).toBe('1100');
      expect(AccountCode.inventory().code).toBe('1200');
      expect(AccountCode.accountsPayable().code).toBe('2000');
      expect(AccountCode.salesRevenue().code).toBe('4000');
      expect(AccountCode.costOfGoodsSold().code).toBe('5000');
    });
  });

  describe('VariantAttributeSet', () => {
    const { VariantAttributeSet } = require('../../src/domain/valueObjects/VariantAttributeSet');
    
    it('should sort attributes by name', () => {
      const a1 = new VariantAttribute('size', 'L');
      const a2 = new VariantAttribute('color', 'Red');
      const set = new VariantAttributeSet([a1, a2]);
      const all = set.all();
      expect(all[0].name).toBe('color');
      expect(all[1].name).toBe('size');
    });

    it('should correctly compare equality', () => {
      const set1 = new VariantAttributeSet([new VariantAttribute('a', '1'), new VariantAttribute('b', '2')]);
      const set2 = new VariantAttributeSet([new VariantAttribute('b', '2'), new VariantAttribute('a', '1')]);
      const set3 = new VariantAttributeSet([new VariantAttribute('a', '1')]);
      
      expect(set1.equals(set2)).toBe(true);
      expect(set1.equals(set3)).toBe(false);
    });

    it('should throw error for empty attribute list', () => {
      expect(() => new VariantAttributeSet([])).toThrow('at least one attribute');
    });
  });

  describe('Entity Constructor Validation', () => {
    it('JournalLine should throw for non-positive amount', () => {
      expect(() => new JournalLine(AccountCode.cash(), 0, DebitCredit.Debit)).toThrow('must be positive');
    });

    it('LedgerEntry should throw for zero or non-integer quantity', () => {
      const { LedgerEntry } = require('../../src/domain/entities/LedgerEntry');
      const vId = new ProductVariantId('V1');
      const tId = new TenantId('T1');
      const lId = new LocationId('L1');
      const eId = new LedgerEntryId('E1');
      const actor = new ActorId('A1');
      const { ReasonCode } = require('../../src/domain/enums/ReasonCode');

      expect(() => new LedgerEntry(eId, tId, lId, vId, 0, ReasonCode.Sale, actor, new Date())).toThrow('cannot be zero');
      expect(() => new LedgerEntry(eId, tId, lId, vId, 1.5, ReasonCode.Sale, actor, new Date())).toThrow('must be an integer');
    });

    it('InventoryCostLayer should throw for non-positive quantity or negative cost', () => {
      const vId = new ProductVariantId('V1');
      const lId = new InventoryCostLayerId('L1');
      expect(() => new InventoryCostLayer(lId, vId, 0, 100, new Date())).toThrow('must be positive');
      expect(() => new InventoryCostLayer(lId, vId, 10, -1, new Date())).toThrow('cannot be negative');
    });

    it('ConversionRule should throw for non-positive factor', () => {
      expect(() => new ConversionRule(new ConversionRuleId('R1'), StandardUnits.each(), 0)).toThrow('must be positive');
    });
  });
});
