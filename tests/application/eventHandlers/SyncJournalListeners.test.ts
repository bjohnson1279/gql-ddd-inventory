import { SyncJournalListeners } from '../../../src/application/eventHandlers/SyncJournalListeners';
import { JournalEntryCreatedEvent } from '../../../src/domain/events/JournalEntryCreatedEvent';

describe('SyncJournalListeners', () => {
  let netsuiteSyncMock: any;
  let netsuiteMappingsMock: any;
  let xeroSyncMock: any;
  let xeroMappingsMock: any;
  let quickbooksSyncMock: any;
  let quickbooksMappingsMock: any;

  let listener: SyncJournalListeners;

  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    netsuiteSyncMock = { createJournalEntry: jest.fn() };
    netsuiteMappingsMock = { findNetSuiteJournalId: jest.fn(), saveMapping: jest.fn() };

    xeroSyncMock = { createManualJournal: jest.fn() };
    xeroMappingsMock = { findXeroJournalId: jest.fn(), saveMapping: jest.fn() };

    quickbooksSyncMock = { createJournalEntry: jest.fn() };
    quickbooksMappingsMock = { findQuickBooksJournalId: jest.fn(), saveMapping: jest.fn() };

    listener = new SyncJournalListeners(
      netsuiteSyncMock,
      netsuiteMappingsMock,
      xeroSyncMock,
      xeroMappingsMock,
      quickbooksSyncMock,
      quickbooksMappingsMock
    );

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create missing mappings and log success', async () => {
    netsuiteMappingsMock.findNetSuiteJournalId.mockResolvedValue(null);
    netsuiteSyncMock.createJournalEntry.mockResolvedValue('ns-123');
    netsuiteMappingsMock.saveMapping.mockResolvedValue(undefined);

    xeroMappingsMock.findXeroJournalId.mockResolvedValue(null);
    xeroSyncMock.createManualJournal.mockResolvedValue('xero-123');
    xeroMappingsMock.saveMapping.mockResolvedValue(undefined);

    quickbooksMappingsMock.findQuickBooksJournalId.mockResolvedValue(null);
    quickbooksSyncMock.createJournalEntry.mockResolvedValue('qb-123');
    quickbooksMappingsMock.saveMapping.mockResolvedValue(undefined);

    const event = new JournalEntryCreatedEvent('journal-1', 'tenant-1', 'Test Journal', '2023-01-01', 'sync', 'ref-1', []);

    await listener.handle(event);

    expect(netsuiteSyncMock.createJournalEntry).toHaveBeenCalledWith('Test Journal', 'ref-1', []);
    expect(netsuiteMappingsMock.saveMapping).toHaveBeenCalledWith('journal-1', 'ns-123');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[NetSuite Sync] Successfully mapped'));

    expect(xeroSyncMock.createManualJournal).toHaveBeenCalledWith('Test Journal', 'ref-1', []);
    expect(xeroMappingsMock.saveMapping).toHaveBeenCalledWith('journal-1', 'xero-123');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[Xero Sync] Successfully mapped'));

    expect(quickbooksSyncMock.createJournalEntry).toHaveBeenCalledWith('Test Journal', 'ref-1', []);
    expect(quickbooksMappingsMock.saveMapping).toHaveBeenCalledWith('journal-1', 'qb-123');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[QuickBooks Sync] Successfully mapped'));
  });

  it('should not sync if mappings already exist', async () => {
    netsuiteMappingsMock.findNetSuiteJournalId.mockResolvedValue('ns-existing');
    xeroMappingsMock.findXeroJournalId.mockResolvedValue('xero-existing');
    quickbooksMappingsMock.findQuickBooksJournalId.mockResolvedValue('qb-existing');

    const event = new JournalEntryCreatedEvent('journal-2', 'tenant-1', 'Test', '2023-01-01', 'sync', null, []);
    await listener.handle(event);

    expect(netsuiteSyncMock.createJournalEntry).not.toHaveBeenCalled();
    expect(xeroSyncMock.createManualJournal).not.toHaveBeenCalled();
    expect(quickbooksSyncMock.createJournalEntry).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('should catch errors and log them when sync fails', async () => {
    netsuiteMappingsMock.findNetSuiteJournalId.mockResolvedValue(null);
    const nsError = new Error('NetSuite API Down');
    netsuiteSyncMock.createJournalEntry.mockRejectedValue(nsError);

    xeroMappingsMock.findXeroJournalId.mockResolvedValue(null);
    const xeroError = new Error('Xero API Down');
    xeroSyncMock.createManualJournal.mockRejectedValue(xeroError);

    quickbooksMappingsMock.findQuickBooksJournalId.mockResolvedValue(null);
    const qbError = new Error('QuickBooks API Down');
    quickbooksSyncMock.createJournalEntry.mockRejectedValue(qbError);

    const event = new JournalEntryCreatedEvent('journal-3', 'tenant-1', 'Test', '2023-01-01', 'sync', null, []);
    await listener.handle(event);

    expect(consoleErrorSpy).toHaveBeenCalledWith('[NetSuite Sync] Failed for journal journal-3:', nsError);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[Xero Sync] Failed for journal journal-3:', xeroError);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[QuickBooks Sync] Failed for journal journal-3:', qbError);

    // Mappings shouldn't be saved if creation fails
    expect(netsuiteMappingsMock.saveMapping).not.toHaveBeenCalled();
    expect(xeroMappingsMock.saveMapping).not.toHaveBeenCalled();
    expect(quickbooksMappingsMock.saveMapping).not.toHaveBeenCalled();
  });

  it('should handle NetSuite sync error without crashing other syncs', async () => {
    // NetSuite fails
    netsuiteMappingsMock.findNetSuiteJournalId.mockResolvedValue(null);
    const nsError = new Error('NetSuite API Down');
    netsuiteSyncMock.createJournalEntry.mockRejectedValue(nsError);

    // Xero succeeds
    xeroMappingsMock.findXeroJournalId.mockResolvedValue(null);
    xeroSyncMock.createManualJournal.mockResolvedValue('xero-123');
    xeroMappingsMock.saveMapping.mockResolvedValue(undefined);

    // QuickBooks succeeds
    quickbooksMappingsMock.findQuickBooksJournalId.mockResolvedValue(null);
    quickbooksSyncMock.createJournalEntry.mockResolvedValue('qb-123');
    quickbooksMappingsMock.saveMapping.mockResolvedValue(undefined);

    const event = new JournalEntryCreatedEvent('journal-error-ns', 'tenant-1', 'Test', '2023-01-01', 'sync', null, []);
    await listener.handle(event);

    expect(consoleErrorSpy).toHaveBeenCalledWith('[NetSuite Sync] Failed for journal journal-error-ns:', nsError);
    expect(netsuiteMappingsMock.saveMapping).not.toHaveBeenCalled();

    // Verify Xero and QuickBooks still ran
    expect(xeroSyncMock.createManualJournal).toHaveBeenCalled();
    expect(xeroMappingsMock.saveMapping).toHaveBeenCalledWith('journal-error-ns', 'xero-123');

    expect(quickbooksSyncMock.createJournalEntry).toHaveBeenCalled();
    expect(quickbooksMappingsMock.saveMapping).toHaveBeenCalledWith('journal-error-ns', 'qb-123');
  });

it('should handle Xero sync errors without crashing', async () => {
    // Setup to make NetSuite and QuickBooks succeed or skip
    netsuiteMappingsMock.findNetSuiteJournalId.mockResolvedValue('ns-existing');
    quickbooksMappingsMock.findQuickBooksJournalId.mockResolvedValue('qb-existing');

    // Setup Xero to fail
    xeroMappingsMock.findXeroJournalId.mockResolvedValue(null);
    const xeroError = new Error('Xero API Timeout');
    xeroSyncMock.createManualJournal.mockRejectedValue(xeroError);

    const event = new JournalEntryCreatedEvent('journal-xero-err', 'tenant-1', 'Test', '2023-01-01', 'sync', null, []);

    // Execution - ensure it resolves (does not crash)
    await expect(listener.handle(event)).resolves.toBeUndefined();

    // Verification
    expect(consoleErrorSpy).toHaveBeenCalledWith('[Xero Sync] Failed for journal journal-xero-err:', xeroError);
    expect(xeroMappingsMock.saveMapping).not.toHaveBeenCalled();

  });

  it('should handle NetSuite sync errors without crashing', async () => {
    // Setup to make Xero and QuickBooks succeed or skip
    xeroMappingsMock.findXeroJournalId.mockResolvedValue('xero-existing');
    quickbooksMappingsMock.findQuickBooksJournalId.mockResolvedValue('qb-existing');

    // Setup NetSuite to fail
    netsuiteMappingsMock.findNetSuiteJournalId.mockResolvedValue(null);
    const nsError = new Error('NetSuite API Timeout');
    netsuiteSyncMock.createJournalEntry.mockRejectedValue(nsError);

    const event = new JournalEntryCreatedEvent('journal-ns-err', 'tenant-1', 'Test', '2023-01-01', 'sync', null, []);

    // Execution - ensure it resolves (does not crash)
    await expect(listener.handle(event)).resolves.toBeUndefined();

    // Verification
    expect(consoleErrorSpy).toHaveBeenCalledWith('[NetSuite Sync] Failed for journal journal-ns-err:', nsError);
    expect(netsuiteMappingsMock.saveMapping).not.toHaveBeenCalled();
  });

  it('should handle QuickBooks sync errors without crashing', async () => {
    // Setup to make NetSuite and Xero succeed or skip
    netsuiteMappingsMock.findNetSuiteJournalId.mockResolvedValue('ns-existing');
    xeroMappingsMock.findXeroJournalId.mockResolvedValue('xero-existing');

    // Setup QuickBooks to fail
    quickbooksMappingsMock.findQuickBooksJournalId.mockResolvedValue(null);
    const qbError = new Error('QuickBooks API Timeout');
    quickbooksSyncMock.createJournalEntry.mockRejectedValue(qbError);

    const event = new JournalEntryCreatedEvent('journal-qb-err', 'tenant-1', 'Test', '2023-01-01', 'sync', null, []);

    // Execution - ensure it resolves (does not crash)
    await expect(listener.handle(event)).resolves.toBeUndefined();

    // Verification
    expect(consoleErrorSpy).toHaveBeenCalledWith('[QuickBooks Sync] Failed for journal journal-qb-err:', qbError);
    expect(quickbooksMappingsMock.saveMapping).not.toHaveBeenCalled();
  });
});
