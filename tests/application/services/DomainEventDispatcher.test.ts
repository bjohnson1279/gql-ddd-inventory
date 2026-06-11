import { DomainEventDispatcher } from '../../../src/application/services/DomainEventDispatcher';
import { DomainEvent } from '../../../src/domain/events/DomainEvent';
import { IEventBus } from '../../../src/domain/events/IEventBus';

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

  it('should dispatch events correctly using a mock event bus and mock events as explicitly requested', () => {
    const localMockEventBus: IEventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };
    const localDispatcher = new DomainEventDispatcher(localMockEventBus);

    class LocalMockEvent implements DomainEvent {
      occurredAt = new Date();
      constructor(public id: string) {}
    }

    const localMockEvent1 = new LocalMockEvent('1');
    const localMockEvent2 = new LocalMockEvent('2');

    localDispatcher.dispatch([localMockEvent1, localMockEvent2]);

    expect(localMockEventBus.publish).toHaveBeenCalledTimes(2);
    expect(localMockEventBus.publish).toHaveBeenCalledWith(localMockEvent1);
    expect(localMockEventBus.publish).toHaveBeenCalledWith(localMockEvent2);
  });
});
