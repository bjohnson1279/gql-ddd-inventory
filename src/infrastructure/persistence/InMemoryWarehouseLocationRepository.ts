import { IWarehouseLocationRepository } from '../../domain/repositories/IWarehouseLocationRepository';
import { WarehouseLocation } from '../../domain/entities/WarehouseLocation';
import { LocationId } from '../../domain/valueObjects/LocationId';

export class InMemoryWarehouseLocationRepository implements IWarehouseLocationRepository {
  private readonly locations: Map<string, WarehouseLocation> = new Map();

  async save(location: WarehouseLocation): Promise<void> {
    this.locations.set(location.id.value, location);
  }

  async findById(id: LocationId): Promise<WarehouseLocation | null> {
    const loc = this.locations.get(id.value);
    return loc ? this.clone(loc) : null;
  }

  async delete(id: LocationId): Promise<void> {
    this.locations.delete(id.value);
  }

  async findByIds(ids: LocationId[]): Promise<WarehouseLocation[]> {
    const result: WarehouseLocation[] = [];
    const idStrings = ids.map(id => id.value);
    for (const id of idStrings) {
      const loc = this.locations.get(id);
      if (loc) {
        result.push(this.clone(loc));
      }
    }
    return result;
  }

  async findAll(): Promise<WarehouseLocation[]> {
    return Array.from(this.locations.values()).map(loc => this.clone(loc));
  }

  private clone(loc: WarehouseLocation): WarehouseLocation {
    return new WarehouseLocation(
      new LocationId(loc.id.value),
      loc.warehouseId,
      loc.zone,
      loc.aisle,
      loc.rack,
      loc.shelf,
      loc.bin,
      loc.maxWeightGrams,
      loc.maxVolumeCubicMeters
    );
  }
}
