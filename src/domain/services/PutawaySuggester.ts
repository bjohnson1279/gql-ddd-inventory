import { IInventoryRepository } from '../repositories/IInventoryRepository';
import { IProductRepository } from '../repositories/IProductRepository';
import { IWarehouseLocationRepository } from '../repositories/IWarehouseLocationRepository';
import { ProductVariant } from '../entities/ProductVariant';
import { Sku } from '../valueObjects/Sku';

export interface PutawayRecommendation {
  locationId: string;
  quantity: number;
  remainingWeightGrams: number;
  remainingVolumeCubicMeters: number;
}

export class PutawaySuggester {
  constructor(
    private readonly inventoryRepo: IInventoryRepository,
    private readonly productRepo: IProductRepository,
    private readonly locationRepo: IWarehouseLocationRepository
  ) {}

  async suggestPutaway(sku: Sku, quantity: number): Promise<PutawayRecommendation[]> {
    if (quantity <= 0) {
      throw new Error("Quantity to put away must be positive.");
    }

    const product = await this.productRepo.findBySku(sku);
    if (!product) {
      throw new Error(`Product variant with SKU ${sku.value} not found.`);
    }

    const variant = product.findVariantBySku(sku);
    if (!variant) {
      throw new Error(`Product variant with SKU ${sku.value} not found.`);
    }

    // Load all locations
    const locations = await this.locationRepo.findAll();
    if (locations.length === 0) {
      return [];
    }

    // For each location, calculate occupied weight & volume
    const locationCapacities = [];
    for (const loc of locations) {
      // Find all inventory items in this location
      const items = await this.inventoryRepo.findByLocation(loc.id.value);
      
      // Load all product variants for these items to get their weights & volumes
      let occupiedWeight = 0;
      let occupiedVolume = 0;

      if (items.length > 0) {
        const itemSkus = items.map(i => i.sku);
        const itemProducts = await this.productRepo.findBySkus(itemSkus);
        const itemVariantMap = new Map<string, ProductVariant>();
        for (const ip of itemProducts) {
          for (const iv of ip.variants) {
            itemVariantMap.set(iv.sku.value, iv);
          }
        }

        for (const item of items) {
          const v = itemVariantMap.get(item.sku.value);
          if (v) {
            occupiedWeight += item.quantity.value * v.weightGrams;
            occupiedVolume += item.quantity.value * v.volumeCubicMeters;
          }
        }
      }

      const remainingWeight = loc.maxWeightGrams - occupiedWeight;
      const remainingVolume = loc.maxVolumeCubicMeters - occupiedVolume;

      locationCapacities.push({
        location: loc,
        remainingWeight,
        remainingVolume
      });
    }

    // Now, filter and score candidates based on matching attributes
    // Extract attributes of target variant: temperatureZone, hazardClass, velocity
    const attrs = variant.attributes.all();
    const tempZoneAttr = attrs.find(a => a.name === 'temperatureZone')?.value;
    const hazardAttr = attrs.find(a => a.name === 'hazardClass')?.value;
    const velocityAttr = attrs.find(a => a.name === 'velocity')?.value;

    const scoredCandidates = locationCapacities.map(c => {
      let score = 0;
      let matchesZoneType = true;

      // 1. Temperature Zone: must match if variant specifies it
      if (tempZoneAttr) {
        if (c.location.zone.toLowerCase() === tempZoneAttr.toLowerCase()) {
          score += 100;
        } else {
          matchesZoneType = false;
        }
      }

      // 2. Hazard Class: if hazard class is present (e.g. flammable), prioritize HAZMAT zone.
      // If hazard class is NOT present, do NOT put it in HAZMAT zone.
      if (hazardAttr) {
        if (c.location.zone.toLowerCase() === 'hazmat') {
          score += 200;
        } else {
          matchesZoneType = false;
        }
      } else {
        if (c.location.zone.toLowerCase() === 'hazmat') {
          matchesZoneType = false; // standard item should not be in HAZMAT
        }
      }

      // 3. Velocity: fast-moving items go to FAST zone or front aisles (e.g., A01, A02)
      if (velocityAttr && velocityAttr.toLowerCase() === 'fast-moving') {
        if (c.location.zone.toLowerCase() === 'fast') {
          score += 50;
        }
        if (c.location.aisle === 'A01' || c.location.aisle === 'A02' || c.location.aisle === 'A03') {
          score += 30;
        }
      }

      return {
        ...c,
        score,
        matchesZoneType
      };
    });

    // Filter to candidates that have positive remaining capacity and match zone type requirements
    const eligible = scoredCandidates.filter(c => 
      c.matchesZoneType && 
      c.remainingWeight > 0 && 
      c.remainingVolume > 0
    );

    // Sort by score descending, then by remaining weight descending
    eligible.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.remainingWeight - a.remainingWeight;
    });

    // Suggest allocation
    const recommendations: PutawayRecommendation[] = [];
    let remainingToAllocate = quantity;

    for (const cand of eligible) {
      if (remainingToAllocate <= 0) {
        break;
      }

      // Calculate how many units we can fit in this candidate location with floating point safety
      const maxUnitsToFit = Math.min(
        variant.weightGrams > 0 ? Math.floor(Number((cand.remainingWeight / variant.weightGrams).toFixed(5))) : Infinity,
        variant.volumeCubicMeters > 0 ? Math.floor(Number((cand.remainingVolume / variant.volumeCubicMeters).toFixed(5))) : Infinity
      );

      if (maxUnitsToFit <= 0) {
        continue;
      }

      const allocatedQty = Math.min(remainingToAllocate, maxUnitsToFit);
      
      // Update candidate remaining capacities
      const allocatedWeight = allocatedQty * variant.weightGrams;
      const allocatedVolume = allocatedQty * variant.volumeCubicMeters;
      
      recommendations.push({
        locationId: cand.location.id.value,
        quantity: allocatedQty,
        remainingWeightGrams: cand.remainingWeight - allocatedWeight,
        remainingVolumeCubicMeters: cand.remainingVolume - allocatedVolume
      });

      remainingToAllocate -= allocatedQty;
    }

    if (remainingToAllocate > 0) {
      throw new Error(`Insufficient warehouse capacity to put away the entire quantity of ${quantity} units for SKU ${sku.value}.`);
    }

    return recommendations;
  }
}
