export class RmaId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('RmaId cannot be empty.');
    }
  }

  equals(other: RmaId): boolean {
    return this.value === other.value;
  }
}
