import { PrismaClient, QuarantineItem as PrismaQuarantineItem } from '@prisma/client';
import { IQuarantineRepository } from '../../domain/repositories/IQuarantineRepository';
import { QuarantineItem } from '../../domain/entities/QuarantineItem';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { QuarantineStatus } from '../../domain/enums/ReturnEnums';
import { toUuid } from '../utils/uuid';


export class PostgresQuarantineRepository implements IQuarantineRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapToDomain(record: PrismaQuarantineItem): QuarantineItem {
    return new QuarantineItem(
      record.id,
      new ProductVariantId(record.variantId),
      record.quantity,
      record.reason,
      new LocationId(record.locationId),
      new TenantId(record.tenantId),
      record.status as QuarantineStatus,
      record.createdAt,
      record.resolvedAt
    );
  }

  async findById(id: string): Promise<QuarantineItem | null> {
    const dbId = toUuid(id);
    const record = await this.prisma.quarantineItem.findUnique({
      where: { id: dbId },
    });

    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findAllByTenant(tenantId: TenantId): Promise<QuarantineItem[]> {
    const records = await this.prisma.quarantineItem.findMany({
      where: { tenantId: tenantId.value },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((record: PrismaQuarantineItem) => this.mapToDomain(record));
  }

  async save(item: QuarantineItem): Promise<void> {
    const dbId = toUuid(item.id);
    await this.prisma.quarantineItem.upsert({
      where: { id: dbId },
      update: {
        status: item.status,
        resolvedAt: item.resolvedAt,
      },
      create: {
        id: dbId,
        variantId: toUuid(item.variantId.value),
        quantity: item.quantity,
        reason: item.reason,
        locationId: item.locationId.value,
        tenantId: item.tenantId.value,
        status: item.status,
        createdAt: item.createdAt,
        resolvedAt: item.resolvedAt,
      },
    });
  }

  async saveBatch(items: QuarantineItem[]): Promise<void> {
    if (items.length === 0) return;

    // Deduplicate items, keeping the last occurrence of each ID to avoid race conditions
    const uniqueItemsMap = new Map<string, QuarantineItem>();
    for (const item of items) {
      uniqueItemsMap.set(item.id, item);
    }
    const uniqueItems = Array.from(uniqueItemsMap.values());

    await this.prisma.$transaction(async (tx) => {
      await Promise.all(
        uniqueItems.map((item) => {
          const dbId = toUuid(item.id);
          return tx.quarantineItem.upsert({
            where: { id: dbId },
            update: {
              status: item.status,
              resolvedAt: item.resolvedAt,
            },
            create: {
              id: dbId,
              variantId: toUuid(item.variantId.value),
              quantity: item.quantity,
              reason: item.reason,
              locationId: item.locationId.value,
              tenantId: item.tenantId.value,
              status: item.status,
              createdAt: item.createdAt,
              resolvedAt: item.resolvedAt,
            },
          });
        })
      );
    });
  }
}
