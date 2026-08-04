import { INetSuiteClient } from "../../domain/integrations/services/INetSuiteClient";
import { JournalEntryPayload } from "../../domain/integrations/services/IQuickBooksClient";
import * as crypto from "crypto";

export class NetSuiteClient implements INetSuiteClient {
  public async publishJournalEntry(
    accountId: string,
    token: string,
    payload: JournalEntryPayload
  ): Promise<string> {
    if (!accountId || accountId.includes("mock") || !token || token.includes("mock")) {
      return `mock-netsuite-journal-${crypto.randomUUID()}`;
    }

    const accountDomain = accountId.toLowerCase().replace(/_/g, "-");
    const baseUrl = `https://${accountDomain}.suitetalk.api.netsuite.com/services/rest/record/v1`;

    const nsLines = payload.lines.map((line) => {
      const isDebit = line.type === "debit";
      const amount = line.amountCents / 100;
      const item: any = {
        account: { id: line.accountCode },
        memo: line.memo || ""
      };
      if (isDebit) {
        item.debit = amount;
      } else {
        item.credit = amount;
      }
      return item;
    });

    const nsPayload = {
      memo: payload.description,
      tranId: `JE-${payload.aggregateId}`,
      line: {
        items: nsLines
      }
    };

    const url = `${baseUrl}/journalEntry`;

    console.log("[NetSuiteClient] publishJournalEntry", { url, payload: nsPayload });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      },
      body: JSON.stringify(nsPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NetSuite API error (${response.status}): ${errorText}`);
    }

    const data: any = await response.json();
    return data.id || `mock-netsuite-journal-${crypto.randomUUID()}`;
  }
}
