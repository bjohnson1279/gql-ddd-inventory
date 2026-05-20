export class BarcodeAssignmentId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("BarcodeAssignmentId cannot be empty.");
    }
  }

  equals(other: BarcodeAssignmentId): boolean {
    return this.value === other.value;
  }
}
