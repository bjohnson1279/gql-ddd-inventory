import { PrismaClient } from '@prisma/client';
import { IStockTransferRepository } from '../../domain/repositories/IStockTransferRepository';
import { StockTransfer } from '../../domain/entities/StockTransfer';
import { StockTransferId } from '../../domain/valueObjects/StockTransferId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { StockTransferItem } from '../../domain/valueObjects/StockTransferItem';
import { StockTransferStatus } from '../../domain/enums/StockTransferStatus';
import * as crypto from 'crypto';

function toUuid(id: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id.toLowerCase();
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

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

    await this.prisma.$transaction(async (tx) => {
      for (const transfer of transfers) {
        const dbId = toUuid(transfer.id.value);
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
