import { WebhookDeliveryWorker } from '../../../src/infrastructure/workers/WebhookDeliveryWorker';
import { prisma } from '../../../src/infrastructure/persistence/prismaClient';
import crypto from 'crypto';

jest.mock('../../../src/infrastructure/persistence/prismaClient', () => {
  const mockDeliveries: any[] = [];
  const mockSubscriptions: any[] = [];

  return {
    prisma: {
      webhookDelivery: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn()
      },
      webhookSubscription: {
        findUnique: jest.fn(),
        findMany: jest.fn()
      }
    }
  };
});

describe('WebhookDeliveryWorker (GraphQL)', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('should process pending deliveries successfully', async () => {
    const mockDelivery = {
      id: 'delivery-1',
      subscriptionId: 'sub-1',
      eventType: 'InventoryDecremented',
      payload: JSON.stringify({ sku: 'SKU-1', quantity: 5 }),
      attempts: 0
    };

    const mockSubscription = {
      id: 'sub-1',
      isActive: true,
      targetUrl: 'https://example.com/webhook',
      secret: 'supersecretkey'
    };

    (prisma.webhookDelivery.findMany as jest.Mock).mockResolvedValue([mockDelivery]);
    (prisma.webhookSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200
    } as any);

    await WebhookDeliveryWorker.processPendingDeliveries();

    // Verify updates status to processing and success
    expect(prisma.webhookDelivery.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['delivery-1'] } },
      data: { status: 'Processing' }
    });

    const expectedSignature = crypto
      .createHmac('sha256', 'supersecretkey')
      .update(mockDelivery.payload)
      .digest('hex');

    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature-256': expectedSignature,
        'X-Webhook-Event': 'InventoryDecremented'
      },
      body: mockDelivery.payload,
      redirect: 'error'
    });

    expect(prisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({
        status: 'Success',
        attempts: 1,
        processedAt: expect.any(Date)
      })
    });
  });

  it('should handle failures and schedule a retry', async () => {
    const mockDelivery = {
      id: 'delivery-2',
      subscriptionId: 'sub-2',
      eventType: 'LowStockAlertEvent',
      payload: JSON.stringify({ sku: 'SKU-2', count: 0 }),
      attempts: 1
    };

    const mockSubscription = {
      id: 'sub-2',
      isActive: true,
      targetUrl: 'https://example.com/webhook-fail',
      secret: 'anothersecret'
    };

    (prisma.webhookDelivery.findMany as jest.Mock).mockResolvedValue([mockDelivery]);
    (prisma.webhookSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500
    } as any);

    await WebhookDeliveryWorker.processPendingDeliveries();

    expect(prisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-2' },
      data: expect.objectContaining({
        status: 'Pending',
        attempts: 2,
        lastError: 'HTTP Error Status: 500',
        nextAttemptAt: expect.any(Date)
      })
    });
  });
});
