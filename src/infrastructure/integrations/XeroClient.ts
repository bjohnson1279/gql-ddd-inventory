import { IXeroClient } from "../../domain/integrations/services/IXeroClient";
import { JournalEntryPayload } from "../../domain/integrations/services/IQuickBooksClient";

export class XeroClient implements IXeroClient {
  public async publishJournalEntry(
    xeroTenantId: string,
    accessToken: string,
    payload: JournalEntryPayload
  ): Promise<string> {
    if (!xeroTenantId || xeroTenantId.includes("mock") || !accessToken || accessToken.includes("mock")) {
      return `mock-xero-journal-${Math.random().toString(36).substring(7)}`;
    }

    const baseUrl = "https://api.xro.com/api.xro/2.0";

    const xeroLines = payload.lines.map((line) => {
      const isCredit = line.type === "credit";
      const amount = line.amountCents / 100;
      return {
        Description: line.memo || "",
        LineAmount: isCredit ? -amount : amount,
        AccountCode: line.accountCode
      };
    });

    const xeroPayload = {
      ManualJournals: [{
        Narration: payload.description,
        Reference: `JE-${payload.aggregateId}`,
        JournalLines: xeroLines
      }]
    };

    const url = `${baseUrl}/ManualJournals`;

    console.log("[XeroClient] publishJournalEntry", { url, payload: xeroPayload });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Xero-tenant-id": xeroTenantId,
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json"
      },
      body: JSON.stringify(xeroPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Xero API error (${response.status}): ${errorText}`);
    }

    const data: any = await response.json();
    return data.ManualJournals?.[0]?.ManualJournalID || `mock-xero-journal-${Math.random().toString(36).substring(7)}`;
  }
}
