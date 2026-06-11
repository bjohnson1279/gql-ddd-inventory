import { LowStockAlertHandler } from '../../../src/application/eventHandlers/LowStockAlertHandler';
import { LowStockAlertEvent } from '../../../src/domain/events/InventoryEvents';

describe('LowStockAlertHandler', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock console.log so we don't clutter the test output
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original console.log
    consoleSpy.mockRestore();
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
});
