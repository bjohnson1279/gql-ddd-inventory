import { PrismaClient, Prisma } from '@prisma/client';
import { IRmaRepository } from '../../domain/repositories/IRmaRepository';
import { Rma } from '../../domain/entities/Rma';
import { RmaItem } from '../../domain/entities/RmaItem';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { RMAStatus, RMAItemStatus, RMADisposition } from '../../domain/enums/ReturnEnums';
import { toUuid } from '../utils/uuid';


export class PostgresRmaRepository implements IRmaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private mapToDomain(record: any): Rma {
    const items = (record.items || []).map((item: any) =>
      new RmaItem(
        item.id,
        new ProductVariantId(item.variantId),
        item.quantity,
        item.unitCostCents,
        item.receivedQuantity,
        item.status as RMAItemStatus,
        item.disposition as RMADisposition | null
      )
    );

    return new Rma(
      record.id,
      record.rmaNumber,
      new TenantId(record.tenantId),
      record.customerId,
      new LocationId(record.locationId),
      record.status as RMAStatus,
      items,
      record.createdAt,
      record.updatedAt
    );
  }

  async findById(id: string): Promise<Rma | null> {
    const dbId = toUuid(id);
    const record = await (this.prisma as any).rma.findUnique({
      where: { id: dbId },
      include: { items: true },
    });

    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findByNumber(rmaNumber: string): Promise<Rma | null> {
    const record = await (this.prisma as any).rma.findUnique({
      where: { rmaNumber },
      include: { items: true },
    });

    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findAllByTenant(tenantId: TenantId): Promise<Rma[]> {
    const records = await (this.prisma as any).rma.findMany({
      where: { tenantId: tenantId.value },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((record: any) => this.mapToDomain(record));
  }

  async save(rma: Rma): Promise<void> {
    const dbId = toUuid(rma.id);
    await this.prisma.$transaction(async (tx) => {
      // Upsert RMA aggregate root
      await (tx as any).rma.upsert({
        where: { id: dbId },
        update: {
          status: rma.status,
          customerId: rma.customerId,
          locationId: rma.locationId.value,
          tenantId: rma.tenantId.value,
          updatedAt: rma.updatedAt,
        },
        create: {
          id: dbId,
          rmaNumber: rma.rmaNumber,
          status: rma.status,
          customerId: rma.customerId,
          locationId: rma.locationId.value,
          tenantId: rma.tenantId.value,
          createdAt: rma.createdAt,
          updatedAt: rma.updatedAt,
        },
      });

      // Batch upsert RMA items in a single query to eliminate N+1 overhead while preserving row identities and foreign key constraints
      if (rma.items.length > 0) {
        const itemValues = rma.items.map((item) => {
          const itemDbId = toUuid(item.id);
          const variantDbId = toUuid(item.variantId.value);
          return Prisma.sql`(${itemDbId}::uuid, ${dbId}::uuid, ${variantDbId}::uuid, ${item.quantity}, ${item.receivedQuantity}, ${item.unitCostCents}, ${item.status}, ${item.disposition})`;
        });

        await tx.$executeRaw`
          INSERT INTO "rma_items" ("id", "rma_id", "variant_id", "quantity", "received_quantity", "unit_cost_cents", "status", "disposition")
          VALUES ${Prisma.join(itemValues)}
          ON CONFLICT ("id") DO UPDATE SET
            "received_quantity" = EXCLUDED."received_quantity",
            "status" = EXCLUDED."status",
            "disposition" = EXCLUDED."disposition";
        `;
      }
    });
  }
}
