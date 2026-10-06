import { BarcodeAssignment } from '../../../src/domain/entities/BarcodeAssignment';
import { BarcodeAssignmentId } from '../../../src/domain/valueObjects/BarcodeAssignmentId';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { Barcode } from '../../../src/domain/valueObjects/Barcode';
import { BarcodeSource, BarcodeSymbology } from '../../../src/domain/enums/BarcodeEnums';

describe('BarcodeAssignment', () => {
  const assignmentId = new BarcodeAssignmentId('assignment-123');
  const sku = new Sku('SKU-ITEM-001');
  const barcode = new Barcode(BarcodeSymbology.EAN_13, '1234567890123');
  const source = BarcodeSource.Internal;
  const assignedAt = new Date('2025-01-01T00:00:00.000Z');

  describe('constructor', () => {
    it('should correctly initialize all properties', () => {
      const assignment = new BarcodeAssignment(
        assignmentId,
        sku,
        barcode,
        source,
        true,
        assignedAt
      );

      expect(assignment.id).toBe(assignmentId);
      expect(assignment.sku).toBe(sku);
      expect(assignment.barcode).toBe(barcode);
      expect(assignment.source).toBe(BarcodeSource.Internal);
      expect(assignment.isPrimary).toBe(true);
      expect(assignment.assignedAt).toBe(assignedAt);
    });
  });

  describe('cloneWithPrimary', () => {
    it('should return a new instance with updated isPrimary flag set to false', () => {
      const originalAssignment = new BarcodeAssignment(
        assignmentId,
        sku,
        barcode,
        source,
        true,
        assignedAt
      );

      const clonedAssignment = originalAssignment.cloneWithPrimary(false);

      expect(clonedAssignment).not.toBe(originalAssignment);
      expect(clonedAssignment.isPrimary).toBe(false);
      expect(clonedAssignment.id).toBe(assignmentId);
      expect(clonedAssignment.sku).toBe(sku);
      expect(clonedAssignment.barcode).toBe(barcode);
      expect(clonedAssignment.source).toBe(source);
      expect(clonedAssignment.assignedAt).toBe(assignedAt);
    });

    it('should return a new instance with updated isPrimary flag set to true', () => {
      const originalAssignment = new BarcodeAssignment(
        assignmentId,
        sku,
        barcode,
        source,
        false,
        assignedAt
      );

      const clonedAssignment = originalAssignment.cloneWithPrimary(true);

      expect(clonedAssignment).not.toBe(originalAssignment);
      expect(clonedAssignment.isPrimary).toBe(true);
      expect(clonedAssignment.id).toBe(assignmentId);
      expect(clonedAssignment.sku).toBe(sku);
      expect(clonedAssignment.barcode).toBe(barcode);
      expect(clonedAssignment.source).toBe(source);
      expect(clonedAssignment.assignedAt).toBe(assignedAt);
    });
  });
});
