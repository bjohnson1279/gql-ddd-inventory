import { PrismaClient, Prisma } from '@prisma/client';
import { IStockTransferRepository } from '../../domain/repositories/IStockTransferRepository';
import { StockTransfer } from '../../domain/entities/StockTransfer';
import { StockTransferId } from '../../domain/valueObjects/StockTransferId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { StockTransferItem } from '../../domain/valueObjects/StockTransferItem';
import { StockTransferStatus } from '../../domain/enums/StockTransferStatus';
import { toUuid } from '../utils/uuid';


export class PostgresStockTransferRepository implements IStockTransferRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: StockTransferId): Promise<StockTransfer | null> {
    const dbId = toUuid(id.value);
    const model = await this.prisma.stockTransfer.findUnique({
      where: { id: dbId },
      include: {
        items: true,
      },
    });

    if (!model) return null;

    const items = model.items.map(
      (item) => new StockTransferItem(new ProductVariantId(item.variantId), item.quantity)
    );

    return StockTransfer.reconstruct(
      new StockTransferId(model.id),
      new TenantId(model.tenantId),
      new LocationId(model.sourceLocationId),
      new LocationId(model.destinationLocationId),
      items,
      model.status as StockTransferStatus,
      model.referenceId,
      model.dispatchedAt,
      model.receivedAt,
      model.createdAt
    );
  }

  async findAllByTenant(tenantId: TenantId): Promise<StockTransfer[]> {
    const models = await this.prisma.stockTransfer.findMany({
      where: { tenantId: tenantId.value },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return models.map((model) => {
      const items = model.items.map(
        (item) => new StockTransferItem(new ProductVariantId(item.variantId), item.quantity)
      );

      return StockTransfer.reconstruct(
        new StockTransferId(model.id),
        new TenantId(model.tenantId),
        new LocationId(model.sourceLocationId),
        new LocationId(model.destinationLocationId),
        items,
        model.status as StockTransferStatus,
        model.referenceId,
        model.dispatchedAt,
        model.receivedAt,
        model.createdAt
      );
    });
  }

  async saveBatch(transfers: StockTransfer[]): Promise<void> {
    if (transfers.length === 0) return;

    // Deduplicate transfers, keeping the last occurrence of each ID to avoid race conditions
    const uniqueTransfersMap = new Map<string, StockTransfer>();
    for (const transfer of transfers) {
      uniqueTransfersMap.set(transfer.id.value, transfer);
    }
    const uniqueTransfers = Array.from(uniqueTransfersMap.values());

    const values = uniqueTransfers.map((t) => Prisma.sql`(${Prisma.join([
      toUuid(t.id.value),
      t.tenantId.value,
      t.sourceLocationId.value,
      t.destinationLocationId.value,
      t.status,
      t.referenceId,
      t.dispatchedAt,
      t.receivedAt,
      t.createdAt
    ])})`);

    await this.prisma.$transaction(async (tx) => {
      if (values.length > 0) {
        await tx.$executeRaw`
          INSERT INTO "StockTransfer" ("id", "tenant_id", "source_location_id", "destination_location_id", "status", "reference_id", "dispatched_at", "received_at", "created_at")
          VALUES ${Prisma.join(values)}
          ON CONFLICT ("id") DO UPDATE SET
            "status" = EXCLUDED."status",
            "dispatched_at" = EXCLUDED."dispatched_at",
            "received_at" = EXCLUDED."received_at"
        `;
      }

      const dbIds = uniqueTransfers.map(t => toUuid(t.id.value));
      await tx.stockTransferItem.deleteMany({
        where: { transferId: { in: dbIds } },
      });

      const allItems: any[] = [];
      for (const t of uniqueTransfers) {
        for (const item of t.items) {
          allItems.push({
            transferId: toUuid(t.id.value),
            variantId: toUuid(item.variantId.value),
            quantity: item.quantity,
          });
        }
      }

      if (allItems.length > 0) {
        await tx.stockTransferItem.createMany({
          data: allItems,
        });
      }
    });
  }

  async save(transfer: StockTransfer): Promise<void> {
    const dbId = toUuid(transfer.id.value);

    await this.prisma.$transaction(async (tx) => {
      await tx.stockTransfer.upsert({
        where: { id: dbId },
        create: {
          id: dbId,
          tenantId: transfer.tenantId.value,
          sourceLocationId: transfer.sourceLocationId.value,
          destinationLocationId: transfer.destinationLocationId.value,
          status: transfer.status,
          referenceId: transfer.referenceId,
          dispatchedAt: transfer.dispatchedAt,
          receivedAt: transfer.receivedAt,
          createdAt: transfer.createdAt,
        },
        update: {
          status: transfer.status,
          dispatchedAt: transfer.dispatchedAt,
          receivedAt: transfer.receivedAt,
        },
      });

      await tx.stockTransferItem.deleteMany({
        where: { transferId: dbId },
      });

      if (transfer.items.length > 0) {
        await tx.stockTransferItem.createMany({
          data: transfer.items.map((item) => ({
            transferId: dbId,
            variantId: toUuid(item.variantId.value),
            quantity: item.quantity,
          })),
        });
      }
    });
  }
}
