import { AuditProcessorService, AuditDataProvider } from '../../../src/application/services/AuditProcessorService';

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

  it('should return false when trying to resolve an already resolved discrepancy', async () => {
    mockDataProvider.findAuditDiscrepancyById.mockResolvedValue({
      id: 'disc-1',
      tenantId: 'tenant-1',
      type: 'SHOPIFY_STOCK_MISMATCH',
      referenceId: 'SKU-1:LOC-1',
      status: 'RESOLVED'
    });

    const resolved = await service.resolveDiscrepancy('tenant-1', 'disc-1', 'Already done');
    expect(resolved).toBe(false);
    expect(mockDataProvider.resolveAuditDiscrepancyAndCreateOutboxEvent).not.toHaveBeenCalled();
  });

  it('should resolve non-Shopify discrepancy without creating an outbox event', async () => {
    mockDataProvider.findAuditDiscrepancyById.mockResolvedValue({
      id: 'disc-2',
      tenantId: 'tenant-1',
      type: 'ACCOUNTING_JOURNAL_MISSING',
      referenceId: 'journal-123',
      status: 'OPEN'
    });

    const resolved = await service.resolveDiscrepancy('tenant-1', 'disc-2', 'Manual accounting adjustment');
    expect(resolved).toBe(true);
    expect(mockDataProvider.resolveAuditDiscrepancyAndCreateOutboxEvent).toHaveBeenCalledWith(
      'tenant-1',
      'disc-2',
      'Manual accounting adjustment',
      null
    );
  });

  it('should detect Shopify stock discrepancies in mock mode when SKU ends with -DIFF and not duplicate existing discrepancies', async () => {
    mockDataProvider.findActiveIntegrationConnections.mockResolvedValue([
      { id: 'conn-1', platform: 'Shopify', isActive: true, accessToken: 'mock-token', storeDomain: 'test-store.myshopify.com' }
    ]);
    mockDataProvider.findExternalMappings.mockImplementation(async (tenantId, entityType) => {
      if (entityType === 'VARIANT') {
        return [
          { integrationId: 'conn-1', internalId: 'var-1', externalSecondaryId: 'item-1' },
          { integrationId: 'conn-1', internalId: 'var-2', externalSecondaryId: 'item-2' },
          { integrationId: 'conn-1', internalId: 'var-3', externalSecondaryId: '' }
        ];
      }
      if (entityType === 'LOCATION') {
        return [
          { integrationId: 'conn-1', internalId: 'loc-1', externalId: 'ext-loc-1' }
        ];
      }
      return [];
    });
    mockDataProvider.findProductVariants.mockResolvedValue([
      { id: 'var-1', sku: 'SKU-A-DIFF' },
      { id: 'var-2', sku: 'SKU-B-MATCH' }
    ]);
    mockDataProvider.getLedgerSums.mockResolvedValue([
      { variantId: 'var-1', locationId: 'loc-1', sumQuantity: 50 },
      { variantId: 'var-2', locationId: 'loc-1', sumQuantity: 20 }
    ]);
    mockDataProvider.findOpenAuditDiscrepancies.mockResolvedValue([]);

    const result = await service.runAudit('tenant-1');
    expect(result.shopifyDiscrepancies).toBe(1);
    expect(mockDataProvider.createAuditDiscrepancies).toHaveBeenCalledWith([
      expect.objectContaining({
        tenantId: 'tenant-1',
        type: 'SHOPIFY_STOCK_MISMATCH',
        referenceId: 'SKU-A-DIFF:loc-1',
        externalRefId: 'item-1',
        description: expect.stringContaining('Local: 50, Shopify: 60')
      })
    ]);
  });

  it('should query live Shopify GraphQL API when not in mock mode and report stock discrepancies', async () => {
    const originalFetch = global.fetch;
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          nodes: [
            {
              id: 'item-1',
              inventoryLevels: {
                edges: [
                  {
                    node: {
                      location: { id: 'ext-loc-1' },
                      quantities: [{ quantity: 15 }]
                    }
                  }
                ]
              }
            }
          ]
        }
      })
    });
    global.fetch = mockFetch as any;

    try {
      mockDataProvider.findActiveIntegrationConnections.mockResolvedValue([
        { id: 'conn-real', platform: 'Shopify', isActive: true, accessToken: 'real-shpat-token', storeDomain: 'real-store.myshopify.com' }
      ]);
      mockDataProvider.findExternalMappings.mockImplementation(async (tenantId, entityType) => {
        if (entityType === 'VARIANT') {
          return [{ integrationId: 'conn-real', internalId: 'var-1', externalSecondaryId: 'item-1' }];
        }
        if (entityType === 'LOCATION') {
          return [{ integrationId: 'conn-real', internalId: 'loc-1', externalId: 'ext-loc-1' }];
        }
        return [];
      });
      mockDataProvider.findProductVariants.mockResolvedValue([
        { id: 'var-1', sku: 'SKU-LIVE' }
      ]);
      mockDataProvider.getLedgerSums.mockResolvedValue([
        { variantId: 'var-1', locationId: 'loc-1', sumQuantity: 10 }
      ]);
      mockDataProvider.findOpenAuditDiscrepancies.mockResolvedValue([]);

      const result = await service.runAudit('tenant-1');
      expect(mockFetch).toHaveBeenCalled();
      expect(result.shopifyDiscrepancies).toBe(1);
      expect(mockDataProvider.createAuditDiscrepancies).toHaveBeenCalledWith([
        expect.objectContaining({
          tenantId: 'tenant-1',
          type: 'SHOPIFY_STOCK_MISMATCH',
          referenceId: 'SKU-LIVE:loc-1',
          description: expect.stringContaining('Local: 10, Shopify: 15')
        })
      ]);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should handle Shopify API failures gracefully when not in mock mode', async () => {
    const originalFetch = global.fetch;
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500
    });
    global.fetch = mockFetch as any;

    try {
      mockDataProvider.findActiveIntegrationConnections.mockResolvedValue([
        { id: 'conn-real', platform: 'Shopify', isActive: true, accessToken: 'real-shpat-token', storeDomain: 'real-store.myshopify.com' }
      ]);
      mockDataProvider.findExternalMappings.mockImplementation(async (tenantId, entityType) => {
        if (entityType === 'VARIANT') {
          return [{ integrationId: 'conn-real', internalId: 'var-1', externalSecondaryId: 'item-1' }];
        }
        if (entityType === 'LOCATION') {
          return [{ integrationId: 'conn-real', internalId: 'loc-1', externalId: 'ext-loc-1' }];
        }
        return [];
      });
      mockDataProvider.findProductVariants.mockResolvedValue([
        { id: 'var-1', sku: 'SKU-LIVE' }
      ]);
      mockDataProvider.getLedgerSums.mockResolvedValue([
        { variantId: 'var-1', locationId: 'loc-1', sumQuantity: 10 }
      ]);
      mockDataProvider.findOpenAuditDiscrepancies.mockResolvedValue([]);

      const result = await service.runAudit('tenant-1');
      expect(mockFetch).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Shopify API responded with status 500');
      expect(result.shopifyDiscrepancies).toBe(0);
    } finally {
      global.fetch = originalFetch;
      consoleErrorSpy.mockRestore();
    }
  });

  it('should detect unmapped accounting journals across QuickBooks, Xero, and NetSuite and ignore existing open discrepancies', async () => {
    mockDataProvider.findActiveIntegrationConnections.mockResolvedValue([
      { id: 'conn-qbo', platform: 'QUICKBOOKS', isActive: true },
      { id: 'conn-xero', platform: 'XERO', isActive: true },
      { id: 'conn-ns', platform: 'NETSUITE', isActive: true }
    ]);
    mockDataProvider.findRecentJournalEntries.mockResolvedValue([
      { id: 'j-1', description: 'Mapped to QBO' },
      { id: 'j-2', description: 'Mapped to Xero' },
      { id: 'j-3', description: 'Mapped to NetSuite' },
      { id: 'j-4', description: 'Unmapped new journal' },
      { id: 'j-5', description: 'Unmapped already reported journal' }
    ]);
    mockDataProvider.findQuickbooksJournalMappings.mockResolvedValue([
      { journalEntryId: 'j-1' }
    ]);
    mockDataProvider.findXeroJournalMappings.mockResolvedValue([
      { journalEntryId: 'j-2' }
    ]);
    mockDataProvider.findNetsuiteJournalMappings.mockResolvedValue([
      { journalEntryId: 'j-3' }
    ]);
    mockDataProvider.findOpenAuditDiscrepancies.mockResolvedValue([
      { referenceId: 'j-5' }
    ]);

    const result = await service.runAudit('tenant-1');
    expect(result.accountingDiscrepancies).toBe(1);
    expect(mockDataProvider.createAuditDiscrepancies).toHaveBeenCalledWith([
      expect.objectContaining({
        tenantId: 'tenant-1',
        type: 'ACCOUNTING_JOURNAL_MISSING',
        referenceId: 'j-4',
        description: expect.stringContaining('Journal entry j-4 (Unmapped new journal) is not mapped')
      })
    ]);
  });
});
