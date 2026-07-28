export interface JournalLineInput {
  accountCode: string;
  accountName?: string;
  amountCents: number;
  type: "debit" | "credit";
  memo?: string;
}

export interface JournalEntryPayload {
  aggregateId: string;
  tenantId: string;
  date: string;
  description: string;
  lines: JournalLineInput[];
}

export interface IQuickBooksClient {
  publishJournalEntry(
    realmId: string,
    accessToken: string,
    payload: JournalEntryPayload,
    sandboxMode?: boolean
  ): Promise<string>;
}
