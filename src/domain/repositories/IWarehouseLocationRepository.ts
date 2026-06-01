import { WarehouseLocation } from '../entities/WarehouseLocation';
import { LocationId } from '../valueObjects/LocationId';

export interface IWarehouseLocationRepository {
  save(location: WarehouseLocation): Promise<void>;
  findById(id: LocationId): Promise<WarehouseLocation | null>;
  delete(id: LocationId): Promise<void>;
  findAll(): Promise<WarehouseLocation[]>;
}
