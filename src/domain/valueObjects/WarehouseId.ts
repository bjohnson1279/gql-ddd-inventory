export class WarehouseId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("WarehouseId cannot be empty.");
    }
  }

  equals(other: WarehouseId): boolean {
    return this.value === other.value;
  }
}
