import { PrismaClient } from '@prisma/client';
import { ILedgerRepository } from '../../domain/repositories/ILedgerRepository';
import { LedgerEntry } from '../../domain/entities/LedgerEntry';
import { LedgerEntryId } from '../../domain/valueObjects/LedgerEntryId';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { ActorId } from '../../domain/valueObjects/ActorId';
import { ReasonCode } from '../../domain/enums/ReasonCode';

export class PostgresLedgerRepository implements ILedgerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async append(entry: LedgerEntry): Promise<void> {
    await this.prisma.ledgerEntry.create({
      data: {
        id: entry.id.value,
        tenantId: entry.tenantId.value,
        locationId: entry.locationId.value,
        variantId: entry.variantId.value,
        quantity: entry.quantity,
        reason: entry.reason,
        actorId: entry.actor.value,
        occurredAt: entry.occurredAt,
        referenceId: entry.referenceId || null,
        metadata: entry.metadata || undefined,
      },
    });
  }

  async appendBatch(entries: LedgerEntry[]): Promise<void> {
    if (entries.length === 0) return;

    await this.prisma.ledgerEntry.createMany({
      data: entries.map(entry => ({
        id: entry.id.value,
        tenantId: entry.tenantId.value,
        locationId: entry.locationId.value,
        variantId: entry.variantId.value,
        quantity: entry.quantity,
        reason: entry.reason,
        actorId: entry.actor.value,
        occurredAt: entry.occurredAt,
        referenceId: entry.referenceId || null,
        metadata: entry.metadata || undefined,
      })),
    });
  }

  async currentQuantity(variantId: ProductVariantId, locationId: LocationId): Promise<number> {
    const result = await this.prisma.ledgerEntry.aggregate({
      where: {
        variantId: variantId.value,
        locationId: locationId.value,
      },
      _sum: {
        quantity: true,
      },
    });

    return result._sum.quantity || 0;
  }

  async entriesFor(variantId: ProductVariantId, locationId: LocationId): Promise<LedgerEntry[]> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        variantId: variantId.value,
        locationId: locationId.value,
      },
      orderBy: {
        occurredAt: 'asc',
      },
    });

    return entries.map(
      (e) =>
        new LedgerEntry(
          new LedgerEntryId(e.id),
          new TenantId(e.tenantId),
          new LocationId(e.locationId),
          new ProductVariantId(e.variantId),
          e.quantity,
          e.reason as ReasonCode,
          new ActorId(e.actorId),
          e.occurredAt,
          e.referenceId || undefined,
          (e.metadata as Record<string, any>) || undefined
        )
    );
  }

  async hasAnyEntries(variantId: ProductVariantId, locationId: LocationId): Promise<boolean> {
    const count = await this.prisma.ledgerEntry.count({
      where: {
        variantId: variantId.value,
        locationId: locationId.value,
      },
    });

    return count > 0;
  }
}
