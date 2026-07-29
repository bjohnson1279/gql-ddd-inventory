jest.mock('../../../src/infrastructure/persistence/prismaClient', () => ({
  prisma: {
    ledgerEntry: {
      findFirst: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' })
    },
    notification: {
      create: jest.fn().mockResolvedValue({})
    }
  }
}));

jest.mock('../../../src/infrastructure/graphql/pubsub', () => ({
  pubsub: {
    publish: jest.fn().mockResolvedValue({})
  }
}));

import { LowStockAlertHandler } from '../../../src/application/eventHandlers/LowStockAlertHandler';
import { LowStockAlertEvent } from '../../../src/domain/events/InventoryEvents';
import { prisma } from '../../../src/infrastructure/persistence/prismaClient';
import { pubsub } from '../../../src/infrastructure/graphql/pubsub';

describe('LowStockAlertHandler', () => {
  let consoleSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock console.log so we don't clutter the test output
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original console.log and error
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('should log a low stock alert with correct details', async () => {
    const handler = new LowStockAlertHandler();
    const event = new LowStockAlertEvent('SKU-123', 'LOC-A', 5);

    await handler.handle(event);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[LowStockAlertHandler] 🚨 ALERT: SKU SKU-123 at location LOC-A dropped to 5 items!'
    );
  });

  it('should log a low stock alert when quantity reaches zero', async () => {
    const handler = new LowStockAlertHandler();
    const event = new LowStockAlertEvent('SKU-456', 'LOC-B', 0);

    await handler.handle(event);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[LowStockAlertHandler] 🚨 ALERT: SKU SKU-456 at location LOC-B dropped to 0 items!'
    );
  });

  it('should safely catch and log errors if saving the notification fails', async () => {
    const mockError = new Error('Database connection failed');
    (prisma.notification.create as jest.Mock).mockRejectedValueOnce(mockError);

    const handler = new LowStockAlertHandler();
    const event = new LowStockAlertEvent('SKU-ERR', 'LOC-ERR', 1);

    await handler.handle(event);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LowStockAlertHandler] Failed to save/publish notification:',
      mockError
    );
  });

  it('should safely catch and log errors if publishing the notification fails', async () => {
    const mockError = new Error('PubSub connection failed');
    (pubsub.publish as jest.Mock).mockRejectedValueOnce(mockError);

    const handler = new LowStockAlertHandler();
    const event = new LowStockAlertEvent('SKU-ERR', 'LOC-ERR', 1);

    await handler.handle(event);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LowStockAlertHandler] Failed to save/publish notification:',
      mockError
    );
  });

  it('should use default tenant-1 if ledgerEntry is not found', async () => {
    (prisma.ledgerEntry.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const handler = new LowStockAlertHandler();
    const event = new LowStockAlertEvent('SKU-NO-LEDGER', 'LOC-X', 2);

    await handler.handle(event);

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          message: 'SKU SKU-NO-LEDGER at location LOC-X dropped to 2 items!',
        })
      })
    );
  });
});
