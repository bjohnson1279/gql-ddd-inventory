import { LocationId } from '../valueObjects/LocationId';

export class WarehouseLocation {
  constructor(
    public readonly id: LocationId,
    public readonly warehouseId: string,
    public readonly zone: string,
    public readonly aisle: string,
    public readonly rack: string,
    public readonly shelf: string,
    public readonly bin: string,
    public readonly maxWeightGrams: number,
    public readonly maxVolumeCubicMeters: number
  ) {
    if (!warehouseId || warehouseId.trim().length === 0) {
      throw new Error("Warehouse ID cannot be empty.");
    }
    if (!zone || zone.trim().length === 0) {
      throw new Error("Zone cannot be empty.");
    }
    if (!aisle || aisle.trim().length === 0) {
      throw new Error("Aisle cannot be empty.");
    }
    if (!rack || rack.trim().length === 0) {
      throw new Error("Rack cannot be empty.");
    }
    if (!shelf || shelf.trim().length === 0) {
      throw new Error("Shelf cannot be empty.");
    }
    if (!bin || bin.trim().length === 0) {
      throw new Error("Bin cannot be empty.");
    }
    if (maxWeightGrams <= 0) {
      throw new Error("Max weight must be greater than zero.");
    }
    if (maxVolumeCubicMeters <= 0) {
      throw new Error("Max volume must be greater than zero.");
    }
  }

  // Parses a hierarchical path representation e.g. "WH1-ZONEA-A03-R02-S01-B10"
  static parsePath(path: string, maxWeight = 1000000, maxVolume = 10): WarehouseLocation {
    const parts = path.split('-');
    if (parts.length < 6) {
      throw new Error("Invalid location path format. Expected: WH-ZONE-AISLE-RACK-SHELF-BIN");
    }
    return new WarehouseLocation(
      new LocationId(path),
      parts[0], // WH
      parts[1], // ZONE
      parts[2], // AISLE
      parts[3], // RACK
      parts[4], // SHELF
      parts[5], // BIN
      maxWeight,
      maxVolume
    );
  }

  get path(): string {
    return this.id.value;
  }
}
