import { PrismaClient, InventoryItem as PrismaInventoryItem } from '@prisma/client';
import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import { InventoryItem } from '../../domain/entities/InventoryItem';
import { ConcurrencyError } from '../../domain/exceptions/DomainErrors';
import { Sku } from '../../domain/valueObjects/Sku';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { Quantity } from '../../domain/valueObjects/Quantity';

export class PostgresInventoryRepository implements IInventoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(model: PrismaInventoryItem): InventoryItem {
    return new InventoryItem(
      model.id,
      new Sku(model.sku),
      new LocationId(model.locationId),
      new Quantity(model.quantity),
      new Quantity(model.allocated),
      new Quantity(model.inTransit),
      model.version
    );
  }

  async findById(id: string): Promise<InventoryItem | null> {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id } });
    return item ? this.toDomain(item) : null;
  }

  async findBySku(sku: string): Promise<InventoryItem[]> {
    const items = await this.prisma.inventoryItem.findMany({ where: { sku } });
    return items.map(i => this.toDomain(i));
  }

  async findBySkuAndLocation(sku: string, locationId: string): Promise<InventoryItem | null> {
    const item = await this.prisma.inventoryItem.findUnique({
      where: {
        sku_locationId: { sku, locationId }
      }
    });
    return item ? this.toDomain(item) : null;
  }

  async findBySkuAndLocationBatch(pairs: { sku: string; locationId: string }[]): Promise<InventoryItem[]> {
    if (pairs.length === 0) return [];

    const items = await this.prisma.inventoryItem.findMany({
      where: {
        OR: pairs.map(p => ({
          sku: p.sku,
          locationId: p.locationId
        }))
      }
    });
    return items.map(i => this.toDomain(i));
  }

  async findByLocation(locationId: string): Promise<InventoryItem[]> {
    const items = await this.prisma.inventoryItem.findMany({ where: { locationId } });
    return items.map(i => this.toDomain(i));
  }

  async findAll(): Promise<InventoryItem[]> {
    const items = await this.prisma.inventoryItem.findMany();
    return items.map(i => this.toDomain(i));
  }

  async save(item: InventoryItem): Promise<void> {
    const events = item.pullDomainEvents();

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryItem.findUnique({
        where: { id: item.id }
      });

      if (!existing) {
        await tx.inventoryItem.create({
          data: {
            id: item.id,
            sku: item.sku.value,
            locationId: item.locationId.value,
            quantity: item.quantity.value,
            allocated: item.allocated.value,
            inTransit: item.inTransit.value,
            version: item.version
          }
        });
      } else {
        const updateResult = await tx.inventoryItem.updateMany({
          where: {
            id: item.id,
            version: item.version - 1
          },
          data: {
            quantity: item.quantity.value,
            allocated: item.allocated.value,
            inTransit: item.inTransit.value,
            version: item.version
          }
        });

        if (updateResult.count === 0) {
          throw new ConcurrencyError(item.sku.value, item.locationId.value);
        }
      }

      // Save pulled events to OutboxEvent table
      for (const event of events) {
        await tx.outboxEvent.create({
          data: {
            eventType: event.constructor.name,
            payload: JSON.stringify(event),
            status: 'Pending'
          }
        });
      }
    });
  }

  async saveBatch(items: InventoryItem[]): Promise<void> {
    if (items.length === 0) return;

    // Fetch existing items to determine inserts vs updates
    const existingItems = await this.prisma.inventoryItem.findMany({
      where: {
        id: { in: items.map(i => i.id) }
      },
      select: { id: true }
    });

    const existingIds = new Set(existingItems.map(i => i.id));

    await this.prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of items) {
        let count = 0;
        if (!existingIds.has(item.id)) {
          await tx.inventoryItem.create({
            data: {
              id: item.id,
              sku: item.sku.value,
              locationId: item.locationId.value,
              quantity: item.quantity.value,
              allocated: item.allocated.value,
              inTransit: item.inTransit.value,
              version: item.version
            }
          });
          count = 1;
        } else {
          const res = await tx.inventoryItem.updateMany({
            where: {
              id: item.id,
              version: item.version - 1
            },
            data: {
              quantity: item.quantity.value,
              allocated: item.allocated.value,
              inTransit: item.inTransit.value,
              version: item.version
            }
          });
          count = res.count;
        }

        results.push({ count });

        // Save events to outbox
        const events = item.pullDomainEvents();
        for (const event of events) {
          await tx.outboxEvent.create({
            data: {
              eventType: event.constructor.name,
              payload: JSON.stringify(event),
              status: 'Pending'
            }
          });
        }
      }

      // Check for concurrency errors on updates
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (existingIds.has(item.id)) {
          const result = results[i] as { count: number };
          if (result.count === 0) {
            throw new ConcurrencyError(item.sku.value, item.locationId.value);
          }
        }
      }
    });
  }
}
