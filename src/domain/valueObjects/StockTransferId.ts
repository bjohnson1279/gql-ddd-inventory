export class StockTransferId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("StockTransferId cannot be empty.");
    }
  }

  equals(other: StockTransferId): boolean {
    return this.value === other.value;
  }
}
