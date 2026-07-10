jest.mock('../../../src/infrastructure/persistence/prismaClient', () => ({
  prisma: {
    ledgerEntry: {
      findFirst: jest.fn()
    },
    notification: {
      create: jest.fn()
    }
  }
}));

jest.mock('../../../src/infrastructure/graphql/pubsub', () => ({
  pubsub: {
    publish: jest.fn()
  }
}));

import { InventoryReconciledHandler } from '../../../src/application/eventHandlers/InventoryReconciledHandler';
import { InventoryReconciledEvent } from '../../../src/domain/events/InventoryEvents';
import { prisma } from '../../../src/infrastructure/persistence/prismaClient';
import { pubsub } from '../../../src/infrastructure/graphql/pubsub';

describe('InventoryReconciledHandler', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should successfully handle event and publish notification', async () => {
    (prisma.ledgerEntry.findFirst as jest.Mock).mockResolvedValue({ tenantId: 'tenant-123' });
    (prisma.notification.create as jest.Mock).mockResolvedValue({});
    (pubsub.publish as jest.Mock).mockResolvedValue(undefined);

    const handler = new InventoryReconciledHandler();
    const event = new InventoryReconciledEvent('SKU-1', 'LOC-1', 10, 8, -2);
    await handler.handle(event);

    expect(consoleLogSpy).toHaveBeenCalledWith('[InventoryReconciledHandler] 📊 ACCOUNTING NOTIFIED: Variance of -2 recorded for SKU SKU-1.');
    expect(prisma.ledgerEntry.findFirst).toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(pubsub.publish).toHaveBeenCalled();
  });

  it('should log an error if notification creation or publish fails', async () => {
    const error = new Error('Database connection failed');
    (prisma.ledgerEntry.findFirst as jest.Mock).mockRejectedValue(error);

    const handler = new InventoryReconciledHandler();
    const event = new InventoryReconciledEvent('SKU-1', 'LOC-1', 10, 8, -2);
    await handler.handle(event);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[InventoryReconciledHandler] Failed to save/publish notification:', error);
  });
});
