import { IWarehouseLocationRepository } from '../repositories/IWarehouseLocationRepository';
import { LocationId } from '../valueObjects/LocationId';

export interface PickItemInput {
  sku: string;
  quantity: number;
  locationId: string;
}

export interface PickRouteItem {
  sku: string;
  locationId: string;
  quantity: number;
  warehouseId: string;
  zone: string;
  aisle: string;
  rack: string;
  shelf: string;
  bin: string;
}

export interface PickRoute {
  warehouseId: string;
  items: PickRouteItem[];
}

export class PickingRouteOptimizer {
  constructor(private readonly locationRepo: IWarehouseLocationRepository) {}

  async optimizeRoute(items: PickItemInput[]): Promise<PickRoute[]> {
    if (items.length === 0) {
      return [];
    }

    // Fixes N+1 query bottleneck by loading warehouse locations for all unique locationIds in a single batched query
    const uniqueLocationIds = Array.from(new Set(items.map((item) => item.locationId)));
    const locationIdsToFetch = uniqueLocationIds.map((id) => new LocationId(id));
    const locations = await this.locationRepo.findByIds(locationIdsToFetch);
    const locationMap = new Map(locations.map((loc) => [loc.id.value, loc]));

    const routeItems: PickRouteItem[] = [];
    for (const item of items) {
      const loc = locationMap.get(item.locationId);
      if (!loc) {
        throw new Error(`Warehouse location with ID ${item.locationId} not found.`);
      }

      routeItems.push({
        sku: item.sku,
        locationId: item.locationId,
        quantity: item.quantity,
        warehouseId: loc.warehouseId,
        zone: loc.zone,
        aisle: loc.aisle,
        rack: loc.rack,
        shelf: loc.shelf,
        bin: loc.bin
      });
    }

    // Group by warehouseId
    const groups = new Map<string, PickRouteItem[]>();
    for (const item of routeItems) {
      const list = groups.get(item.warehouseId) ?? [];
      list.push(item);
      groups.set(item.warehouseId, list);
    }

    const result: PickRoute[] = [];

    // Sort items within each warehouse group using S-Shape Routing
    for (const [warehouseId, warehouseItems] of groups.entries()) {
      warehouseItems.sort((a, b) => {
        // 1. Sort by aisle index
        const indexA = this.getAisleIndex(a.aisle);
        const indexB = this.getAisleIndex(b.aisle);
        if (indexA !== indexB) {
          return indexA - indexB;
        }

        // 2. Since they are in the same aisle, apply S-Shape serpentine direction
        const isOddAisle = indexA % 2 !== 0;
        
        // Compare rack
        const rackComp = a.rack.localeCompare(b.rack, undefined, { numeric: true });
        if (rackComp !== 0) {
          return isOddAisle ? rackComp : -rackComp;
        }

        // Compare shelf
        const shelfComp = a.shelf.localeCompare(b.shelf, undefined, { numeric: true });
        if (shelfComp !== 0) {
          return isOddAisle ? shelfComp : -shelfComp;
        }

        // Compare bin
        const binComp = a.bin.localeCompare(b.bin, undefined, { numeric: true });
        return isOddAisle ? binComp : -binComp;
      });

      result.push({
        warehouseId,
        items: warehouseItems
      });
    }

    return result;
  }

  private getAisleIndex(aisle: string): number {
    const num = parseInt(aisle.replace(/\D/g, ''), 10);
    if (!isNaN(num)) {
      return num;
    }
    // Fallback to alphabetical index (A = 1, B = 2, C = 3, etc.)
    let code = 0;
    const clean = aisle.toUpperCase().replace(/[^A-Z]/g, '');
    for (let i = 0; i < clean.length; i++) {
      code = code * 26 + (clean.charCodeAt(i) - 64);
    }
    return code || 1;
  }
}
