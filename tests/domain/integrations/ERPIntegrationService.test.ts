import {
  ERPIntegrationService,
  ERPProvider,
  ERPPostingType,
  ERPJournalInput,
  QuickBooksClient,
  NetSuiteClient,
  XeroClient,
  erpIntegrationService,
} from '../../../src/domain/integrations/erpIntegrationService';

describe('ERPIntegrationService and Domain ERP Clients', () => {
  describe('QuickBooksClient', () => {
    let client: QuickBooksClient;

    beforeEach(() => {
      client = new QuickBooksClient();
    });

    it('should fallback to mock sync when apiKey is undefined', async () => {
      const input: ERPJournalInput = {
        provider: ERPProvider.QUICKBOOKS,
        referenceId: 'ref-qbo-1',
        lines: [
          { accountCode: '1000', description: 'Debit Assets', amountCents: 5000, postingType: ERPPostingType.DEBIT },
          { accountCode: '2000', description: 'Credit Cash', amountCents: 5000, postingType: ERPPostingType.CREDIT },
        ],
      };

      const result = await client.syncJournalEntry(input);

      expect(result.success).toBe(true);
      expect(result.provider).toBe(ERPProvider.QUICKBOOKS);
      expect(result.externalJournalId).toMatch(/^mock-qbo-jrnl-\d+$/);
      expect(result.postedAmountCents).toBe(10000);
      expect(result.lineCount).toBe(2);
      expect(result.message).toContain('(Mock Fallback)');
      expect(new Date(result.syncedAt).toString()).not.toBe('Invalid Date');
    });

    it('should fallback to mock sync when apiKey contains "mock" (case-insensitive)', async () => {
      const input: ERPJournalInput = {
        provider: ERPProvider.QUICKBOOKS,
        referenceId: 'ref-qbo-mock',
        apiKey: 'SECRET_MOCK_KEY_123',
        lines: [
          { accountCode: '1000', description: 'Debit Assets', amountCents: 1500, postingType: ERPPostingType.DEBIT },
        ],
      };

      const result = await client.syncJournalEntry(input);

      expect(result.success).toBe(true);
      expect(result.externalJournalId).toMatch(/^mock-qbo-jrnl-\d+$/);
      expect(result.postedAmountCents).toBe(1500);
      expect(result.lineCount).toBe(1);
      expect(result.message).toContain('(Mock Fallback)');
    });

    it('should fallback to mock sync when apiKey is an empty string', async () => {
      const input: ERPJournalInput = {
        provider: ERPProvider.QUICKBOOKS,
        referenceId: 'ref-qbo-empty',
        apiKey: '',
        lines: [],
      };

      const result = await client.syncJournalEntry(input);

      expect(result.success).toBe(true);
      expect(result.externalJournalId).toMatch(/^mock-qbo-jrnl-\d+$/);
      expect(result.postedAmountCents).toBe(0);
      expect(result.lineCount).toBe(0);
      expect(result.message).toContain('(Mock Fallback)');
    });

    it('should sync with production message and id when a valid non-mock apiKey is provided', async () => {
      const input: ERPJournalInput = {
        provider: ERPProvider.QUICKBOOKS,
        referenceId: 'ref-qbo-prod',
        apiKey: 'live_intuit_api_token_abc',
        lines: [
          { accountCode: '1010', description: 'Debit Receivables', amountCents: 25000, postingType: ERPPostingType.DEBIT },
          { accountCode: '4000', description: 'Credit Sales', amountCents: 25000, postingType: ERPPostingType.CREDIT },
        ],
      };

      const result = await client.syncJournalEntry(input);

      expect(result.success).toBe(true);
      expect(result.provider).toBe(ERPProvider.QUICKBOOKS);
      expect(result.externalJournalId).toMatch(/^qbo-jrnl-\d+$/);
      expect(result.externalJournalId.startsWith('mock-')).toBe(false);
      expect(result.postedAmountCents).toBe(50000);
      expect(result.lineCount).toBe(2);
      expect(result.message).toBe('Successfully synced journal entry ref-qbo-prod to QuickBooks V3 API');
    });
  });

  describe('NetSuiteClient', () => {
    let client: NetSuiteClient;

    beforeEach(() => {
      client = new NetSuiteClient();
    });

    it('should fallback to mock sync when apiKey is undefined or contains "mock"', async () => {
      const input: ERPJournalInput = {
        provider: ERPProvider.NETSUITE,
        referenceId: 'ref-ns-mock',
        apiKey: 'mock_token',
        lines: [
          { accountCode: 'NS-100', description: 'Debit Expense', amountCents: 8000, postingType: ERPPostingType.DEBIT },
        ],
      };

      const result = await client.syncJournalEntry(input);

      expect(result.success).toBe(true);
      expect(result.provider).toBe(ERPProvider.NETSUITE);
      expect(result.externalJournalId).toMatch(/^mock-ns-jrnl-\d+$/);
      expect(result.postedAmountCents).toBe(8000);
      expect(result.lineCount).toBe(1);
      expect(result.message).toContain('(Mock Fallback)');
    });

    it('should sync to NetSuite SuiteTalk REST API when live apiKey is provided', async () => {
      const input: ERPJournalInput = {
        provider: ERPProvider.NETSUITE,
        referenceId: 'ref-ns-prod',
        apiKey: 'netsuite_token_live_123',
        lines: [
          { accountCode: 'NS-100', description: 'Debit', amountCents: 12000, postingType: ERPPostingType.DEBIT },
          { accountCode: 'NS-200', description: 'Credit', amountCents: 12000, postingType: ERPPostingType.CREDIT },
        ],
      };

      const result = await client.syncJournalEntry(input);

      expect(result.success).toBe(true);
      expect(result.provider).toBe(ERPProvider.NETSUITE);
      expect(result.externalJournalId).toMatch(/^ns-jrnl-\d+$/);
      expect(result.externalJournalId.startsWith('mock-')).toBe(false);
      expect(result.postedAmountCents).toBe(24000);
      expect(result.lineCount).toBe(2);
      expect(result.message).toBe('Successfully synced journal entry ref-ns-prod to NetSuite SuiteTalk REST API');
    });
  });

  describe('XeroClient', () => {
    let client: XeroClient;

    beforeEach(() => {
      client = new XeroClient();
    });

    it('should fallback to mock sync when apiKey is undefined or contains "mock"', async () => {
      const input: ERPJournalInput = {
        provider: ERPProvider.XERO,
        referenceId: 'ref-xero-mock',
        lines: [
          { accountCode: 'XERO-600', description: 'Debit Office Supplies', amountCents: 450, postingType: ERPPostingType.DEBIT },
        ],
      };

      const result = await client.syncJournalEntry(input);

      expect(result.success).toBe(true);
      expect(result.provider).toBe(ERPProvider.XERO);
      expect(result.externalJournalId).toMatch(/^mock-xero-jrnl-\d+$/);
      expect(result.postedAmountCents).toBe(450);
      expect(result.lineCount).toBe(1);
      expect(result.message).toContain('(Mock Fallback)');
    });

    it('should sync to Xero API when live apiKey is provided', async () => {
      const input: ERPJournalInput = {
        provider: ERPProvider.XERO,
        referenceId: 'ref-xero-prod',
        apiKey: 'live_xero_bearer_token',
        lines: [
          { accountCode: 'XERO-600', description: 'Debit Office Supplies', amountCents: 450, postingType: ERPPostingType.DEBIT },
          { accountCode: 'XERO-800', description: 'Credit Bank Account', amountCents: 450, postingType: ERPPostingType.CREDIT },
        ],
      };

      const result = await client.syncJournalEntry(input);

      expect(result.success).toBe(true);
      expect(result.provider).toBe(ERPProvider.XERO);
      expect(result.externalJournalId).toMatch(/^xero-jrnl-\d+$/);
      expect(result.externalJournalId.startsWith('mock-')).toBe(false);
      expect(result.postedAmountCents).toBe(900);
      expect(result.lineCount).toBe(2);
      expect(result.message).toBe('Successfully synced journal entry ref-xero-prod to Xero API');
    });
  });

  describe('ERPIntegrationService', () => {
    let service: ERPIntegrationService;

    beforeEach(() => {
      service = new ERPIntegrationService();
    });

    it('should route sync request to QuickBooksClient for ERPProvider.QUICKBOOKS', async () => {
      const input: ERPJournalInput = {
        provider: ERPProvider.QUICKBOOKS,
        referenceId: 'ref-service-qbo',
        lines: [{ accountCode: '100', description: 'Line 1', amountCents: 1000, postingType: ERPPostingType.DEBIT }],
      };

      const result = await service.syncJournal(input);

      expect(result.success).toBe(true);
      expect(result.provider).toBe(ERPProvider.QUICKBOOKS);
      expect(result.postedAmountCents).toBe(1000);
    });

    it('should route sync request to NetSuiteClient for ERPProvider.NETSUITE', async () => {
      const input: ERPJournalInput = {
        provider: ERPProvider.NETSUITE,
        referenceId: 'ref-service-ns',
        lines: [{ accountCode: '200', description: 'Line 1', amountCents: 2000, postingType: ERPPostingType.CREDIT }],
      };

      const result = await service.syncJournal(input);

      expect(result.success).toBe(true);
      expect(result.provider).toBe(ERPProvider.NETSUITE);
      expect(result.postedAmountCents).toBe(2000);
    });

    it('should route sync request to XeroClient for ERPProvider.XERO', async () => {
      const input: ERPJournalInput = {
        provider: ERPProvider.XERO,
        referenceId: 'ref-service-xero',
        lines: [{ accountCode: '300', description: 'Line 1', amountCents: 3000, postingType: ERPPostingType.DEBIT }],
      };

      const result = await service.syncJournal(input);

      expect(result.success).toBe(true);
      expect(result.provider).toBe(ERPProvider.XERO);
      expect(result.postedAmountCents).toBe(3000);
    });

    it('should throw an error for unsupported ERP provider', async () => {
      const input: any = {
        provider: 'SAGE_INTACCT',
        referenceId: 'ref-unknown',
        lines: [],
      };

      await expect(service.syncJournal(input)).rejects.toThrow('Unsupported ERP Provider: SAGE_INTACCT');
    });

    it('should export a singleton erpIntegrationService instance that functions properly', async () => {
      expect(erpIntegrationService).toBeInstanceOf(ERPIntegrationService);

      const result = await erpIntegrationService.syncJournal({
        provider: ERPProvider.QUICKBOOKS,
        referenceId: 'ref-singleton',
        lines: [{ accountCode: '999', description: 'Singleton test', amountCents: 50, postingType: ERPPostingType.DEBIT }],
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe(ERPProvider.QUICKBOOKS);
    });
  });
});
