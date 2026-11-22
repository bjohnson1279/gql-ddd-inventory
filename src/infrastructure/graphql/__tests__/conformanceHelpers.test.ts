import {
  clearTenantCache,
  recordTenantCacheRead,
  recordTenantCacheInvalidation,
  getTenantCacheStats,
  assignRfidTagForTenant,
  listRfidTagsForTenant,
  computeComplianceHash,
  recordStockComplianceAndEvents,
  validateAndConsumeCostLayersForDispatch,
} from '../conformanceHelpers';

describe('GraphQL conformanceHelpers', () => {
  const tenant = 'tenant-unit-test';

  beforeEach(() => {
    clearTenantCache(tenant);
  });

  test('tracks per-tenant cache misses, hits, invalidations, and clear', () => {
    expect(getTenantCacheStats(tenant)).toEqual({
      hits: 0,
      misses: 0,
      hitRatio: 0,
      invalidations: 0,
      activeKeysCount: 0,
    });

    recordTenantCacheRead(tenant, 'SKU-1:default');
    recordTenantCacheRead(tenant, 'SKU-1:default');
    const afterReads = getTenantCacheStats(tenant);
    expect(afterReads.misses).toBe(1);
    expect(afterReads.hits).toBe(1);
    expect(afterReads.hitRatio).toBe(0.5);
    expect(afterReads.activeKeysCount).toBe(1);

    recordTenantCacheInvalidation(tenant);
    const afterInv = getTenantCacheStats(tenant);
    expect(afterInv.invalidations).toBe(1);
    expect(afterInv.activeKeysCount).toBe(0);

    clearTenantCache(tenant);
    expect(getTenantCacheStats(tenant).hits).toBe(0);
  });

  test('assigns and lists RFID tags isolated by tenant', () => {
    expect(listRfidTagsForTenant('tenant-empty')).toEqual([]);
    expect(assignRfidTagForTenant('tenant-rfid-a', 'EPC-1', 'SKU-A', 'SN-1')).toBe(true);
    expect(assignRfidTagForTenant('tenant-rfid-b', 'EPC-2', 'SKU-B', 'SN-2')).toBe(true);

    expect(listRfidTagsForTenant('tenant-rfid-a')).toEqual([
      { epc: 'EPC-1', sku: 'SKU-A', serialNumber: 'SN-1', status: 'ACTIVE' },
    ]);
    expect(listRfidTagsForTenant('tenant-rfid-b')).toHaveLength(1);
  });

  test('computeComplianceHash produces deterministic SHA-256 hex digest', () => {
    const h1 = computeComplianceHash(tenant, 1, 'StockReceived', '2026-01-01T00:00:00.000Z', '0'.repeat(64), '{"sku":"A"}');
    const h2 = computeComplianceHash(tenant, 1, 'StockReceived', '2026-01-01T00:00:00.000Z', '0'.repeat(64), '{"sku":"A"}');
    const h3 = computeComplianceHash(tenant, 1, 'StockReceived', '2026-01-01T00:00:00.000Z', '0'.repeat(64), '{"sku":"B"}');
    expect(h1).toHaveLength(64);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });

  test('recordStockComplianceAndEvents writes hash-chained ledger, outbox event, and webhook delivery', async () => {
    const createdLedger: any[] = [];
    const createdOutbox: any[] = [];
    const createdDeliveries: any[] = [];
    const mockPrisma: any = {
      complianceLedgerModel: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => {
          createdLedger.push(data);
          return Promise.resolve(data);
        }),
      },
      outboxEvent: {
        create: jest.fn().mockImplementation(({ data }) => {
          createdOutbox.push(data);
          return Promise.resolve(data);
        }),
      },
      webhookSubscription: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'sub-1', tenantId: tenant, isActive: true, eventTypes: ['StockReceived'] },
        ]),
      },
      webhookDelivery: {
        create: jest.fn().mockImplementation(({ data }) => {
          createdDeliveries.push(data);
          return Promise.resolve(data);
        }),
      },
    };

    await recordStockComplianceAndEvents(mockPrisma, tenant, 'actor-1', 'receive', 'SKU-1', 'default', 5);

    expect(createdLedger).toHaveLength(1);
    expect(createdLedger[0].sequenceNumber).toBe(1);
    expect(createdLedger[0].previousHash).toBe('0'.repeat(64));
    expect(createdLedger[0].eventType).toBe('StockReceived');
    expect(createdOutbox).toHaveLength(1);
    expect(createdOutbox[0].eventType).toBe('StockChanged');
    expect(createdDeliveries).toHaveLength(1);
    expect(createdDeliveries[0].subscriptionId).toBe('sub-1');
    expect(createdDeliveries[0].status).toBe('FAILED');
  });

  test('validateAndConsumeCostLayersForDispatch rejects quarantined lots', async () => {
    const mockPrisma: any = {
      productVariant: { findUnique: jest.fn().mockResolvedValue({ id: 'var-q' }) },
      inventoryCostLayer: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'layer-1', lotNumber: 'LOT-Q', initialQuantity: 5, consumedQuantity: 0, unitCostCents: 100 },
        ]),
      },
      lotBatch: {
        findMany: jest.fn().mockResolvedValue([{ lotNumber: 'LOT-Q', status: 'QUARANTINED' }]),
      },
    };

    await expect(
      validateAndConsumeCostLayersForDispatch(mockPrisma, tenant, 'SKU-Q', 2)
    ).rejects.toThrow(/quarantined/i);
  });

  test('validateAndConsumeCostLayersForDispatch consumes FIFO layers and returns first lot', async () => {
    const updates: any[] = [];
    const mockPrisma: any = {
      productVariant: { findUnique: jest.fn().mockResolvedValue({ id: 'var-1' }) },
      inventoryCostLayer: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'l1', lotNumber: 'LOT-1', initialQuantity: 3, consumedQuantity: 0, unitCostCents: 100 },
          { id: 'l2', lotNumber: 'LOT-2', initialQuantity: 5, consumedQuantity: 0, unitCostCents: 200 },
        ]),
        update: jest.fn().mockImplementation((arg) => {
          updates.push(arg);
          return Promise.resolve(arg);
        }),
      },
      lotBatch: { findMany: jest.fn().mockResolvedValue([]) },
      tenantAccountingConfig: { findUnique: jest.fn().mockResolvedValue({ costingMethod: 'fifo' }) },
    };

    const lot = await validateAndConsumeCostLayersForDispatch(mockPrisma, tenant, 'SKU-1', 4);
    expect(lot).toBe('LOT-1');
    expect(updates).toEqual([
      { where: { id: 'l1' }, data: { consumedQuantity: 3 } },
      { where: { id: 'l2' }, data: { consumedQuantity: 1 } },
    ]);
  });
});
