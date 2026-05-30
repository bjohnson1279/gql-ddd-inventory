import { PrismaClient } from '@prisma/client';
import { ISerializedItemRepository } from '../../domain/repositories/ISerializedItemRepository';
import { SerializedItem } from '../../domain/entities/SerializedItem';
import { SerializedItemId } from '../../domain/valueObjects/SerializedItemId';
import { SerialNumber } from '../../domain/valueObjects/SerialNumber';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { SerializedItemStatus } from '../../domain/enums/SerializedItemStatus';
import { StatusTransition } from '../../domain/valueObjects/StatusTransition';
import { ActorId } from '../../domain/valueObjects/ActorId';

export class PostgresSerializedItemRepository implements ISerializedItemRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(item: SerializedItem): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // 1. Upsert serialized item
      await tx.serializedItem.upsert({
        where: { id: item.id.value },
        create: {
          id: item.id.value,
          variantId: item.variantId.value,
          serialNumber: item.serialNumber.value,
          tenantId: item.tenantId.value,
          locationId: item.locationId.value,
          status: item.status,
        },
        update: {
          locationId: item.locationId.value,
          status: item.status,
        },
      });

      // 2. Re-write history transitions
      await tx.serializedItemHistory.deleteMany({
        where: { itemId: item.id.value },
      });

      if (item.history.length > 0) {
        await tx.serializedItemHistory.createMany({
          data: item.history.map((h) => ({
            itemId: item.id.value,
            fromStatus: h.from,
            toStatus: h.to,
            reason: h.reason,
            actorId: h.actor.value,
            occurredAt: h.occurredAt,
            referenceId: h.referenceId || null,
          })),
        });
      }
    });
  }

  async findBySerial(serialNumber: SerialNumber, tenantId: TenantId): Promise<SerializedItem | null> {
    const model = await this.prisma.serializedItem.findFirst({
      where: {
        serialNumber: serialNumber.value,
        tenantId: tenantId.value,
      },
      include: {
        history: {
          orderBy: { occurredAt: 'asc' },
        },
      },
    });

    if (!model) return null;

    const item = new SerializedItem(
      new SerializedItemId(model.id),
      new ProductVariantId(model.variantId),
      new SerialNumber(model.serialNumber),
      new TenantId(model.tenantId),
      new LocationId(model.locationId),
      model.status as SerializedItemStatus
    );

    // Reconstitute history
    (item as any)._history = model.history.map(
      (h) =>
        new StatusTransition(
          h.fromStatus as SerializedItemStatus,
          h.toStatus as SerializedItemStatus,
          h.reason || '',
          new ActorId(h.actorId),
          h.occurredAt,
          h.referenceId || undefined
        )
    );

    return item;
  }

  async isRegistered(serialNumber: SerialNumber, tenantId: TenantId): Promise<boolean> {
    const count = await this.prisma.serializedItem.count({
      where: {
        serialNumber: serialNumber.value,
        tenantId: tenantId.value,
      },
    });

    return count > 0;
  }

  async countByStatus(variantId: ProductVariantId, status: SerializedItemStatus): Promise<number> {
    return await this.prisma.serializedItem.count({
      where: {
        variantId: variantId.value,
        status: status,
      },
    });
  }
}
