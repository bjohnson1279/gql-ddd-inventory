import { DomainEvent } from './OnboardingEvents';
import { ProductVariantId } from '../valueObjects/ProductVariantId';

export class InventoryDecremented implements DomainEvent {
  readonly occurredAt: Date;
  constructor(
    public readonly tenantId: string,
    public readonly locationId: string,
    public readonly variantId: ProductVariantId,
    public readonly quantity: number,
    public readonly referenceId: string
  ) {
    this.occurredAt = new Date();
  }
}

export class LowStockAlertEvent implements DomainEvent {
  readonly occurredAt: Date;
  constructor(
    public readonly sku: string,
    public readonly locationId: string,
    public readonly currentQuantity: number
  ) {
    this.occurredAt = new Date();
  }
}

export class InventoryReconciledEvent implements DomainEvent {
  readonly occurredAt: Date;
  constructor(
    public readonly sku: string,
    public readonly locationId: string,
    public readonly expected: number,
    public readonly actual: number,
    public readonly variance: number
  ) {
    this.occurredAt = new Date();
  }
}
