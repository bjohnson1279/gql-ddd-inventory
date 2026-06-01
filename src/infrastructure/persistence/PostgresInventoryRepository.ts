import { PrismaClient } from '@prisma/client';
import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import { InventoryItem } from '../../domain/entities/InventoryItem';
import { ConcurrencyError } from '../../domain/exceptions/DomainErrors';
import { Sku } from '../../domain/valueObjects/Sku';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { Quantity } from '../../domain/valueObjects/Quantity';

export class PostgresInventoryRepository implements IInventoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(model: import('@prisma/client').InventoryItem): InventoryItem {
    return new InventoryItem(
      model.id,
      new Sku(model.sku),
      new LocationId(model.locationId),
      new Quantity(model.quantity),
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

  async findAll(): Promise<InventoryItem[]> {
    const items = await this.prisma.inventoryItem.findMany();
    return items.map(i => this.toDomain(i));
  }

  async save(item: InventoryItem): Promise<void> {
    const existing = await this.prisma.inventoryItem.findUnique({
      where: { id: item.id }
    });

    if (!existing) {
      await this.prisma.inventoryItem.create({
        data: {
          id: item.id,
          sku: item.sku.value,
          locationId: item.locationId.value,
          quantity: item.quantity.value,
          version: item.version
        }
      });
    } else {
      const updateResult = await this.prisma.inventoryItem.updateMany({
        where: {
          id: item.id,
          version: item.version - 1
        },
        data: {
          quantity: item.quantity.value,
          version: item.version
        }
      });

      if (updateResult.count === 0) {
        throw new ConcurrencyError(item.sku.value, item.locationId.value);
      }
    }
  }
}
