import { PrismaClient, Prisma, InventoryItem as PrismaInventoryItem } from '@prisma/client';
import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import { InventoryItem } from '../../domain/entities/InventoryItem';
import { ConcurrencyError } from '../../domain/exceptions/DomainErrors';
import { Sku } from '../../domain/valueObjects/Sku';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { Quantity } from '../../domain/valueObjects/Quantity';
import { getTraceId } from '../telemetry/traceContext';

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
      if (events.length > 0) {
        // chunk logic for single item save isn't really necessary, but we can do it for consistency
        const BATCH_SIZE = 500;
        for (let i = 0; i < events.length; i += BATCH_SIZE) {
          const chunk = events.slice(i, i + BATCH_SIZE);
          await tx.outboxEvent.createMany({
            data: chunk.map(event => ({
              eventType: event.constructor.name,
              payload: JSON.stringify({
                ...event,
                traceId: (event as any).traceId || getTraceId()
              }),
              status: 'Pending'
            }))
          });
        }
      }
    });
  }

  async saveBatch(items: InventoryItem[]): Promise<void> {
    if (items.length === 0) return;

    const existingItems = await this.prisma.inventoryItem.findMany({
      where: {
        id: { in: items.map(i => i.id) }
      },
      select: { id: true }
    });

    const existingIds = new Set(existingItems.map(i => i.id));

    await this.prisma.$transaction(async (tx) => {
      const results = [];

      // Deduplicate items to prevent concurrency errors if the same item is passed multiple times in the batch
      const uniqueItems = new Map<string, InventoryItem>();
      const allEvents: any[] = [];

      for (const item of items) {
        // Collect events from all passed items, even if we deduplicate the save
        allEvents.push(...item.pullDomainEvents());
        uniqueItems.set(item.id, item);
      }

      const deduplicatedItems = Array.from(uniqueItems.values());

      const itemsToCreate = [];
      const itemsToUpdate = [];

      for (const item of deduplicatedItems) {
        if (!existingIds.has(item.id)) {
          itemsToCreate.push(item);
        } else {
          itemsToUpdate.push(item);
        }
      }

      if (itemsToCreate.length > 0) {
        await tx.inventoryItem.createMany({
          data: itemsToCreate.map(item => ({
            id: item.id,
            sku: item.sku.value,
            locationId: item.locationId.value,
            quantity: item.quantity.value,
            allocated: item.allocated.value,
            inTransit: item.inTransit.value,
            version: item.version
          }))
        });
      }

      if (itemsToUpdate.length > 0) {
        const updateRows = itemsToUpdate.map(i => Prisma.sql`(${i.id}::text, ${i.quantity.value}::int, ${i.allocated.value}::int, ${i.inTransit.value}::int, ${i.version}::int)`);

        const result = await tx.$queryRaw<{id: string}>`
          UPDATE inventory_items AS t
          SET
            quantity = v.quantity::int,
            allocated = v.allocated::int,
            in_transit = v.in_transit::int,
            version = v.version::int
          FROM (
            VALUES
              ${Prisma.join(updateRows)}
          ) AS v(id, quantity, allocated, in_transit, version)
          WHERE t.id = v.id AND t.version = v.version - 1
          RETURNING t.id;
        `;

        const updatedIds = new Set(Array.isArray(result) ? result.map(r => r.id) : []);

        for (const item of itemsToUpdate) {
          if (!updatedIds.has(item.id)) {
            throw new ConcurrencyError(item.sku.value, item.locationId.value);
          }
        }
      }

      if (allEvents.length > 0) {
        const BATCH_SIZE = 500;
        for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
          const chunk = allEvents.slice(i, i + BATCH_SIZE);
          await tx.outboxEvent.createMany({
            data: chunk.map(event => ({
              eventType: event.constructor.name,
              payload: JSON.stringify({
                ...event,
                traceId: (event as any).traceId || getTraceId()
              }),
              status: 'Pending'
            }))
          });
        }
      }

    });
  }
}
