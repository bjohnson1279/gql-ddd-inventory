import { AuditProcessorService, AuditDataProvider } from '../../src/domain/services/AuditProcessorService';

describe('AuditProcessorService', () => {
  let mockDataProvider: jest.Mocked<AuditDataProvider>;
  let service: AuditProcessorService;

  beforeEach(() => {
    mockDataProvider = {
      findActiveIntegrationConnections: jest.fn().mockResolvedValue([]),
      findExternalMappings: jest.fn().mockResolvedValue([]),
      findProductVariants: jest.fn().mockResolvedValue([]),
      getLedgerSums: jest.fn().mockResolvedValue([]),
      findOpenAuditDiscrepancies: jest.fn().mockResolvedValue([]),
      createAuditDiscrepancies: jest.fn().mockResolvedValue(undefined),
      findRecentJournalEntries: jest.fn().mockResolvedValue([]),
      findQuickbooksJournalMappings: jest.fn().mockResolvedValue([]),
      findXeroJournalMappings: jest.fn().mockResolvedValue([]),
      findNetsuiteJournalMappings: jest.fn().mockResolvedValue([]),
      findAuditDiscrepancyById: jest.fn().mockResolvedValue(null),
      resolveAuditDiscrepancyAndCreateOutboxEvent: jest.fn().mockResolvedValue(undefined),
    };
    service = new AuditProcessorService(mockDataProvider);
  });

  it('should return zero discrepancies when no integrations exist', async () => {
    const result = await service.runAudit('tenant-1');
    expect(result).toEqual({ shopifyDiscrepancies: 0, accountingDiscrepancies: 0 });
    expect(mockDataProvider.findActiveIntegrationConnections).toHaveBeenCalledWith('tenant-1');
  });

  it('should return false when trying to resolve non-existent discrepancy', async () => {
    mockDataProvider.findAuditDiscrepancyById.mockResolvedValue(null);
    const resolved = await service.resolveDiscrepancy('tenant-1', 'disc-1', 'notes');
    expect(resolved).toBe(false);
  });

  it('should resolve open discrepancy and create outbox event', async () => {
    mockDataProvider.findAuditDiscrepancyById.mockResolvedValue({
      id: 'disc-1',
      tenantId: 'tenant-1',
      type: 'SHOPIFY_STOCK_MISMATCH',
      referenceId: 'SKU-1:LOC-1',
      externalRefId: 'ext-1',
      status: 'OPEN'
    });

    const resolved = await service.resolveDiscrepancy('tenant-1', 'disc-1', 'Resolved manually');
    expect(resolved).toBe(true);
    expect(mockDataProvider.resolveAuditDiscrepancyAndCreateOutboxEvent).toHaveBeenCalledWith(
      'tenant-1',
      'disc-1',
      'Resolved manually',
      expect.objectContaining({ eventType: 'ShopifyStockSyncRequested' })
    );
  });
});
