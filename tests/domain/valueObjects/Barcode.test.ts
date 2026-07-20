import { Barcode } from '../../../src/domain/valueObjects/Barcode';
import { BarcodeSymbology } from '../../../src/domain/enums/BarcodeEnums';

describe('Barcode', () => {
  describe('Constructor & formatting', () => {
    it('should trim and uppercase the raw value', () => {
      const barcode = new Barcode(BarcodeSymbology.CODE_128, '  abc-123  ');
      expect(barcode.value).toBe('ABC-123');
    });
  });

  describe('Validation by Symbology', () => {
    describe('UPC_A', () => {
      it('should accept valid 12-digit numeric values', () => {
        expect(() => new Barcode(BarcodeSymbology.UPC_A, '123456789012')).not.toThrow();
      });
      it('should throw if length is not exactly 12', () => {
        expect(() => new Barcode(BarcodeSymbology.UPC_A, '12345678901')).toThrow('Invalid UPC-A length. Expected 12.');
        expect(() => new Barcode(BarcodeSymbology.UPC_A, '1234567890123')).toThrow('Invalid UPC-A length. Expected 12.');
      });
      it('should throw if not purely numeric', () => {
        expect(() => new Barcode(BarcodeSymbology.UPC_A, '12345678901A')).toThrow('UPC-A must contain only digits');
      });
    });

    describe('EAN_13', () => {
      it('should accept valid 13-digit numeric values', () => {
        expect(() => new Barcode(BarcodeSymbology.EAN_13, '1234567890123')).not.toThrow();
      });
      it('should throw if length is not exactly 13', () => {
        expect(() => new Barcode(BarcodeSymbology.EAN_13, '123456789012')).toThrow('Invalid EAN-13 length. Expected 13.');
      });
    });

    describe('UPC_E / EAN_8', () => {
      it('should accept valid 8-digit numeric values for UPC_E', () => {
        expect(() => new Barcode(BarcodeSymbology.UPC_E, '12345678')).not.toThrow();
      });
      it('should accept valid 8-digit numeric values for EAN_8', () => {
        expect(() => new Barcode(BarcodeSymbology.EAN_8, '12345678')).not.toThrow();
      });
      it('should throw if length is not exactly 8', () => {
        expect(() => new Barcode(BarcodeSymbology.UPC_E, '1234567')).toThrow('Invalid UPC-E length. Expected 8.');
        expect(() => new Barcode(BarcodeSymbology.EAN_8, '123456789')).toThrow('Invalid EAN-8 length. Expected 8.');
      });
    });

    describe('ITF_14', () => {
      it('should accept valid 14-digit numeric values', () => {
        expect(() => new Barcode(BarcodeSymbology.ITF_14, '12345678901234')).not.toThrow();
      });
      it('should throw if length is not exactly 14', () => {
        expect(() => new Barcode(BarcodeSymbology.ITF_14, '1234567890123')).toThrow('Invalid ITF-14 length. Expected 14.');
      });
    });

    describe('CODE_128 / GS1_128', () => {
      it('should accept non-empty alphanumeric values', () => {
        expect(() => new Barcode(BarcodeSymbology.CODE_128, 'ABC-123')).not.toThrow();
        expect(() => new Barcode(BarcodeSymbology.GS1_128, 'GS1-XYZ-999')).not.toThrow();
      });
      it('should throw if empty', () => {
        expect(() => new Barcode(BarcodeSymbology.CODE_128, '   ')).toThrow('Code 128 cannot be empty.');
        expect(() => new Barcode(BarcodeSymbology.GS1_128, '')).toThrow('GS1-128 cannot be empty.');
      });
    });

    describe('QR', () => {
      it('should accept any non-empty value (and empty too, as there is no validation for QR currently)', () => {
        expect(() => new Barcode(BarcodeSymbology.QR, 'ANYTHING')).not.toThrow();
        expect(() => new Barcode(BarcodeSymbology.QR, '')).not.toThrow();
      });
    });
  });

  describe('equals & toString', () => {
    it('should return true for equal barcodes', () => {
      const b1 = new Barcode(BarcodeSymbology.UPC_A, '123456789012');
      const b2 = new Barcode(BarcodeSymbology.UPC_A, '123456789012');
      expect(b1.equals(b2)).toBe(true);
    });
    it('should return false for different barcodes', () => {
      const b1 = new Barcode(BarcodeSymbology.UPC_A, '123456789012');
      const b2 = new Barcode(BarcodeSymbology.UPC_A, '098765432109');
      expect(b1.equals(b2)).toBe(false);
    });
    it('should return the string value for toString', () => {
      const barcode = new Barcode(BarcodeSymbology.CODE_128, 'some-code');
      expect(barcode.toString()).toBe('SOME-CODE');
    });
  });
});
