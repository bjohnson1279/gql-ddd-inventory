export class LedgerEntryId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("LedgerEntryId cannot be empty.");
    }
  }

  equals(other: LedgerEntryId): boolean {
    return this.value === other.value;
  }
}
