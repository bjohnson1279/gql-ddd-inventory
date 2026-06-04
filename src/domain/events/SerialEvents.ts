import { DomainEvent } from './DomainEvent';
import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { SerialNumber } from '../valueObjects/SerialNumber';
import { SerializedItemStatus } from '../enums/SerializedItemStatus';

export class SerializedItemReceived implements DomainEvent {
  readonly occurredAt: Date;
  constructor(
    public readonly variantId: ProductVariantId,
    public readonly serialNumber: SerialNumber,
    public readonly locationId: string,
    public readonly referenceId: string
  ) {
    this.occurredAt = new Date();
  }
}

export class SerializedItemSold implements DomainEvent {
  readonly occurredAt: Date;
  constructor(
    public readonly variantId: ProductVariantId,
    public readonly serialNumber: SerialNumber,
    public readonly saleId: string
  ) {
    this.occurredAt = new Date();
  }
}

export class SerializedItemStatusChanged implements DomainEvent {
  readonly occurredAt: Date;
  constructor(
    public readonly variantId: ProductVariantId,
    public readonly serialNumber: SerialNumber,
    public readonly oldStatus: SerializedItemStatus,
    public readonly newStatus: SerializedItemStatus
  ) {
    this.occurredAt = new Date();
  }
}
