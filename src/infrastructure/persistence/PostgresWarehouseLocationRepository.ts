import { PrismaClient } from '@prisma/client';
import { IWarehouseLocationRepository } from '../../domain/repositories/IWarehouseLocationRepository';
import { WarehouseLocation } from '../../domain/entities/WarehouseLocation';
import { LocationId } from '../../domain/valueObjects/LocationId';

export class PostgresWarehouseLocationRepository implements IWarehouseLocationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(location: WarehouseLocation): Promise<void> {
    await this.prisma.warehouseLocation.upsert({
      where: { id: location.id.value },
      create: {
        id: location.id.value,
        warehouseId: location.warehouseId,
        zone: location.zone,
        aisle: location.aisle,
        rack: location.rack,
        shelf: location.shelf,
        bin: location.bin,
        maxWeightGrams: location.maxWeightGrams,
        maxVolumeCubicMeters: location.maxVolumeCubicMeters,
      },
      update: {
        warehouseId: location.warehouseId,
        zone: location.zone,
        aisle: location.aisle,
        rack: location.rack,
        shelf: location.shelf,
        bin: location.bin,
        maxWeightGrams: location.maxWeightGrams,
        maxVolumeCubicMeters: location.maxVolumeCubicMeters,
      },
    });
  }

  async findById(id: LocationId): Promise<WarehouseLocation | null> {
    const model = await this.prisma.warehouseLocation.findUnique({
      where: { id: id.value },
    });
    if (!model) return null;
    return new WarehouseLocation(
      new LocationId(model.id),
      model.warehouseId,
      model.zone,
      model.aisle,
      model.rack,
      model.shelf,
      model.bin,
      model.maxWeightGrams,
      model.maxVolumeCubicMeters
    );
  }

  async delete(id: LocationId): Promise<void> {
    await this.prisma.warehouseLocation.delete({
      where: { id: id.value },
    });
  }

  async findByIds(ids: LocationId[]): Promise<WarehouseLocation[]> {
    const models = await this.prisma.warehouseLocation.findMany({
      where: { id: { in: ids.map((id) => id.value) } },
    });
    return models.map(
      (model) =>
        new WarehouseLocation(
          new LocationId(model.id),
          model.warehouseId,
          model.zone,
          model.aisle,
          model.rack,
          model.shelf,
          model.bin,
          model.maxWeightGrams,
          model.maxVolumeCubicMeters
        )
    );
  }

  async findAll(): Promise<WarehouseLocation[]> {
    const models = await this.prisma.warehouseLocation.findMany();
    return models.map(
      (model) =>
        new WarehouseLocation(
          new LocationId(model.id),
          model.warehouseId,
          model.zone,
          model.aisle,
          model.rack,
          model.shelf,
          model.bin,
          model.maxWeightGrams,
          model.maxVolumeCubicMeters
        )
    );
  }
}
