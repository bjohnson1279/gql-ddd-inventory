import { DomainEvent } from './DomainEvent';

export class StockOnboardingSubmitted implements DomainEvent {
  readonly occurredAt: Date;
  constructor(
    public readonly onboardingId: string,
    public readonly locationId: string
  ) {
    this.occurredAt = new Date();
  }
}

export class OpeningBalancePosted implements DomainEvent {
  readonly occurredAt: Date;
  constructor(
    public readonly sku: string,
    public readonly quantity: number,
    public readonly onboardingId: string
  ) {
    this.occurredAt = new Date();
  }
}
