import { DomainEvent } from './OnboardingEvents';
import { ProductVariantId } from '../valueObjects/ProductVariantId';

export class InventoryDecremented implements DomainEvent {
  readonly occurredAt: Date;
  constructor(
    public readonly variantId: ProductVariantId,
    public readonly quantity: number,
    public readonly referenceId: string
  ) {
    this.occurredAt = new Date();
  }
}
