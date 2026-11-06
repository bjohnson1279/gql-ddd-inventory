export class QuarantineItemId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('QuarantineItemId cannot be empty.');
    }
  }

  equals(other: QuarantineItemId): boolean {
    if (!other || !(other instanceof QuarantineItemId)) {
      return false;
    }
    return this.value === other.value;
  }
}
