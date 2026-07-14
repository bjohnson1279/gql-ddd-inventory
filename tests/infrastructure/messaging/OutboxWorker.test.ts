import { PostgresInventoryRepository } from '../../../src/infrastructure/persistence/PostgresInventoryRepository';
import { InventoryItem } from '../../../src/domain/entities/InventoryItem';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { Quantity } from '../../../src/domain/valueObjects/Quantity';
import { deserializeEvent, OutboxWorker } from '../../../src/infrastructure/workers/OutboxWorker';
import { InventoryReconciledEvent, InventoryDecremented, LowStockAlertEvent, ShopifyStockSyncRequested } from '../../../src/domain/events/InventoryEvents';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { prisma } from '../../../src/infrastructure/persistence/prismaClient';

jest.mock('../../../src/infrastructure/persistence/prismaClient', () => {
  const createMock = jest.fn();
  const txMock = {
    inventoryItem: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    outboxEvent: {
      create: createMock,
      createMany: jest.fn(),
    },
  };

  // Expose it to the tests
  (global as any).txMock = txMock;
  return {
    prisma: {
      inventoryItem: {
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      outboxEvent: {
        create: createMock,
        createMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      webhookSubscription: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (cb) => cb(txMock)),
    },
  };
});

describe('Transactional Outbox Pattern', () => {
  it('should serialize and deserialize events correctly', () => {
    const originalEvent = new InventoryReconciledEvent('SKU1', 'LOC1', 10, 15, 5);
    const json = JSON.stringify(originalEvent);

    const deserialized = deserializeEvent('InventoryReconciledEvent', json);

    expect(deserialized.constructor.name).toBe('InventoryReconciledEvent');
    expect(deserialized.sku).toBe('SKU1');
    expect(deserialized.locationId).toBe('LOC1');
    expect(deserialized.variance).toBe(5);
  });

  describe('deserializeEvent additional types', () => {
    it('should deserialize InventoryDecremented', () => {
      const payload = {
        tenantId: 'T1',
        locationId: 'LOC1',
        variantId: { value: 'V1' },
        quantity: 10,
        referenceId: 'REF1',
        occurredAt: new Date().toISOString()
      };
      const event = deserializeEvent('InventoryDecremented', JSON.stringify(payload));
      expect(event).toBeInstanceOf(InventoryDecremented);
      expect(event.variantId.value).toBe('V1');
      expect(event.quantity).toBe(10);
    });

    it('should deserialize LowStockAlertEvent', () => {
      const payload = {
        sku: 'SKU1',
        locationId: 'LOC1',
        currentQuantity: 5,
        occurredAt: new Date().toISOString()
      };
      const event = deserializeEvent('LowStockAlertEvent', JSON.stringify(payload));
      expect(event).toBeInstanceOf(LowStockAlertEvent);
      expect(event.sku).toBe('SKU1');
      expect(event.currentQuantity).toBe(5);
    });

    it('should deserialize ShopifyStockSyncRequested', () => {
      const payload = {
        tenantId: 'T1',
        sku: 'SKU1',
        locationId: 'LOC1',
        externalRefId: 'ext-ref-1',
        occurredAt: new Date().toISOString()
      };
      const event = deserializeEvent('ShopifyStockSyncRequested', JSON.stringify(payload));
      expect(event).toBeInstanceOf(ShopifyStockSyncRequested);
      expect(event.tenantId).toBe('T1');
      expect(event.sku).toBe('SKU1');
      expect(event.locationId).toBe('LOC1');
      expect(event.externalRefId).toBe('ext-ref-1');
    });

    it('should fallback dynamically to constructor matching eventType name', () => {
      const payload = {
        prop: 'val',
        occurredAt: new Date().toISOString()
      };
      const event = deserializeEvent('CustomUnknownEvent', JSON.stringify(payload));
      expect(event.constructor.name).toBe('CustomUnknownEvent');
      expect(event.prop).toBe('val');
    });
  });

  it('should write to outbox during repository save', async () => {
    const repo = new PostgresInventoryRepository(prisma as any);
    const item = InventoryItem.createNew('id-1', 'SKU-OUTBOX', 'LOC-OUTBOX');

    // Add domain event
    item.reconcileStock(new Quantity(10));

    const txMock = (global as any).txMock;
    const outboxCreateManyMock = txMock.outboxEvent.createMany as jest.Mock;
    outboxCreateManyMock.mockClear();

    const findUniqueMock = prisma.inventoryItem.findUnique as jest.Mock;
    findUniqueMock.mockResolvedValue(null);

    await repo.save(item);

    expect(outboxCreateManyMock).toHaveBeenCalled();
    const arg = outboxCreateManyMock.mock.calls[0][0];
    expect(arg.data[0].eventType).toBe('InventoryReconciledEvent');
    expect(JSON.parse(arg.data[0].payload).sku).toBe('SKU-OUTBOX');
  });

  describe('OutboxWorker polling and processing', () => {
    beforeEach(() => {
      (prisma.outboxEvent.findMany as jest.Mock).mockClear();
      (prisma.outboxEvent.update as jest.Mock).mockClear();
      (prisma.outboxEvent.create as jest.Mock).mockClear();
    });

    afterEach(() => {
      OutboxWorker.stop();
    });

    it('should start and stop the poller', () => {
      expect((OutboxWorker as any).timer).toBeNull();
      OutboxWorker.start(100);
      expect((OutboxWorker as any).timer).not.toBeNull();

      OutboxWorker.stop();
      expect((OutboxWorker as any).timer).toBeNull();
    });

    it('should process pending events, publish them to eventBus, and mark as Processed', async () => {
      const { eventBus } = require('../../../src/infrastructure/graphql/resolvers');
      const eventBusPublishSpy = jest.spyOn(eventBus, 'publish').mockImplementation(() => {});

      const mockEvent = {
        id: 'evt-1',
        eventType: 'InventoryReconciledEvent',
        payload: JSON.stringify(new InventoryReconciledEvent('SKU1', 'LOC1', 10, 15, 5)),
        attempts: 0
      };

      const findManyMock = prisma.outboxEvent.findMany as jest.Mock;
      const updateMock = prisma.outboxEvent.update as jest.Mock;
      const updateManyMock = prisma.outboxEvent.updateMany as jest.Mock;

      findManyMock.mockResolvedValueOnce([mockEvent]);

      if (!prisma.webhookSubscription) prisma.webhookSubscription = {} as any;
      if (!prisma.webhookSubscription.findMany) prisma.webhookSubscription.findMany = jest.fn() as any;
      (prisma.webhookSubscription.findMany as jest.Mock).mockResolvedValue([]);

      updateMock.mockResolvedValue({});

      await OutboxWorker.processPendingEvents();

      // Should mark as Processing, then process, then mark as Processed


      expect(updateManyMock).toHaveBeenCalledWith({
        where: { id: { in: ['evt-1'] } },
        data: { status: 'Processing' }
      });
      expect(updateManyMock).toHaveBeenCalledWith({
        where: { id: { in: ['evt-1'] } },
        data: {
          status: 'Processed',
          attempts: { increment: 1 },
          processedAt: expect.any(Date)
        }
      });
      expect(eventBusPublishSpy).toHaveBeenCalled();
      eventBusPublishSpy.mockRestore();
    });

    it('should increment attempts and retry if processing fails (attempts < 3)', async () => {
      // Force deserializeEvent to throw by giving it invalid JSON payload
      const mockEvent = {
        id: 'evt-2',
        eventType: 'InventoryReconciledEvent',
        payload: '{invalid-json',
        attempts: 1
      };

      const findManyMock = prisma.outboxEvent.findMany as jest.Mock;
      const updateMock = prisma.outboxEvent.update as jest.Mock;
      const updateManyMock = prisma.outboxEvent.updateMany as jest.Mock;

      findManyMock.mockResolvedValueOnce([mockEvent]);
      updateMock.mockResolvedValue({});

      await OutboxWorker.processPendingEvents();

      // Processing update first, then error update
      expect(updateMock).toHaveBeenCalledWith({
        where: { id: 'evt-2' },
        data: {
          status: 'Pending',
          attempts: 2,
          lastError: expect.any(String),
          nextAttemptAt: expect.any(Date)
        }
      });
    });

    it('should mark event as Failed if attempts exceed 5', async () => {
      const mockEvent = {
        id: 'evt-3',
        eventType: 'InventoryReconciledEvent',
        payload: '{invalid-json',
        attempts: 4
      };

      const findManyMock = prisma.outboxEvent.findMany as jest.Mock;
      const updateMock = prisma.outboxEvent.update as jest.Mock;
      const updateManyMock = prisma.outboxEvent.updateMany as jest.Mock;

      findManyMock.mockResolvedValueOnce([mockEvent]);
      updateMock.mockResolvedValue({});

      await OutboxWorker.processPendingEvents();

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: 'evt-3' },
        data: {
          status: 'Failed',
          attempts: 5,
          lastError: expect.any(String),
          nextAttemptAt: expect.any(Date)
        }
      });
    });
  });
});
