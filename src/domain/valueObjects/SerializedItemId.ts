export class SerializedItemId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("SerializedItemId cannot be empty.");
    }
  }

  equals(other: SerializedItemId): boolean {
    return this.value === other.value;
  }
}
