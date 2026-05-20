import { DomainEvent } from './OnboardingEvents';

export class BarcodeAssigned implements DomainEvent {
  readonly occurredAt: Date;
  constructor(
    public readonly sku: string,
    public readonly barcode: string
  ) {
    this.occurredAt = new Date();
  }
}

export class BarcodeRevoked implements DomainEvent {
  readonly occurredAt: Date;
  constructor(
    public readonly sku: string,
    public readonly barcode: string
  ) {
    this.occurredAt = new Date();
  }
}
