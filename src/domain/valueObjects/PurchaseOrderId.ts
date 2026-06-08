export class PurchaseOrderId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("PurchaseOrderId cannot be empty.");
    }
  }

  equals(other: PurchaseOrderId): boolean {
    return this.value === other.value;
  }
}
