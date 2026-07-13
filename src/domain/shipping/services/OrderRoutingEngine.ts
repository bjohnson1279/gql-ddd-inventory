import { GeoLocation } from "../../valueObjects/GeoLocation";
import { CandidateLocation, FulfillmentPlan, FulfillmentAllocation, IRoutingStrategy } from "../strategies/RoutingStrategy";

export class OrderRoutingEngine {
  /**
   * Evaluates all potential fulfillment plans and returns the optimal one.
   */
  public static async routeOrder(
    sku: string,
    quantity: number,
    destination: GeoLocation,
    candidates: { locationId: string; availableQuantity: number; geoLocation: GeoLocation }[],
    strategy: IRoutingStrategy,
    rateCalculator: (locationId: string, sku: string, qty: number) => Promise<number>
  ): Promise<FulfillmentPlan> {

    const activeCandidates = candidates.filter(c => c.availableQuantity > 0);
    const totalAvailable = activeCandidates.reduce((sum, c) => sum + c.availableQuantity, 0);

    if (totalAvailable < quantity) {
      throw new Error(`Insufficient total stock for SKU ${sku}. Requested: ${quantity}, Available: ${totalAvailable}`);
    }

    const rawPlans = this.generatePlans(activeCandidates, quantity);

    if (rawPlans.length === 0) {
      throw new Error(`Could not find any valid allocation combinations for quantity ${quantity}`);
    }

    const plans: FulfillmentPlan[] = [];
    for (const allocations of rawPlans) {
      let totalDistance = 0;
      let totalCost = 0;

      for (const alloc of allocations) {
        const candidate = activeCandidates.find(c => c.locationId === alloc.locationId)!;
        const dist = candidate.geoLocation.distanceTo(destination);
        totalDistance += dist;

        const rate = await rateCalculator(alloc.locationId, sku, alloc.quantity);
        totalCost += rate;
      }

      const splitCount = allocations.length - 1;

      const plan: FulfillmentPlan = {
        allocations,
        estimatedShippingCostCents: totalCost,
        totalDistanceKm: totalDistance,
        splitCount,
        score: 0
      };

      plan.score = strategy.score(plan);
      plans.push(plan);
    }

    plans.sort((a, b) => a.score - b.score);
    return plans[0];
  }

  private static generatePlans(
    candidates: { locationId: string; availableQuantity: number }[],
    quantity: number
  ): FulfillmentAllocation[][] {
    const results: FulfillmentAllocation[][] = [];

    const recurse = (
      index: number,
      remaining: number,
      current: FulfillmentAllocation[]
    ) => {
      if (remaining === 0) {
        results.push([...current]);
        return;
      }
      if (index >= candidates.length) {
        return;
      }

      const candidate = candidates[index];

      const allocQty = Math.min(remaining, candidate.availableQuantity);
      if (allocQty > 0) {
        current.push({ locationId: candidate.locationId, quantity: allocQty });
        recurse(index + 1, remaining - allocQty, current);
        current.pop();
      }

      recurse(index + 1, remaining, current);
    };

    recurse(0, quantity, []);
    return results;
  }
}
