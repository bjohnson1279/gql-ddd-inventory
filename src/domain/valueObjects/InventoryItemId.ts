export class InventoryItemId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("InventoryItemId cannot be empty.");
    }
  }

  equals(other: InventoryItemId): boolean {
    return this.value === other.value;
  }
}
