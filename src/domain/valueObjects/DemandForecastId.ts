export class DemandForecastId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("DemandForecastId cannot be empty.");
    }
  }

  equals(other: DemandForecastId): boolean {
    return this.value === other.value;
  }
}
