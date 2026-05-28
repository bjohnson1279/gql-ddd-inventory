import { EventEmitter } from 'events';
import { IEventBus, EventHandler } from '../../domain/events/IEventBus';
import { DomainEvent } from '../../domain/events/OnboardingEvents';

export class InMemoryEventBus implements IEventBus {
  private emitter = new EventEmitter();

  publish(event: DomainEvent): void {
    const eventName = event.constructor.name;
    // We can emit asynchronously using setImmediate to avoid blocking the caller
    // since Node.js EventEmitters call listeners synchronously by default.
    setImmediate(() => {
      this.emitter.emit(eventName, event);
    });
  }

  subscribe<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void {
    this.emitter.on(eventName, async (event: T) => {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[InMemoryEventBus] Error handling event ${eventName}:`, err);
      }
    });
  }
}
