import { DomainEvent } from '../../domain/events/OnboardingEvents';

export class DomainEventDispatcher {
  dispatch(events: DomainEvent[]): void {
    for (const event of events) {
      const eventName = event.constructor.name;
      console.log(`\n[EVENT FIRED] ${eventName} occurred at ${event.occurredAt.toISOString()}`);
      console.log(`Event Details:`, JSON.stringify(event, null, 2));
    }
  }
}
