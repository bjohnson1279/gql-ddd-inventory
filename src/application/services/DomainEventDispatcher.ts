import { DomainEvent } from '../../domain/events/OnboardingEvents';
import { IEventBus } from '../../domain/events/IEventBus';

export class DomainEventDispatcher {
  constructor(private readonly eventBus: IEventBus) {}

  dispatch(events: DomainEvent[]): void {
    for (const event of events) {
      // We still log for visibility, but now we actually publish!
      const eventName = event.constructor.name;
      console.log(`\n[EVENT FIRED] ${eventName} occurred at ${event.occurredAt.toISOString()}`);
      
      this.eventBus.publish(event);
    }
  }
}
