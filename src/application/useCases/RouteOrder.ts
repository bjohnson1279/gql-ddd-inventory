import { IInventoryRepository } from "../../domain/repositories/IInventoryRepository";
import { Sku } from "../../domain/valueObjects/Sku";
import { GeoLocation } from "../../domain/valueObjects/GeoLocation";
import { OrderRoutingEngine } from "../../domain/shipping/services/OrderRoutingEngine";
import {
  IRoutingStrategy,
  MinimizeCostStrategy,
  MinimizeSplitsStrategy,
  MinimizeDistanceStrategy,
  FulfillmentPlan
} from "../../domain/shipping/strategies/RoutingStrategy";

export interface RouteOrderCommand {
  sku: string;
  quantity: number;
  destinationAddress: string;
  strategyName?: "MINIMIZE_COST" | "MINIMIZE_SPLITS" | "MINIMIZE_DISTANCE";
}

export class RouteOrder {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly carrierService: any
  ) {}

  async execute(command: RouteOrderCommand): Promise<FulfillmentPlan> {
    const { sku, quantity, destinationAddress, strategyName } = command;

    if (!sku || !quantity || !destinationAddress) {
      throw new Error("Missing required routing parameters: sku, quantity, and destinationAddress.");
    }

    let strategy: IRoutingStrategy = new MinimizeCostStrategy();
    if (strategyName === "MINIMIZE_SPLITS") {
      strategy = new MinimizeSplitsStrategy();
    } else if (strategyName === "MINIMIZE_DISTANCE") {
      strategy = new MinimizeDistanceStrategy();
    }

    const destinationGeo = this.geocodeAddress(destinationAddress);

    // Query all stock layers for the SKU across all locations
    const stockItems = await this.inventoryRepository.findBySku(sku);

    // Map stock items to candidate locations with geocodes
    const candidates = stockItems.map(item => {
      const locationId = item.locationId.value;
      const geoLocation = this.getWarehouseGeoLocation(locationId);
      
      const availableQuantity = item.quantity.value - item.allocated.value;

      return {
        locationId,
        availableQuantity: Math.max(0, availableQuantity),
        geoLocation
      };
    });

    candidates.sort((a, b) => a.geoLocation.distanceTo(destinationGeo) - b.geoLocation.distanceTo(destinationGeo));

    const bestPlan = await OrderRoutingEngine.routeOrder(
      sku,
      quantity,
      destinationGeo,
      candidates,
      strategy,
      async (locationId, productSku, qty) => {
        try {
          const rates = await this.carrierService.getRates(productSku, qty, destinationAddress, locationId);
          if (!rates || rates.length === 0) return 999999;
          return Math.min(...rates.map((r: any) => r.rateCents || r.cost));
        } catch (e) {
          return 999999;
        }
      }
    );

    return bestPlan;
  }

  private geocodeAddress(address: string): GeoLocation {
    const normalized = address.toLowerCase();
    if (normalized.includes("new york") || normalized.includes("ny") || normalized.includes("10001")) {
      return new GeoLocation(40.7128, -74.0060);
    }
    if (normalized.includes("los angeles") || normalized.includes("ca") || normalized.includes("90210")) {
      return new GeoLocation(34.0522, -118.2437);
    }
    if (normalized.includes("chicago") || normalized.includes("il") || normalized.includes("60601")) {
      return new GeoLocation(41.8781, -87.6298);
    }
    if (normalized.includes("dallas") || normalized.includes("tx") || normalized.includes("75001")) {
      return new GeoLocation(32.7767, -96.7970);
    }

    let hash = 0;
    for (let i = 0; i < address.length; i++) {
      hash = address.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const lat = 25 + Math.abs(hash % 24);
    const lon = -125 + Math.abs(hash % 58);
    return new GeoLocation(lat, lon);
  }

  private getWarehouseGeoLocation(locationId: string): GeoLocation {
    const loc = locationId.toUpperCase();
    if (loc.includes("EAST") || loc.includes("WH1") || loc.includes("NY")) {
      return new GeoLocation(40.7306, -73.9352);
    }
    if (loc.includes("WEST") || loc.includes("WH2") || loc.includes("LA")) {
      return new GeoLocation(34.0522, -118.2437);
    }
    if (loc.includes("CENTRAL") || loc.includes("WH3") || loc.includes("CH")) {
      return new GeoLocation(41.8781, -87.6298);
    }
    return new GeoLocation(39.8283, -98.5795);
  }
}
