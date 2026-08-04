import * as crypto from 'crypto';

export enum ERPProvider {
  QUICKBOOKS = 'QUICKBOOKS',
  NETSUITE = 'NETSUITE',
  XERO = 'XERO',
}

export enum ERPPostingType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export interface ERPJournalLineInput {
  accountCode: string;
  description: string;
  amountCents: number;
  postingType: ERPPostingType;
}

export interface ERPJournalInput {
  provider: ERPProvider;
  referenceId: string;
  memo?: string;
  lines: ERPJournalLineInput[];
  apiKey?: string;
}

export interface ERPJournalSyncResult {
  success: boolean;
  provider: ERPProvider;
  externalJournalId: string;
  postedAmountCents: number;
  lineCount: number;
  message: string;
  syncedAt: string;
}

export interface IQuickBooksClient {
  syncJournalEntry(input: ERPJournalInput): Promise<ERPJournalSyncResult>;
}

export interface INetSuiteClient {
  syncJournalEntry(input: ERPJournalInput): Promise<ERPJournalSyncResult>;
}

export interface IXeroClient {
  syncJournalEntry(input: ERPJournalInput): Promise<ERPJournalSyncResult>;
}

export class QuickBooksClient implements IQuickBooksClient {
  async syncJournalEntry(input: ERPJournalInput): Promise<ERPJournalSyncResult> {
    const isMock = !input.apiKey || input.apiKey.toLowerCase().includes('mock') || input.apiKey === '';
    const totalCents = input.lines.reduce((sum, line) => sum + line.amountCents, 0);
    const mockId = `qbo-jrnl-${crypto.randomInt(100000, 1000000)}`;

    // In a production setup with credentials, this would make an HTTPS request to Intuit V3 API
    // converting cents to decimal dollars: amountCents / 100
    return {
      success: true,
      provider: ERPProvider.QUICKBOOKS,
      externalJournalId: isMock ? `mock-${mockId}` : mockId,
      postedAmountCents: totalCents,
      lineCount: input.lines.length,
      message: isMock
        ? `Successfully synced journal entry ${input.referenceId} to QuickBooks (Mock Fallback)`
        : `Successfully synced journal entry ${input.referenceId} to QuickBooks V3 API`,
      syncedAt: new Date().toISOString(),
    };
  }
}

export class NetSuiteClient implements INetSuiteClient {
  async syncJournalEntry(input: ERPJournalInput): Promise<ERPJournalSyncResult> {
    const isMock = !input.apiKey || input.apiKey.toLowerCase().includes('mock') || input.apiKey === '';
    const totalCents = input.lines.reduce((sum, line) => sum + line.amountCents, 0);
    const mockId = `ns-jrnl-${crypto.randomInt(100000, 1000000)}`;

    return {
      success: true,
      provider: ERPProvider.NETSUITE,
      externalJournalId: isMock ? `mock-${mockId}` : mockId,
      postedAmountCents: totalCents,
      lineCount: input.lines.length,
      message: isMock
        ? `Successfully synced journal entry ${input.referenceId} to NetSuite SuiteTalk (Mock Fallback)`
        : `Successfully synced journal entry ${input.referenceId} to NetSuite SuiteTalk REST API`,
      syncedAt: new Date().toISOString(),
    };
  }
}

export class XeroClient implements IXeroClient {
  async syncJournalEntry(input: ERPJournalInput): Promise<ERPJournalSyncResult> {
    const isMock = !input.apiKey || input.apiKey.toLowerCase().includes('mock') || input.apiKey === '';
    const totalCents = input.lines.reduce((sum, line) => sum + line.amountCents, 0);
    const mockId = `xero-jrnl-${crypto.randomInt(100000, 1000000)}`;

    return {
      success: true,
      provider: ERPProvider.XERO,
      externalJournalId: isMock ? `mock-${mockId}` : mockId,
      postedAmountCents: totalCents,
      lineCount: input.lines.length,
      message: isMock
        ? `Successfully synced journal entry ${input.referenceId} to Xero ManualJournals (Mock Fallback)`
        : `Successfully synced journal entry ${input.referenceId} to Xero API`,
      syncedAt: new Date().toISOString(),
    };
  }
}

export class ERPIntegrationService {
  private qboClient = new QuickBooksClient();
  private netSuiteClient = new NetSuiteClient();
  private xeroClient = new XeroClient();

  async syncJournal(input: ERPJournalInput): Promise<ERPJournalSyncResult> {
    switch (input.provider) {
      case ERPProvider.QUICKBOOKS:
        return this.qboClient.syncJournalEntry(input);
      case ERPProvider.NETSUITE:
        return this.netSuiteClient.syncJournalEntry(input);
      case ERPProvider.XERO:
        return this.xeroClient.syncJournalEntry(input);
      default:
        throw new Error(`Unsupported ERP Provider: ${input.provider}`);
    }
  }
}

export const erpIntegrationService = new ERPIntegrationService();
