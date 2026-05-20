import { Barcode } from '../../src/domain/valueObjects/Barcode';
import { BarcodeSymbology, BarcodeSource } from '../../src/domain/enums/BarcodeEnums';
import { VariantBarcodeSet } from '../../src/domain/entities/VariantBarcodeSet';
import { Sku } from '../../src/domain/valueObjects/Sku';

describe('Barcode Modeling', () => {
  const sku = new Sku('TEST-SKU');

  it('should validate UPC-A correctly', () => {
    expect(() => new Barcode(BarcodeSymbology.UPC_A, '123456789012')).not.toThrow();
    expect(() => new Barcode(BarcodeSymbology.UPC_A, '123')).toThrow('UPC-A must be exactly 12 digits');
    expect(() => new Barcode(BarcodeSymbology.UPC_A, 'ABC456789012')).toThrow('UPC-A must contain only digits');
  });

  it('should assign barcodes and manage primary', () => {
    const set = new VariantBarcodeSet(sku);
    
    // First assignment should be primary by default
    const bc1 = new Barcode(BarcodeSymbology.CODE_128, 'BC-1');
    set.assign(bc1, BarcodeSource.Internal);
    
    expect(set.primaryBarcode?.barcode.value).toBe('BC-1');
    expect(set.primaryBarcode?.isPrimary).toBe(true);

    // Second assignment should not be primary by default
    const bc2 = new Barcode(BarcodeSymbology.UPC_A, '123456789012');
    set.assign(bc2, BarcodeSource.Supplier);
    
    expect(set.primaryBarcode?.barcode.value).toBe('BC-1');
    expect(set.all.length).toBe(2);

    // Assigning with makePrimary=true should demote previous primary
    const bc3 = new Barcode(BarcodeSymbology.EAN_13, '1234567890123');
    set.assign(bc3, BarcodeSource.Supplier, true);
    
    expect(set.primaryBarcode?.barcode.value).toBe('1234567890123');
    const oldPrimary = set.all.find(a => a.barcode.value === 'BC-1');
    expect(oldPrimary?.isPrimary).toBe(false);
  });

  it('should prevent duplicate barcodes in a set', () => {
    const set = new VariantBarcodeSet(sku);
    const bc = new Barcode(BarcodeSymbology.CODE_128, 'DUP');
    set.assign(bc, BarcodeSource.Internal);
    
    expect(() => set.assign(bc, BarcodeSource.Internal)).toThrow('is already assigned to this variant');
  });

  it('should prevent revoking primary if other barcodes exist', () => {
    const set = new VariantBarcodeSet(sku);
    const a1 = set.assign(new Barcode(BarcodeSymbology.CODE_128, 'BC-1'), BarcodeSource.Internal);
    set.assign(new Barcode(BarcodeSymbology.CODE_128, 'BC-2'), BarcodeSource.Internal);
    
    expect(() => set.revoke(a1.id)).toThrow('Cannot revoke the primary barcode while other assignments exist');
  });
});
