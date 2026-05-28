import { DomainEvent } from './OnboardingEvents';

export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void> | void;

export interface IEventBus {
  publish(event: DomainEvent): void;
  subscribe<T extends DomainEvent>(eventName: string, handler: EventHandler<T>): void;
}
