jest.mock('../../../src/infrastructure/persistence/prismaClient', () => ({
  prisma: {
    productVariant: { findUnique: jest.fn() },
    integrationConnection: { findMany: jest.fn() },
    externalMapping: { findFirst: jest.fn() },
    ledgerEntry: { aggregate: jest.fn() }
  }
}));

import { ShopifyStockSyncHandler } from '../../../src/application/eventHandlers/ShopifyStockSyncHandler';
import { ShopifyStockSyncRequested } from '../../../src/domain/events/InventoryEvents';
import { prisma } from '../../../src/infrastructure/persistence/prismaClient';

describe('ShopifyStockSyncHandler', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  const createEvent = () => new ShopifyStockSyncRequested('tenant-1', 'SKU-123', 'loc-1', 'ext-123');

  it('should return early if no variant is found', async () => {
    (prisma.productVariant.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.integrationConnection.findMany as jest.Mock).mockResolvedValue([{ tenantId: 'tenant-1', platform: 'Shopify', isActive: true }]);

    const handler = new ShopifyStockSyncHandler();
    await handler.handle(createEvent());

    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('No variant or active Shopify connection found'));
    expect(prisma.externalMapping.findFirst).not.toHaveBeenCalled();
  });

  it('should return early if no active connections are found', async () => {
    (prisma.productVariant.findUnique as jest.Mock).mockResolvedValue({ id: 'v-1', sku: 'SKU-123' });
    (prisma.integrationConnection.findMany as jest.Mock).mockResolvedValue([]);

    const handler = new ShopifyStockSyncHandler();
    await handler.handle(createEvent());

    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('No variant or active Shopify connection found'));
    expect(prisma.externalMapping.findFirst).not.toHaveBeenCalled();
  });

  it('should return early if no location mapping is found', async () => {
    (prisma.productVariant.findUnique as jest.Mock).mockResolvedValue({ id: 'v-1', sku: 'SKU-123' });
    (prisma.integrationConnection.findMany as jest.Mock).mockResolvedValue([{ tenantId: 'tenant-1', platform: 'Shopify', isActive: true }]);
    (prisma.externalMapping.findFirst as jest.Mock).mockResolvedValue(null);

    const handler = new ShopifyStockSyncHandler();
    await handler.handle(createEvent());

    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('No location mapping found for location loc-1'));
    expect(prisma.ledgerEntry.aggregate).not.toHaveBeenCalled();
  });

  it('should handle successful Shopify API sync', async () => {
    (prisma.productVariant.findUnique as jest.Mock).mockResolvedValue({ id: 'v-1', sku: 'SKU-123' });
    (prisma.integrationConnection.findMany as jest.Mock).mockResolvedValue([
      { tenantId: 'tenant-1', platform: 'Shopify', isActive: true, accessToken: 'real-token', storeDomain: 'real-store.myshopify.com' }
    ]);
    (prisma.externalMapping.findFirst as jest.Mock).mockResolvedValue({ externalId: 'ext-loc-1' });
    (prisma.ledgerEntry.aggregate as jest.Mock).mockResolvedValue({ _sum: { quantity: 42 } });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          inventorySetOnHandQuantities: {
            userErrors: []
          }
        }
      })
    });

    const handler = new ShopifyStockSyncHandler();
    await handler.handle(createEvent());

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Syncing SKU SKU-123 stock level to Shopify'));
  });

  it('should throw an error if Shopify API responds with non-200 status', async () => {
    (prisma.productVariant.findUnique as jest.Mock).mockResolvedValue({ id: 'v-1', sku: 'SKU-123' });
    (prisma.integrationConnection.findMany as jest.Mock).mockResolvedValue([
      { tenantId: 'tenant-1', platform: 'Shopify', isActive: true, accessToken: 'real-token', storeDomain: 'real-store.myshopify.com' }
    ]);
    (prisma.externalMapping.findFirst as jest.Mock).mockResolvedValue({ externalId: 'ext-loc-1' });
    (prisma.ledgerEntry.aggregate as jest.Mock).mockResolvedValue({ _sum: { quantity: 42 } });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500
    });

    const handler = new ShopifyStockSyncHandler();
    await expect(handler.handle(createEvent())).rejects.toThrow('Shopify API responded with status 500');
  });

  it('should throw an error if Shopify API returns userErrors', async () => {
    (prisma.productVariant.findUnique as jest.Mock).mockResolvedValue({ id: 'v-1', sku: 'SKU-123' });
    (prisma.integrationConnection.findMany as jest.Mock).mockResolvedValue([
      { tenantId: 'tenant-1', platform: 'Shopify', isActive: true, accessToken: 'real-token', storeDomain: 'real-store.myshopify.com' }
    ]);
    (prisma.externalMapping.findFirst as jest.Mock).mockResolvedValue({ externalId: 'ext-loc-1' });
    (prisma.ledgerEntry.aggregate as jest.Mock).mockResolvedValue({ _sum: { quantity: 10 } });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          inventorySetOnHandQuantities: {
            userErrors: [
              { message: 'Inventory item not found' },
              { message: 'Invalid quantity' }
            ]
          }
        }
      })
    });

    const handler = new ShopifyStockSyncHandler();
    await expect(handler.handle(createEvent())).rejects.toThrow('Shopify API error: Inventory item not found, Invalid quantity');
  });

  it('should use mock branch when token is mock-token or storeDomain contains mock', async () => {
    (prisma.productVariant.findUnique as jest.Mock).mockResolvedValue({ id: 'v-1', sku: 'SKU-123' });
    (prisma.integrationConnection.findMany as jest.Mock).mockResolvedValue([
      { tenantId: 'tenant-1', platform: 'Shopify', isActive: true, accessToken: 'mock-token', storeDomain: 'mock-store.myshopify.com' }
    ]);
    (prisma.externalMapping.findFirst as jest.Mock).mockResolvedValue({ externalId: 'ext-loc-1' });
    (prisma.ledgerEntry.aggregate as jest.Mock).mockResolvedValue({ _sum: { quantity: 15 } });

    const handler = new ShopifyStockSyncHandler();
    await handler.handle(createEvent());

    expect(global.fetch).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[MOCK] Synced SKU SKU-123 to Shopify. Qty: 15'));
  });
});
