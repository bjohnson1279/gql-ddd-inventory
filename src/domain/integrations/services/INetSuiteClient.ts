import { JournalEntryPayload } from "./IQuickBooksClient";

export interface INetSuiteClient {
  publishJournalEntry(
    accountId: string,
    token: string,
    payload: JournalEntryPayload
  ): Promise<string>;
}
