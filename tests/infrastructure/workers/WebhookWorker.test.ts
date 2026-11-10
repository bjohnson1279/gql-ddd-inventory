import { WebhookWorker } from '../../../src/infrastructure/workers/WebhookWorker';
import { prisma } from '../../../src/infrastructure/persistence/prismaClient';
import { integrationRepository } from '../../../src/infrastructure/graphql/resolvers';

jest.mock('../../../src/infrastructure/persistence/prismaClient', () => {
  const mockTenantPrisma = {
    $transaction: jest.fn(async (cb: any) => cb()),
  };
  return {
    prisma: {
      webhookEvent: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
    },
    globalPrisma: {},
    getTenantPrisma: jest.fn(() => mockTenantPrisma),
  };
});

jest.mock('../../../src/infrastructure/graphql/resolvers', () => ({
  integrationRepository: {
    findByStoreDomain: jest.fn(),
    findByStoreDomains: jest.fn(),
    findById: jest.fn(),
  },
  externalMappingRepository: {
    findByExternalId: jest.fn().mockResolvedValue({ internalId: 'loc-internal-1' }),
    findByExternalIds: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockResolvedValue(undefined),
  },
  productRepository: {
    findById: jest.fn(),
    save: jest.fn(),
  },
  inventoryService: {
    decrementStock: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('WebhookWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should batch fetch integration connections for all events and eliminate N+1 queries', async () => {
    const mockEvents = [
      {
        id: 'event-1',
        shopDomain: 'store1.myshopify.com',
        topic: 'orders/create',
        payload: JSON.stringify({ id: 101, line_items: [{ variant_id: 1, quantity: 2 }] }),
        attempts: 0,
      },
      {
        id: 'event-2',
        shopDomain: 'store2.myshopify.com',
        topic: 'orders/create',
        payload: JSON.stringify({ id: 102, line_items: [{ variant_id: 2, quantity: 1 }] }),
        attempts: 0,
      },
      {
        id: 'event-3',
        shopDomain: 'store1.myshopify.com',
        topic: 'orders/paid',
        payload: JSON.stringify({ id: 103, line_items: [{ variant_id: 3, quantity: 4 }] }),
        attempts: 0,
      },
    ];

    const mockConnections = [
      {
        id: { value: 'conn-1' },
        tenantId: { value: 'tenant-1' },
        storeDomain: 'store1.myshopify.com',
        isActive: true,
      },
      {
        id: { value: 'conn-2' },
        tenantId: { value: 'tenant-2' },
        storeDomain: 'store2.myshopify.com',
        isActive: true,
      },
    ];

    (prisma.webhookEvent.findMany as jest.Mock).mockResolvedValue(mockEvents);
    (prisma.webhookEvent.updateMany as jest.Mock).mockResolvedValue({ count: 3 });
    (integrationRepository.findByStoreDomains as jest.Mock).mockResolvedValue(mockConnections);
    (integrationRepository.findById as jest.Mock).mockImplementation(async (id: any) => {
      const conn = mockConnections.find((c) => c.id.value === (id?.value || id));
      return conn || null;
    });

    await WebhookWorker.processPendingEvents();

    expect(integrationRepository.findByStoreDomains).toHaveBeenCalledTimes(1);
    expect(integrationRepository.findByStoreDomains).toHaveBeenCalledWith(
      expect.arrayContaining(['store1.myshopify.com', 'store2.myshopify.com'])
    );
    expect(integrationRepository.findByStoreDomain).not.toHaveBeenCalled();

    expect(prisma.webhookEvent.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['event-1', 'event-2', 'event-3'] } },
      data: { status: 'Processing' },
    });
    expect(prisma.webhookEvent.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['event-1', 'event-2', 'event-3'] } },
      data: { status: 'Processed', attempts: { increment: 1 } },
    });
  });

  it('should handle missing or inactive connection gracefully for an event', async () => {
    const mockEvents = [
      {
        id: 'event-inactive',
        shopDomain: 'inactive.myshopify.com',
        topic: 'orders/create',
        payload: JSON.stringify({ id: 999 }),
        attempts: 0,
      },
    ];

    (prisma.webhookEvent.findMany as jest.Mock).mockResolvedValue(mockEvents);
    (prisma.webhookEvent.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (integrationRepository.findByStoreDomains as jest.Mock).mockResolvedValue([]);

    await WebhookWorker.processPendingEvents();

    expect(integrationRepository.findByStoreDomains).toHaveBeenCalledTimes(1);
    expect(prisma.webhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-inactive' },
      data: {
        status: 'Pending',
        attempts: 1,
        lastError: 'No active connection found for shop: inactive.myshopify.com',
      },
    });
  });
});
