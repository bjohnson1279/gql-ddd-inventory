import { Sku } from '../valueObjects/Sku';
import { Quantity } from '../valueObjects/Quantity';
import { InsufficientStockError } from '../exceptions/DomainErrors';

export class InventoryItem {
  private readonly _id: string; // The aggregate root ID
  private readonly _sku: Sku;
  private _quantity: Quantity;

  constructor(id: string, sku: Sku, initialQuantity: Quantity) {
    this._id = id;
    this._sku = sku;
    this._quantity = initialQuantity;
  }

  get id(): string {
    return this._id;
  }

  get sku(): Sku {
    return this._sku;
  }

  get quantity(): Quantity {
    return this._quantity;
  }

  // Domain behaviors
  receiveStock(amount: Quantity): void {
    this._quantity = this._quantity.add(amount);
  }

  dispatchStock(amount: Quantity): void {
    if (this._quantity.value < amount.value) {
      throw new InsufficientStockError(this._sku.value, amount.value, this._quantity.value);
    }
    this._quantity = this._quantity.subtract(amount);
  }

  reconcileStock(actualQuantity: Quantity): { expected: number; actual: number; variance: number } {
    const expected = this._quantity.value;
    const actual = actualQuantity.value;
    const variance = actual - expected;
    
    this._quantity = actualQuantity;
    
    // In a real event-driven system, we might publish an InventoryReconciledEvent here
    return { expected, actual, variance };
  }

  // Factory method for creating a new item
  static createNew(id: string, sku: string): InventoryItem {
    return new InventoryItem(id, new Sku(sku), new Quantity(0));
  }
}
