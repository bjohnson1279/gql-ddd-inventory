import { InMemoryEventBus } from '../../../src/infrastructure/messaging/InMemoryEventBus';
import { DomainEvent } from '../../../src/domain/events/DomainEvent';

class TestEvent implements DomainEvent {
  occurredAt: Date = new Date();
  constructor(public data: string) {}
}

describe('InMemoryEventBus', () => {
  it('should catch and log errors thrown by subscribers', (done) => {
    const bus = new InMemoryEventBus();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const testError = new Error('Test error');

    bus.subscribe<TestEvent>('TestEvent', async (event) => {
      throw testError;
    });

    bus.publish(new TestEvent('test data'));

    // Because setImmediate is used in publish, we must wait for it.
    setImmediate(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `[InMemoryEventBus] Error handling event TestEvent:`,
        testError
      );
      consoleErrorSpy.mockRestore();
      done();
    });
  });

  it('should test InMemoryEventBus publish error handling with a dummy handler', (done) => {
    const bus = new InMemoryEventBus();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const testError = new Error('Publish error');

    // dummy handler that throws
    bus.subscribe<TestEvent>('TestEvent', async (event) => {
      throw testError;
    });

    bus.publish(new TestEvent('test data 2'));

    setImmediate(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `[InMemoryEventBus] Error handling event TestEvent:`,
        testError
      );
      consoleErrorSpy.mockRestore();
      done();
    });
  });
});
