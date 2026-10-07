import { VariantBarcodeSet } from '../../../src/domain/entities/VariantBarcodeSet';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { Barcode } from '../../../src/domain/valueObjects/Barcode';
import { BarcodeSource, BarcodeSymbology } from '../../../src/domain/enums/BarcodeEnums';
import { BarcodeAssignment } from '../../../src/domain/entities/BarcodeAssignment';
import { BarcodeAssignmentId } from '../../../src/domain/valueObjects/BarcodeAssignmentId';
import { BarcodeAssigned, BarcodeRevoked } from '../../../src/domain/events/BarcodeEvents';

describe('VariantBarcodeSet', () => {
  const sku = new Sku('SKU-100');
  const barcode1 = new Barcode(BarcodeSymbology.UPC_A, '123456789012');
  const barcode2 = new Barcode(BarcodeSymbology.UPC_A, '987654321098');

  it('should initialize correctly with sku', () => {
    const set = new VariantBarcodeSet(sku);
    expect(set.sku).toBe(sku);
    expect(set.all).toEqual([]);
    expect(set.primaryBarcode).toBeUndefined();
  });

  describe('assign', () => {
    it('should make first barcode primary automatically and record BarcodeAssigned event', () => {
      const set = new VariantBarcodeSet(sku);
      const assignment = set.assign(barcode1, BarcodeSource.Internal);

      expect(assignment.sku).toBe(sku);
      expect(assignment.barcode.equals(barcode1)).toBe(true);
      expect(assignment.source).toBe(BarcodeSource.Internal);
      expect(assignment.isPrimary).toBe(true);

      expect(set.all).toHaveLength(1);
      expect(set.primaryBarcode).toBe(assignment);

      const events = set.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(BarcodeAssigned);
      expect((events[0] as BarcodeAssigned).sku).toBe('SKU-100');
      expect((events[0] as BarcodeAssigned).barcode).toBe('123456789012');
    });

    it('should assign a second non-primary barcode without demoting the primary', () => {
      const set = new VariantBarcodeSet(sku);
      const assign1 = set.assign(barcode1, BarcodeSource.Internal);
      const assign2 = set.assign(barcode2, BarcodeSource.Supplier, false);

      expect(assign2.isPrimary).toBe(false);
      expect(set.all).toHaveLength(2);
      expect(set.primaryBarcode?.id.value).toBe(assign1.id.value);
    });

    it('should demote existing primary when makePrimary is true', () => {
      const set = new VariantBarcodeSet(sku);
      const assign1 = set.assign(barcode1, BarcodeSource.Internal);
      expect(assign1.isPrimary).toBe(true);

      const assign2 = set.assign(barcode2, BarcodeSource.Supplier, true);

      expect(assign2.isPrimary).toBe(true);
      expect(set.primaryBarcode?.id.value).toBe(assign2.id.value);

      const updatedAssign1 = set.all.find((a) => a.id.value === assign1.id.value);
      expect(updatedAssign1?.isPrimary).toBe(false);
    });

    it('should throw an error when assigning a duplicate barcode value', () => {
      const set = new VariantBarcodeSet(sku);
      set.assign(barcode1, BarcodeSource.Internal);

      const duplicateBarcode = new Barcode(BarcodeSymbology.UPC_A, '123456789012');
      expect(() => {
        set.assign(duplicateBarcode, BarcodeSource.Supplier);
      }).toThrow('Barcode 123456789012 is already assigned to this variant.');
    });
  });

  describe('loadAssignment', () => {
    it('should load an existing assignment without emitting domain events', () => {
      const set = new VariantBarcodeSet(sku);
      const assignmentId = new BarcodeAssignmentId('assign-1');
      const assignment = new BarcodeAssignment(
        assignmentId,
        sku,
        barcode1,
        BarcodeSource.Internal,
        true,
        new Date()
      );

      set.loadAssignment(assignment);

      expect(set.all).toHaveLength(1);
      expect(set.primaryBarcode).toBe(assignment);
      expect(set.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('revoke', () => {
    it('should revoke a non-primary assignment and emit BarcodeRevoked event', () => {
      const set = new VariantBarcodeSet(sku);
      set.assign(barcode1, BarcodeSource.Internal); // primary
      const assign2 = set.assign(barcode2, BarcodeSource.Supplier, false); // non-primary

      set.pullDomainEvents(); // clear assign events

      set.revoke(assign2.id);

      expect(set.all).toHaveLength(1);
      expect(set.all[0].barcode.equals(barcode1)).toBe(true);

      const events = set.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(BarcodeRevoked);
      expect((events[0] as BarcodeRevoked).sku).toBe('SKU-100');
      expect((events[0] as BarcodeRevoked).barcode).toBe('987654321098');
    });

    it('should throw when revoking a non-existent assignment', () => {
      const set = new VariantBarcodeSet(sku);
      const invalidId = new BarcodeAssignmentId('non-existent');

      expect(() => {
        set.revoke(invalidId);
      }).toThrow('Assignment non-existent not found.');
    });

    it('should throw when revoking primary barcode while other assignments exist', () => {
      const set = new VariantBarcodeSet(sku);
      const assign1 = set.assign(barcode1, BarcodeSource.Internal);
      set.assign(barcode2, BarcodeSource.Supplier, false);

      expect(() => {
        set.revoke(assign1.id);
      }).toThrow(
        'Cannot revoke the primary barcode while other assignments exist. Promote another barcode to primary first.'
      );
    });

    it('should allow revoking primary barcode if it is the only assignment', () => {
      const set = new VariantBarcodeSet(sku);
      const assign1 = set.assign(barcode1, BarcodeSource.Internal);

      set.revoke(assign1.id);

      expect(set.all).toHaveLength(0);
      expect(set.primaryBarcode).toBeUndefined();
    });
  });

  describe('caching behavior', () => {
    it('should return cached array for `all` until mutated', () => {
      const set = new VariantBarcodeSet(sku);
      const assign1 = set.assign(barcode1, BarcodeSource.Internal);

      const allFirst = set.all;
      const allSecond = set.all;

      expect(allFirst).toBe(allSecond); // reference equality check for cache

      const assign2 = set.assign(barcode2, BarcodeSource.Supplier);
      const allThird = set.all;

      expect(allThird).not.toBe(allFirst);
      expect(allThird).toHaveLength(2);

      set.revoke(assign2.id);
      const allFourth = set.all;

      expect(allFourth).not.toBe(allThird);
      expect(allFourth).toHaveLength(1);
    });
  });

  describe('pullDomainEvents', () => {
    it('should clear domain events upon pulling', () => {
      const set = new VariantBarcodeSet(sku);
      set.assign(barcode1, BarcodeSource.Internal);

      expect(set.pullDomainEvents()).toHaveLength(1);
      expect(set.pullDomainEvents()).toHaveLength(0);
    });
  });
});
