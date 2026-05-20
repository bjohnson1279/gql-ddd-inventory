import { BarcodeAssignmentId } from '../valueObjects/BarcodeAssignmentId';
import { Sku } from '../valueObjects/Sku';
import { Barcode } from '../valueObjects/Barcode';
import { BarcodeSource } from '../enums/BarcodeEnums';

export class BarcodeAssignment {
  constructor(
    public readonly id: BarcodeAssignmentId,
    public readonly sku: Sku,
    public readonly barcode: Barcode,
    public readonly source: BarcodeSource,
    public readonly isPrimary: boolean,
    public readonly assignedAt: Date
  ) {}

  cloneWithPrimary(isPrimary: boolean): BarcodeAssignment {
    return new BarcodeAssignment(
      this.id,
      this.sku,
      this.barcode,
      this.source,
      isPrimary,
      this.assignedAt
    );
  }
}
