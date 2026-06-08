import { DomainEvent } from './DomainEvent';

export class StockTransferCreated implements DomainEvent {
  readonly occurredAt: Date;
  constructor(
    public readonly transferId: string,
    public readonly tenantId: string
  ) {
    this.occurredAt = new Date();
  }
}

export class StockTransferDispatched implements DomainEvent {
  readonly occurredAt: Date;
  constructor(
    public readonly transferId: string,
    public readonly sourceLocationId: string,
    public readonly destinationLocationId: string
  ) {
    this.occurredAt = new Date();
  }
}

export class StockTransferReceived implements DomainEvent {
  readonly occurredAt: Date;
  constructor(
    public readonly transferId: string,
    public readonly destinationLocationId: string
  ) {
    this.occurredAt = new Date();
  }
}

export class StockTransferCancelled implements DomainEvent {
  readonly occurredAt: Date;
  constructor(public readonly transferId: string) {
    this.occurredAt = new Date();
  }
}
