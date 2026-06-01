import { PostgresInventoryRepository } from '../../../src/infrastructure/persistence/PostgresInventoryRepository';
import { InventoryItem } from '../../../src/domain/entities/InventoryItem';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { Quantity } from '../../../src/domain/valueObjects/Quantity';
import { deserializeEvent } from '../../../src/infrastructure/workers/OutboxWorker';
import { InventoryReconciledEvent } from '../../../src/domain/events/InventoryEvents';
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
    },
  };
  return {
    prisma: {
      inventoryItem: {
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      outboxEvent: {
        create: createMock,
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
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

  it('should write to outbox during repository save', async () => {
    const repo = new PostgresInventoryRepository(prisma as any);
    const item = InventoryItem.createNew('id-1', 'SKU-OUTBOX', 'LOC-OUTBOX');

    // Add domain event
    item.reconcileStock(new Quantity(10));

    const outboxCreateMock = prisma.outboxEvent.create as jest.Mock;
    outboxCreateMock.mockClear();

    const findUniqueMock = prisma.inventoryItem.findUnique as jest.Mock;
    findUniqueMock.mockResolvedValue(null);

    await repo.save(item);

    expect(outboxCreateMock).toHaveBeenCalled();
    const arg = outboxCreateMock.mock.calls[0][0];
    expect(arg.data.eventType).toBe('InventoryReconciledEvent');
    expect(JSON.parse(arg.data.payload).sku).toBe('SKU-OUTBOX');
  });
});
