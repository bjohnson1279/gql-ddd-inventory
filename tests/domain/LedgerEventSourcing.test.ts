import { InMemoryLedgerRepository } from '../../src/infrastructure/persistence/InMemoryLedgerRepository';
import { LedgerEntry } from '../../src/domain/entities/LedgerEntry';
import { LedgerEntryId } from '../../src/domain/valueObjects/LedgerEntryId';
import { TenantId } from '../../src/domain/valueObjects/TenantId';
import { LocationId } from '../../src/domain/valueObjects/LocationId';
import { ProductVariantId } from '../../src/domain/valueObjects/ProductVariantId';
import { ActorId } from '../../src/domain/valueObjects/ActorId';
import { ReasonCode } from '../../src/domain/enums/ReasonCode';

describe('Ledger Event Sourcing & Temporal Playback', () => {
  const tenantId = new TenantId('T1');
  const locationId = new LocationId('LOC1');
  const variantId = new ProductVariantId('V1');
  const actor = new ActorId('U1');

  it('should play back ledger events up to a given historical timestamp', async () => {
    const repo = new InMemoryLedgerRepository();

    const t1 = new Date('2026-06-01T10:00:00Z');
    const t2 = new Date('2026-06-01T11:00:00Z');
    const t3 = new Date('2026-06-01T12:00:00Z');

    // 1. Initial Receipt: +50 items at T1
    await repo.append(
      new LedgerEntry(new LedgerEntryId('E1'), tenantId, locationId, variantId, 50, ReasonCode.OpeningBalance, actor, t1)
    );

    // 2. Dispatch / Sale: -10 items at T2
    await repo.append(
      new LedgerEntry(new LedgerEntryId('E2'), tenantId, locationId, variantId, -10, ReasonCode.Sale, actor, t2)
    );

    // 3. Receipt: +20 items at T3
    await repo.append(
      new LedgerEntry(new LedgerEntryId('E3'), tenantId, locationId, variantId, 20, ReasonCode.Restock, actor, t3)
    );

    // Query balance at time before T1 -> should be 0
    const beforeT1 = await repo.currentQuantityAt(variantId, locationId, new Date('2026-06-01T09:00:00Z'));
    expect(beforeT1).toBe(0);

    // Query balance exactly at T1 -> should be 50
    const atT1 = await repo.currentQuantityAt(variantId, locationId, t1);
    expect(atT1).toBe(50);

    // Query balance between T1 and T2 -> should be 50
    const betweenT1AndT2 = await repo.currentQuantityAt(variantId, locationId, new Date('2026-06-01T10:30:00Z'));
    expect(betweenT1AndT2).toBe(50);

    // Query balance exactly at T2 -> should be 40 (50 - 10)
    const atT2 = await repo.currentQuantityAt(variantId, locationId, t2);
    expect(atT2).toBe(40);

    // Query balance exactly at T3 -> should be 60 (40 + 20)
    const atT3 = await repo.currentQuantityAt(variantId, locationId, t3);
    expect(atT3).toBe(60);

    // Query current total balance (no date restriction) -> should be 60
    const current = await repo.currentQuantity(variantId, locationId);
    expect(current).toBe(60);
  });
});
