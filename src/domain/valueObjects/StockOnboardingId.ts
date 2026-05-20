export class StockOnboardingId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("StockOnboardingId cannot be empty.");
    }
  }

  equals(other: StockOnboardingId): boolean {
    return this.value === other.value;
  }
}
