export class LocationId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("LocationId cannot be empty.");
    }
  }

  equals(other: LocationId): boolean {
    return this.value === other.value;
  }
}
