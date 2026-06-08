import { Sku } from '../valueObjects/Sku';
import { Quantity } from '../valueObjects/Quantity';
import { LocationId } from '../valueObjects/LocationId';
import { InsufficientStockError, InsufficientAvailableStockError } from '../exceptions/DomainErrors';
import { DomainEvent } from '../events/DomainEvent';
import { LowStockAlertEvent, InventoryReconciledEvent } from '../events/InventoryEvents';

export class InventoryItem {
  private readonly _id: string; // The aggregate root ID
  private readonly _sku: Sku;
  private readonly _locationId: LocationId;
  private _quantity: Quantity; // Physical On Hand
  private _allocated: Quantity; // Reserved
  private _inTransit: Quantity; // Incoming
  private _version: number;
  private _domainEvents: DomainEvent[] = [];

  constructor(
    id: string,
    sku: Sku,
    locationId: LocationId,
    initialQuantity: Quantity,
    allocated: Quantity = new Quantity(0),
    inTransit: Quantity = new Quantity(0),
    initialVersion: number = 1
  ) {
    this._id = id;
    this._sku = sku;
    this._locationId = locationId;
    this._quantity = initialQuantity;
    this._allocated = allocated;
    this._inTransit = inTransit;
    this._version = initialVersion;
  }

  get id(): string {
    return this._id;
  }

  get sku(): Sku {
    return this._sku;
  }

  get locationId(): LocationId {
    return this._locationId;
  }

  get quantity(): Quantity {
    return this._quantity;
  }

  get allocated(): Quantity {
    return this._allocated;
  }

  get inTransit(): Quantity {
    return this._inTransit;
  }

  get available(): Quantity {
    const val = this._quantity.value - this._allocated.value + this._inTransit.value;
    return new Quantity(val < 0 ? 0 : val);
  }

  get version(): number {
    return this._version;
  }

  private incrementVersion(): void {
    this._version += 1;
  }

  // Domain behaviors
  receiveStock(amount: Quantity): void {
    this._quantity = this._quantity.add(amount);
    this.incrementVersion();
  }

  dispatchStock(amount: Quantity): void {
    if (this._quantity.value < amount.value) {
      throw new InsufficientStockError(this._sku.value, amount.value, this._quantity.value);
    }
    this._quantity = this._quantity.subtract(amount);
    this.incrementVersion();

    if (this._quantity.value < 10) {
      this._domainEvents.push(
        new LowStockAlertEvent(this._sku.value, this._locationId.value, this._quantity.value)
      );
    }
  }

  allocateStock(amount: Quantity): void {
    if (this.available.value < amount.value) {
      throw new InsufficientAvailableStockError(this._sku.value, amount.value, this.available.value);
    }
    this._allocated = this._allocated.add(amount);
    this.incrementVersion();
  }

  releaseAllocation(amount: Quantity): void {
    if (this._allocated.value < amount.value) {
      throw new Error(`Cannot release allocation of ${amount.value} because only ${this._allocated.value} is allocated.`);
    }
    this._allocated = this._allocated.subtract(amount);
    this.incrementVersion();
  }

  fulfillAllocation(amount: Quantity): void {
    if (this._allocated.value < amount.value) {
      throw new Error(`Cannot fulfill allocation of ${amount.value} because only ${this._allocated.value} is allocated.`);
    }
    if (this._quantity.value < amount.value) {
      throw new InsufficientStockError(this._sku.value, amount.value, this._quantity.value);
    }
    this._allocated = this._allocated.subtract(amount);
    this._quantity = this._quantity.subtract(amount);
    this.incrementVersion();
  }

  createInTransit(amount: Quantity): void {
    this._inTransit = this._inTransit.add(amount);
    this.incrementVersion();
  }

  receiveInTransit(amount: Quantity): void {
    if (this._inTransit.value < amount.value) {
      throw new Error(`Cannot receive in transit of ${amount.value} because only ${this._inTransit.value} is in transit.`);
    }
    this._inTransit = this._inTransit.subtract(amount);
    this._quantity = this._quantity.add(amount);
    this.incrementVersion();
  }

  cancelInTransit(amount: Quantity): void {
    if (this._inTransit.value < amount.value) {
      throw new Error(`Cannot cancel in transit of ${amount.value} because only ${this._inTransit.value} is in transit.`);
    }
    this._inTransit = this._inTransit.subtract(amount);
    this.incrementVersion();
  }

  reconcileStock(actualQuantity: Quantity): { expected: number; actual: number; variance: number } {
    const expected = this._quantity.value;
    const actual = actualQuantity.value;
    const variance = actual - expected;
    
    this._quantity = actualQuantity;
    this.incrementVersion();
    
    this._domainEvents.push(
      new InventoryReconciledEvent(this._sku.value, this._locationId.value, expected, actual, variance)
    );
    
    return { expected, actual, variance };
  }

  pullDomainEvents(): DomainEvent[] {
    const events = this._domainEvents;
    this._domainEvents = [];
    return events;
  }

  // Factory method for creating a new item
  static createNew(id: string, sku: string, locationId: string): InventoryItem {
    return new InventoryItem(
      id,
      new Sku(sku),
      new LocationId(locationId),
      new Quantity(0),
      new Quantity(0),
      new Quantity(0),
      1
    );
  }
}
