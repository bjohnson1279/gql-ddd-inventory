export class JournalEntryId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("JournalEntryId cannot be empty.");
    }
  }

  equals(other: JournalEntryId): boolean {
    return this.value === other.value;
  }
}
