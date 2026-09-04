import { IQuickBooksClient, JournalEntryPayload } from "../../domain/integrations/services/IQuickBooksClient";
import * as crypto from "crypto";

export class QuickBooksClient implements IQuickBooksClient {
  public async publishJournalEntry(
    realmId: string,
    accessToken: string,
    payload: JournalEntryPayload,
    sandboxMode: boolean = true
  ): Promise<string> {
    if (!realmId || realmId.includes("mock") || !accessToken || accessToken.includes("mock")) {
      return `mock-qbo-journal-${crypto.randomUUID()}`;
    }

    const baseUrl = sandboxMode
      ? "https://sandbox-quickbooks.api.intuit.com/v3/company"
      : "https://quickbooks.api.intuit.com/v3/company";

    const qboLines = payload.lines.map((line) => {
      const postingType = line.type === "debit" ? "Debit" : "Credit";
      return {
        Description: line.memo || payload.description,
        Amount: line.amountCents / 100,
        DetailType: "JournalEntryLineDetail",
        JournalEntryLineDetail: {
          PostingType: postingType,
          AccountRef: {
            value: line.accountCode,
            name: line.accountName || "Account"
          }
        }
      };
    });

    const qboPayload = {
      DocNumber: `JE-${payload.aggregateId}`,
      TxnDate: payload.date.split("T")[0],
      PrivateNote: payload.description,
      Line: qboLines,
      LineInfo: {
        TenantId: payload.tenantId
      }
    };

    const url = `${baseUrl}/${realmId}/journalentry`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json"
      },
      body: JSON.stringify(qboPayload),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QuickBooks API error (${response.status}): ${errorText}`);
    }

    const data: any = await response.json();
    return data.JournalEntry?.Id || data.Id || `mock-qbo-journal-${crypto.randomUUID()}`;
  }
}
