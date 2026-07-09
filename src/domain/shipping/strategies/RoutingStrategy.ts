import { GeoLocation } from "../../valueObjects/GeoLocation";

export interface CarrierRate {
  carrier: string;
  rateCents: number;
  estimatedDays: number;
}

export interface CandidateLocation {
  locationId: string;
  availableQuantity: number;
  geoLocation: GeoLocation;
  carrierRates: CarrierRate[];
}

export interface FulfillmentAllocation {
  locationId: string;
  quantity: number;
}

export interface FulfillmentPlan {
  allocations: FulfillmentAllocation[];
  estimatedShippingCostCents: number;
  totalDistanceKm: number;
  splitCount: number;
  score: number; // Combined weighted score (lower is better)
}

export interface IRoutingStrategy {
  score(plan: FulfillmentPlan): number;
}

export class MinimizeSplitsStrategy implements IRoutingStrategy {
  score(plan: FulfillmentPlan): number {
    const splitPenalty = plan.splitCount * 1000000;
    const costFactor = plan.estimatedShippingCostCents;
    const distanceFactor = plan.totalDistanceKm * 0.1;
    return splitPenalty + costFactor + distanceFactor;
  }
}

export class MinimizeCostStrategy implements IRoutingStrategy {
  score(plan: FulfillmentPlan): number {
    const splitPenalty = plan.splitCount * 500;
    const costFactor = plan.estimatedShippingCostCents;
    const distanceFactor = plan.totalDistanceKm * 0.1;
    return splitPenalty + costFactor + distanceFactor;
  }
}

export class MinimizeDistanceStrategy implements IRoutingStrategy {
  score(plan: FulfillmentPlan): number {
    const splitPenalty = plan.splitCount * 1000;
    const costFactor = plan.estimatedShippingCostCents * 0.1;
    const distanceFactor = plan.totalDistanceKm * 10;
    return splitPenalty + costFactor + distanceFactor;
  }
}
