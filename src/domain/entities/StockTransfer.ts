import { StockTransferId } from '../valueObjects/StockTransferId';
import { TenantId } from '../valueObjects/TenantId';
import { LocationId } from '../valueObjects/LocationId';
import { StockTransferStatus } from '../enums/StockTransferStatus';
import { StockTransferItem } from '../valueObjects/StockTransferItem';
import { DomainEvent } from '../events/DomainEvent';
import {
  StockTransferCreated,
  StockTransferDispatched,
  StockTransferReceived,
  StockTransferCancelled
} from '../events/StockTransferEvents';

export class StockTransfer {
  private _status: StockTransferStatus;
  private _dispatchedAt: Date | null = null;
  private _receivedAt: Date | null = null;
  private _domainEvents: DomainEvent[] = [];

  constructor(
    public readonly id: StockTransferId,
    public readonly tenantId: TenantId,
    public readonly sourceLocationId: LocationId,
    public readonly destinationLocationId: LocationId,
    public readonly items: StockTransferItem[],
    public readonly referenceId: string | null = null,
    public readonly createdAt: Date = new Date()
  ) {
    if (sourceLocationId.equals(destinationLocationId)) {
      throw new Error('Source and destination locations cannot be the same.');
    }
    if (items.length === 0) {
      throw new Error('Stock transfer must contain at least one item.');
    }
    this._status = StockTransferStatus.Draft;
  }

  get status(): StockTransferStatus {
    return this._status;
  }

  get dispatchedAt(): Date | null {
    return this._dispatchedAt;
  }

  get receivedAt(): Date | null {
    return this._receivedAt;
  }

  dispatch(): void {
    if (this._status !== StockTransferStatus.Draft) {
      throw new Error(`Cannot dispatch a stock transfer in status: ${this._status}`);
    }
    this._status = StockTransferStatus.Dispatched;
    this._dispatchedAt = new Date();
    this._domainEvents.push(
      new StockTransferDispatched(this.id.value, this.sourceLocationId.value, this.destinationLocationId.value)
    );
  }

  receive(): void {
    if (this._status !== StockTransferStatus.Dispatched) {
      throw new Error(`Cannot receive a stock transfer in status: ${this._status}`);
    }
    this._status = StockTransferStatus.Received;
    this._receivedAt = new Date();
    this._domainEvents.push(new StockTransferReceived(this.id.value, this.destinationLocationId.value));
  }

  cancel(): void {
    if (this._status === StockTransferStatus.Received || this._status === StockTransferStatus.Cancelled) {
      throw new Error(`Cannot cancel a stock transfer in status: ${this._status}`);
    }
    this._status = StockTransferStatus.Cancelled;
    this._domainEvents.push(new StockTransferCancelled(this.id.value));
  }

  pullDomainEvents(): DomainEvent[] {
    const events = this._domainEvents;
    this._domainEvents = [];
    return events;
  }

  static reconstruct(
    id: StockTransferId,
    tenantId: TenantId,
    sourceLocationId: LocationId,
    destinationLocationId: LocationId,
    items: StockTransferItem[],
    status: StockTransferStatus,
    referenceId: string | null,
    dispatchedAt: Date | null,
    receivedAt: Date | null,
    createdAt: Date
  ): StockTransfer {
    const transfer = new StockTransfer(id, tenantId, sourceLocationId, destinationLocationId, items, referenceId, createdAt);
    transfer._status = status;
    transfer._dispatchedAt = dispatchedAt;
    transfer._receivedAt = receivedAt;
    return transfer;
  }

  static createNew(
    id: StockTransferId,
    tenantId: TenantId,
    sourceLocationId: LocationId,
    destinationLocationId: LocationId,
    items: StockTransferItem[],
    referenceId: string | null = null
  ): StockTransfer {
    const transfer = new StockTransfer(id, tenantId, sourceLocationId, destinationLocationId, items, referenceId);
    transfer._domainEvents.push(new StockTransferCreated(id.value, tenantId.value));
    return transfer;
  }
}
