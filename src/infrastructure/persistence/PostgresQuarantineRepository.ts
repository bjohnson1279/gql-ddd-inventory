import { PrismaClient } from '@prisma/client';
import { IQuarantineRepository } from '../../domain/repositories/IQuarantineRepository';
import { QuarantineItem } from '../../domain/entities/QuarantineItem';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { QuarantineStatus } from '../../domain/enums/ReturnEnums';
import crypto from 'crypto';

function toUuid(id: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id.toLowerCase();
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

export class PostgresQuarantineRepository implements IQuarantineRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapToDomain(record: any): QuarantineItem {
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
    return records.map((record) => this.mapToDomain(record));
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
}
