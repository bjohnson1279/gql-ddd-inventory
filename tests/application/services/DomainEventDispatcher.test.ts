import { DomainEventDispatcher } from '../../../src/application/services/DomainEventDispatcher';
import { DomainEvent } from '../../../src/domain/events/DomainEvent';
import { IEventBus, EventHandler } from '../../../src/domain/events/IEventBus';

class MockEvent implements DomainEvent {
  occurredAt: Date = new Date();
  constructor(public readonly id: string) {}
}

class MockEventBus implements IEventBus {
  publish = jest.fn();
  subscribe = jest.fn();
}

describe('DomainEventDispatcher', () => {
  let eventBus: MockEventBus;
  let dispatcher: DomainEventDispatcher;

  beforeEach(() => {
    // Suppress console.log output during tests to keep output clean
    jest.spyOn(console, 'log').mockImplementation(() => {});

    eventBus = new MockEventBus();
    dispatcher = new DomainEventDispatcher(eventBus);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should publish all events in the array', () => {
    const events: DomainEvent[] = [
      new MockEvent('event-1'),
      new MockEvent('event-2'),
    ];

    dispatcher.dispatch(events);

    expect(eventBus.publish).toHaveBeenCalledTimes(2);
    expect(eventBus.publish).toHaveBeenNthCalledWith(1, events[0]);
    expect(eventBus.publish).toHaveBeenNthCalledWith(2, events[1]);
  });

  it('should do nothing if events array is empty', () => {
    dispatcher.dispatch([]);

    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});
