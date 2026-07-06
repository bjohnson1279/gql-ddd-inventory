import { PrismaClient } from '@prisma/client';
import { IPurchaseOrderRepository } from '../../domain/repositories/IPurchaseOrderRepository';
import { PurchaseOrder } from '../../domain/entities/PurchaseOrder';
import { PurchaseOrderId } from '../../domain/valueObjects/PurchaseOrderId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { PurchaseOrderItem } from '../../domain/valueObjects/PurchaseOrderItem';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { PurchaseOrderStatus } from '../../domain/enums/PurchaseOrderStatus';
import crypto from 'crypto';

function toUuid(id: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id.toLowerCase();
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

export class PostgresPurchaseOrderRepository implements IPurchaseOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveBatch(orders: PurchaseOrder[]): Promise<void> {
    if (orders.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      const orderIds = orders.map(o => toUuid(o.id.value));
      
      // Batch upsert purchase orders concurrently
      await Promise.all(orders.map(async (order) => {
        const dbId = toUuid(order.id.value);
        await tx.purchaseOrder.upsert({
          where: { id: dbId },
          create: {
            id: dbId,
            tenantId: order.tenantId.value,
            supplierId: order.supplierId,
            destinationLocationId: order.destinationLocationId.value,
            status: order.status,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
          },
          update: {
            status: order.status,
            updatedAt: order.updatedAt,
          },
        });
      }));

      // Delete items for all these orders in a single query
      await tx.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId: { in: orderIds } },
      });

      // Gather all items
      const itemsData = orders.flatMap(order => 
        order.items.map((item) => ({
          purchaseOrderId: toUuid(order.id.value),
          variantId: toUuid(item.variantId.value),
          quantity: item.quantity,
        }))
      );

      if (itemsData.length > 0) {
        await tx.purchaseOrderItem.createMany({
          data: itemsData,
        });
      }
    });
  }

  async save(order: PurchaseOrder): Promise<void> {
    const dbId = toUuid(order.id.value);

    await this.prisma.$transaction(async (tx) => {
      await tx.purchaseOrder.upsert({
        where: { id: dbId },
        create: {
          id: dbId,
          tenantId: order.tenantId.value,
          supplierId: order.supplierId,
          destinationLocationId: order.destinationLocationId.value,
          status: order.status,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        },
        update: {
          status: order.status,
          updatedAt: order.updatedAt,
        },
      });

      await tx.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId: dbId },
      });

      if (order.items.length > 0) {
        await tx.purchaseOrderItem.createMany({
          data: order.items.map((item) => ({
            purchaseOrderId: dbId,
            variantId: toUuid(item.variantId.value),
            quantity: item.quantity,
          })),
        });
      }
    });
  }

  async findById(id: PurchaseOrderId): Promise<PurchaseOrder | null> {
    const dbId = toUuid(id.value);
    const model = await this.prisma.purchaseOrder.findUnique({
      where: { id: dbId },
      include: {
        items: true,
      },
    });

    if (!model) return null;

    const items = model.items.map(
      (item) => new PurchaseOrderItem(new ProductVariantId(item.variantId), item.quantity)
    );

    return PurchaseOrder.reconstruct(
      new PurchaseOrderId(model.id),
      new TenantId(model.tenantId),
      model.supplierId,
      new LocationId(model.destinationLocationId),
      items,
      model.status as PurchaseOrderStatus,
      model.createdAt,
      model.updatedAt
    );
  }

  async findAllByTenant(tenantId: TenantId): Promise<PurchaseOrder[]> {
    const models = await this.prisma.purchaseOrder.findMany({
      where: { tenantId: tenantId.value },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return models.map((model) => {
      const items = model.items.map(
        (item) => new PurchaseOrderItem(new ProductVariantId(item.variantId), item.quantity)
      );

      return PurchaseOrder.reconstruct(
        new PurchaseOrderId(model.id),
        new TenantId(model.tenantId),
        model.supplierId,
        new LocationId(model.destinationLocationId),
        items,
        model.status as PurchaseOrderStatus,
        model.createdAt,
        model.updatedAt
      );
    });
  }
}
