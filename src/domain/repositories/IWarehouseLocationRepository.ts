import { WarehouseLocation } from '../entities/WarehouseLocation';
import { LocationId } from '../valueObjects/LocationId';

export interface IWarehouseLocationRepository {
  save(location: WarehouseLocation): Promise<void>;
  findById(id: LocationId): Promise<WarehouseLocation | null>;
  delete(id: LocationId): Promise<void>;
  findByIds(ids: LocationId[]): Promise<WarehouseLocation[]>;
  findAll(): Promise<WarehouseLocation[]>;
}
