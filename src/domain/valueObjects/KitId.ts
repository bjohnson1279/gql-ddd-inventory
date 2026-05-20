export class KitId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("KitId cannot be empty.");
    }
  }

  equals(other: KitId): boolean {
    return this.value === other.value;
  }
}
