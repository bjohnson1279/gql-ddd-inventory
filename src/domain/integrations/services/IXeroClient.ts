import { JournalEntryPayload } from "./IQuickBooksClient";

export interface IXeroClient {
  publishJournalEntry(
    xeroTenantId: string,
    accessToken: string,
    payload: JournalEntryPayload
  ): Promise<string>;
}
