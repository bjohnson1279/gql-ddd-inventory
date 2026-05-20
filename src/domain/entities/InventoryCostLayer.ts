import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { SerialNumber } from '../valueObjects/SerialNumber';

export class InventoryCostLayerId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("InventoryCostLayerId cannot be empty.");
    }
  }

  equals(other: InventoryCostLayerId): boolean {
    return this.value === other.value;
  }
}

export class InventoryCostLayer {
  private _consumedQuantity: number = 0;

  constructor(
    public readonly id: InventoryCostLayerId,
    public readonly variantId: ProductVariantId,
    public readonly initialQuantity: number,
    public readonly unitCostCents: number,
    public readonly receivedAt: Date,
    public readonly serialNumber?: SerialNumber
  ) {
    if (initialQuantity <= 0) {
      throw new Error('Initial quantity must be positive.');
    }
    if (unitCostCents < 0) {
      throw new Error('Unit cost cannot be negative.');
    }
  }

  get consumedQuantity(): number {
    return this._consumedQuantity;
  }

  remainingQuantity(): number {
    return this.initialQuantity - this._consumedQuantity;
  }

  remainingCostCents(): number {
    return this.remainingQuantity() * this.unitCostCents;
  }

  consume(quantity: number): number {
    const toConsume = Math.min(quantity, this.remainingQuantity());
    this._consumedQuantity += toConsume;
    return toConsume;
  }

  isFullyConsumed(): boolean {
    return this.remainingQuantity() === 0;
  }
}
