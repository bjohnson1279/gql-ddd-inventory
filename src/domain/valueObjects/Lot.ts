export class Lot {
  constructor(
    public readonly lotNumber: string,
    public readonly expirationDate: Date
  ) {
    if (!lotNumber || lotNumber.trim().length === 0) {
      throw new Error("Lot number cannot be empty.");
    }
    if (isNaN(expirationDate.getTime())) {
      throw new Error("Invalid expiration date.");
    }
  }

  equals(other: Lot): boolean {
    return (
      this.lotNumber === other.lotNumber &&
      this.expirationDate.getTime() === other.expirationDate.getTime()
    );
  }
}
