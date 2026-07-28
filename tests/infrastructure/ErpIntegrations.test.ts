import { QuickBooksClient } from "../../src/infrastructure/integrations/QuickBooksClient";
import { NetSuiteClient } from "../../src/infrastructure/integrations/NetSuiteClient";
import { XeroClient } from "../../src/infrastructure/integrations/XeroClient";
import { JournalEntryPayload } from "../../src/domain/integrations/services/IQuickBooksClient";

describe("ERP Integrations (QuickBooks, NetSuite, Xero)", () => {
  const payload: JournalEntryPayload = {
    aggregateId: "je-100",
    tenantId: "tenant-1",
    date: "2026-07-28T00:00:00.000Z",
    description: "Test Journal Entry",
    lines: [
      { accountCode: "1000", amountCents: 5000, type: "debit", memo: "Debit Cash" },
      { accountCode: "2000", amountCents: 5000, type: "credit", memo: "Credit Revenue" }
    ]
  };

  it("should publish journal entry with mock QuickBooks credentials", async () => {
    const qbo = new QuickBooksClient();
    const result = await qbo.publishJournalEntry("mock-realm", "mock-token", payload);
    expect(result).toMatch(/^mock-qbo-journal-/);
  });

  it("should publish journal entry with mock NetSuite credentials", async () => {
    const ns = new NetSuiteClient();
    const result = await ns.publishJournalEntry("mock-account", "mock-token", payload);
    expect(result).toMatch(/^mock-netsuite-journal-/);
  });

  it("should publish journal entry with mock Xero credentials", async () => {
    const xero = new XeroClient();
    const result = await xero.publishJournalEntry("mock-tenant", "mock-token", payload);
    expect(result).toMatch(/^mock-xero-journal-/);
  });
});
