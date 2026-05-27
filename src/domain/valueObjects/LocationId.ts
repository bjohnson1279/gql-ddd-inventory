export class LocationId {
  public readonly value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("LocationId cannot be empty.");
    }
    this.value = value;
  }

  equals(other: LocationId): boolean {
    return this.value === other.value;
  }
}
