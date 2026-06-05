import { SerializedItemId } from '../valueObjects/SerializedItemId';
import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { SerialNumber } from '../valueObjects/SerialNumber';
import { TenantId } from '../valueObjects/TenantId';
import { LocationId } from '../valueObjects/LocationId';
import { SerializedItemStatus, canTransitionTo } from '../enums/SerializedItemStatus';
import { StatusTransition } from '../valueObjects/StatusTransition';
import { ActorId } from '../valueObjects/ActorId';
import { DomainEvent } from '../events/DomainEvent';
import { SerializedItemStatusChanged } from '../events/SerialEvents';

export class SerializedItem {
  private _status: SerializedItemStatus;
  private _history: StatusTransition[] = [];
  private _domainEvents: DomainEvent[] = [];

  constructor(
    public readonly id: SerializedItemId,
    public readonly variantId: ProductVariantId,
    public readonly serialNumber: SerialNumber,
    public readonly tenantId: TenantId,
    private _locationId: LocationId,
    initialStatus: SerializedItemStatus = SerializedItemStatus.Pending
  ) {
    this._status = initialStatus;
  }

  get status(): SerializedItemStatus {
    return this._status;
  }

  get locationId(): LocationId {
    return this._locationId;
  }

  get isAvailable(): boolean {
    return this._status === SerializedItemStatus.InStock;
  }

  get history(): StatusTransition[] {
    return [...this._history];
  }

  receive(location: LocationId, actor: ActorId, purchaseOrderId: string): void {
    this.transitionTo(
      SerializedItemStatus.InStock,
      `Received against PO ${purchaseOrderId}`,
      actor,
      purchaseOrderId
    );
    this._locationId = location;
  }

  sell(saleId: string, actor: ActorId): void {
    this.transitionTo(
      SerializedItemStatus.Sold,
      `Sold — sale ${saleId}`,
      actor,
      saleId
    );
  }

  transitionTo(
    target: SerializedItemStatus,
    reason: string,
    actor: ActorId,
    referenceId?: string
  ): void {
    if (this._status === target) {
      return;
    }

    if (!canTransitionTo(this._status, target)) {
      throw new Error(`Invalid status transition from ${this._status} to ${target}`);
    }

    const oldStatus = this._status;
    this._history.push(new StatusTransition(
      oldStatus,
      target,
      reason,
      actor,
      new Date(),
      referenceId
    ));

    this._status = target;
    this._domainEvents.push(new SerializedItemStatusChanged(
      this.variantId,
      this.serialNumber,
      oldStatus,
      target
    ));
  }

  pullDomainEvents(): DomainEvent[] {
    const events = this._domainEvents;
    this._domainEvents = [];
    return events;
  }
}
