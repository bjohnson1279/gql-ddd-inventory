export class LotBatchId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('LotBatchId cannot be empty.');
    }
  }

  equals(other: LotBatchId): boolean {
    if (!other || !(other instanceof LotBatchId)) {
      return false;
    }
    return this.value === other.value;
  }
}
