import { LedgerEntryId } from '../valueObjects/LedgerEntryId';
import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { ReasonCode } from '../enums/ReasonCode';
import { ActorId } from '../valueObjects/ActorId';
import { LocationId } from '../valueObjects/LocationId';
import { TenantId } from '../valueObjects/TenantId';

export class LedgerEntry {
  constructor(
    public readonly id: LedgerEntryId,
    public readonly tenantId: TenantId,
    public readonly locationId: LocationId,
    public readonly variantId: ProductVariantId,
    public readonly quantity: number, // signed
    public readonly reason: ReasonCode,
    public readonly actor: ActorId,
    public readonly occurredAt: Date,
    public readonly referenceId?: string,
    public readonly metadata?: Record<string, any>
  ) {
    if (quantity === 0) {
      throw new Error('A ledger entry quantity cannot be zero.');
    }
    if (!Number.isInteger(quantity)) {
        throw new Error('A ledger entry quantity must be an integer.');
    }
  }

  get isDeduction(): boolean {
    return this.quantity < 0;
  }
}
