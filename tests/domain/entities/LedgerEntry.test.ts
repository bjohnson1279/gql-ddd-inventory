import { LedgerEntry } from '../../../src/domain/entities/LedgerEntry';
import { LedgerEntryId } from '../../../src/domain/valueObjects/LedgerEntryId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { ProductVariantId } from '../../../src/domain/valueObjects/ProductVariantId';
import { ReasonCode } from '../../../src/domain/enums/ReasonCode';
import { ActorId } from '../../../src/domain/valueObjects/ActorId';

describe('LedgerEntry', () => {
  const id = new LedgerEntryId('entry-1');
  const tenantId = new TenantId('tenant-1');
  const locationId = new LocationId('loc-1');
  const variantId = new ProductVariantId('var-1');
  const actor = new ActorId('actor-1');
  const occurredAt = new Date('2023-01-01T00:00:00Z');

  it('should create a LedgerEntry with required fields and compute isDeduction correctly', () => {
    const entry = new LedgerEntry(
      id,
      tenantId,
      locationId,
      variantId,
      10,
      ReasonCode.Restock,
      actor,
      occurredAt
    );

    expect(entry.id).toBe(id);
    expect(entry.tenantId).toBe(tenantId);
    expect(entry.locationId).toBe(locationId);
    expect(entry.variantId).toBe(variantId);
    expect(entry.quantity).toBe(10);
    expect(entry.reason).toBe(ReasonCode.Restock);
    expect(entry.actor).toBe(actor);
    expect(entry.occurredAt).toBe(occurredAt);
    expect(entry.referenceId).toBeUndefined();
    expect(entry.metadata).toBeUndefined();
    expect(entry.isDeduction).toBe(false);
  });

  it('should create a LedgerEntry with optional referenceId and metadata', () => {
    const metadata = { orderId: 'ord-123' };
    const entry = new LedgerEntry(
      id,
      tenantId,
      locationId,
      variantId,
      -5,
      ReasonCode.Sale,
      actor,
      occurredAt,
      'ref-123',
      metadata
    );

    expect(entry.quantity).toBe(-5);
    expect(entry.referenceId).toBe('ref-123');
    expect(entry.metadata).toEqual(metadata);
    expect(entry.isDeduction).toBe(true);
  });

  it('should throw an error if quantity is zero', () => {
    expect(() => {
      new LedgerEntry(
        id,
        tenantId,
        locationId,
        variantId,
        0,
        ReasonCode.CountAdjustment,
        actor,
        occurredAt
      );
    }).toThrow('A ledger entry quantity cannot be zero.');
  });

  it('should throw an error if quantity is not an integer', () => {
    expect(() => {
      new LedgerEntry(
        id,
        tenantId,
        locationId,
        variantId,
        2.5,
        ReasonCode.CountAdjustment,
        actor,
        occurredAt
      );
    }).toThrow('A ledger entry quantity must be an integer.');
  });
});
