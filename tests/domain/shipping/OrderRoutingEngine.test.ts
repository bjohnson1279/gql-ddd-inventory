import { GeoLocation } from "../../../src/domain/valueObjects/GeoLocation";
import { OrderRoutingEngine } from "../../../src/domain/shipping/services/OrderRoutingEngine";
import {
  MinimizeSplitsStrategy,
  MinimizeCostStrategy,
  MinimizeDistanceStrategy
} from "../../../src/domain/shipping/strategies/RoutingStrategy";

describe("OrderRoutingEngine (GraphQL)", () => {
  const nyDest = new GeoLocation(40.7128, -74.0060);

  const candidates = [
    {
      locationId: "WH-EAST",
      availableQuantity: 5,
      geoLocation: new GeoLocation(40.7306, -73.9352)
    },
    {
      locationId: "WH-WEST",
      availableQuantity: 5,
      geoLocation: new GeoLocation(34.0522, -118.2437)
    },
    {
      locationId: "WH-CENTRAL",
      availableQuantity: 10,
      geoLocation: new GeoLocation(41.8781, -87.6298)
    }
  ];

  const mockRateCalculator = async (locationId: string, sku: string, qty: number): Promise<number> => {
    const originGeo = locationId === "WH-EAST"
      ? new GeoLocation(40.7306, -73.9352)
      : locationId === "WH-WEST"
      ? new GeoLocation(34.0522, -118.2437)
      : new GeoLocation(41.8781, -87.6298);

    const dist = originGeo.distanceTo(nyDest);
    return Math.ceil(dist * 0.1) * qty;
  };

  it("should fail routing if quantity is greater than total available stock", async () => {
    await expect(
      OrderRoutingEngine.routeOrder("SKU-1", 25, nyDest, candidates, new MinimizeCostStrategy(), mockRateCalculator)
    ).rejects.toThrow("Insufficient total stock for SKU SKU-1");
  });

  it("should choose single warehouse (WH-CENTRAL) when minimizing splits for quantity 8", async () => {
    const plan = await OrderRoutingEngine.routeOrder(
      "SKU-1",
      8,
      nyDest,
      candidates,
      new MinimizeSplitsStrategy(),
      mockRateCalculator
    );

    expect(plan.splitCount).toBe(0);
    expect(plan.allocations).toHaveLength(1);
    expect(plan.allocations[0].locationId).toBe("WH-CENTRAL");
    expect(plan.allocations[0].quantity).toBe(8);
  });

  it("should choose cheaper split (WH-EAST + WH-CENTRAL) when minimizing cost for quantity 8", async () => {
    const plan = await OrderRoutingEngine.routeOrder(
      "SKU-1",
      8,
      nyDest,
      candidates,
      new MinimizeCostStrategy(),
      mockRateCalculator
    );

    const eastAlloc = plan.allocations.find(a => a.locationId === "WH-EAST");
    const centralAlloc = plan.allocations.find(a => a.locationId === "WH-CENTRAL");

    expect(plan.splitCount).toBe(1);
    expect(eastAlloc).toBeDefined();
    expect(eastAlloc!.quantity).toBe(5);
    expect(centralAlloc).toBeDefined();
    expect(centralAlloc!.quantity).toBe(3);
  });

  it("should choose closest location (WH-EAST) for quantity 3 when minimizing distance", async () => {
    const plan = await OrderRoutingEngine.routeOrder(
      "SKU-1",
      3,
      nyDest,
      candidates,
      new MinimizeDistanceStrategy(),
      mockRateCalculator
    );

    expect(plan.allocations).toHaveLength(1);
    expect(plan.allocations[0].locationId).toBe("WH-EAST");
    expect(plan.allocations[0].quantity).toBe(3);
  });
});
