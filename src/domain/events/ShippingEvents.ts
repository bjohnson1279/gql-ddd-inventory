import { DomainEvent } from './DomainEvent';

export class ShipmentCreatedEvent implements DomainEvent {
  readonly occurredAt: Date;
  constructor(
    public readonly shipmentId: string,
    public readonly sku: string,
    public readonly quantity: number,
    public readonly carrier: string,
    public readonly trackingNumber: string | null,
    public readonly rateCents: number
  ) {
    this.occurredAt = new Date();
  }
}

export class ShipmentStatusUpdatedEvent implements DomainEvent {
  readonly occurredAt: Date;
  constructor(
    public readonly shipmentId: string,
    public readonly trackingNumber: string | null,
    public readonly oldStatus: string,
    public readonly newStatus: string
  ) {
    this.occurredAt = new Date();
  }
}
