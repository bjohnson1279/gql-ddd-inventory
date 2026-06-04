import { Sku } from '../valueObjects/Sku';
import { BarcodeAssignment } from './BarcodeAssignment';
import { Barcode } from '../valueObjects/Barcode';
import { BarcodeSource } from '../enums/BarcodeEnums';
import { BarcodeAssignmentId } from '../valueObjects/BarcodeAssignmentId';
import { DomainEvent } from '../events/DomainEvent';
import { BarcodeAssigned, BarcodeRevoked } from '../events/BarcodeEvents';

export class VariantBarcodeSet {
  private _assignments: Map<string, BarcodeAssignment> = new Map();
  private _domainEvents: DomainEvent[] = [];

  constructor(public readonly sku: Sku) {}

  assign(
    barcode: Barcode,
    source: BarcodeSource,
    makePrimary: boolean = false
  ): BarcodeAssignment {
    // Guard: no duplicate barcode values within this set
    for (const existing of this._assignments.values()) {
      if (existing.barcode.equals(barcode)) {
        throw new Error(`Barcode ${barcode.value} is already assigned to this variant.`);
      }
    }

    // If makePrimary, demote any existing primary
    if (makePrimary) {
      for (const [id, assignment] of this._assignments) {
        if (assignment.isPrimary) {
          this._assignments.set(id, assignment.cloneWithPrimary(false));
        }
      }
    }

    // If this is the first assignment, make it primary automatically
    const shouldBePrimary = makePrimary || this._assignments.size === 0;

    const assignment = new BarcodeAssignment(
      new BarcodeAssignmentId(this.generateId()),
      this.sku,
      barcode,
      source,
      shouldBePrimary,
      new Date()
    );

    this._assignments.set(assignment.id.value, assignment);
    this._domainEvents.push(new BarcodeAssigned(this.sku.value, barcode.value));

    return assignment;
  }

  loadAssignment(assignment: BarcodeAssignment): void {
    this._assignments.set(assignment.id.value, assignment);
  }

  revoke(assignmentId: BarcodeAssignmentId): void {
    const assignment = this._assignments.get(assignmentId.value);

    if (!assignment) {
      throw new Error(`Assignment ${assignmentId.value} not found.`);
    }

    if (assignment.isPrimary && this._assignments.size > 1) {
      throw new Error(
        'Cannot revoke the primary barcode while other assignments exist. ' +
        'Promote another barcode to primary first.'
      );
    }

    this._assignments.delete(assignmentId.value);
    this._domainEvents.push(new BarcodeRevoked(this.sku.value, assignment.barcode.value));
  }

  get primaryBarcode(): BarcodeAssignment | undefined {
    for (const assignment of this._assignments.values()) {
      if (assignment.isPrimary) {
        return assignment;
      }
    }
    return undefined;
  }

  get all(): BarcodeAssignment[] {
    return Array.from(this._assignments.values());
  }

  pullDomainEvents(): DomainEvent[] {
    const events = this._domainEvents;
    this._domainEvents = [];
    return events;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
