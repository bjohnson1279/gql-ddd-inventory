export class DemandForecastId {
  constructor(public readonly value: string) {
    if (!value) {
      throw new Error('DemandForecastId cannot be empty.');
    }
  }

  equals(other: DemandForecastId): boolean {
    return this.value === other.value;
  }
}
