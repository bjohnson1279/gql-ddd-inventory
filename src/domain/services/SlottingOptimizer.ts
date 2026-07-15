import { PrismaClient } from '@prisma/client';

export interface SlottingSuggestion {
  sku: string;
  currentLocationId: string;
  currentDistance: number;
  currentVelocity: number;
  recommendedLocationId: string;
  recommendedDistance: number;
  potentialSwapSku?: string;
  estimatedSavings: number;
}

export class SlottingOptimizer {
  constructor(private readonly prisma: PrismaClient) {}

  async generateSuggestions(): Promise<SlottingSuggestion[]> {
    // 1. Fetch all locations
    const locations = await this.prisma.warehouseLocation.findMany();
    if (locations.length === 0) return [];

    // Map distances to (0,0)
    const locDistanceMap = new Map<string, number>();
    for (const loc of locations) {
      const dist = Math.abs(loc.gridX) + Math.abs(loc.gridY);
      locDistanceMap.set(loc.id, dist);
    }

    // 2. Fetch all ledger entries in the last 30 days to calculate velocity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        occurredAt: { gte: thirtyDaysAgo }
      },
      include: {
        variant: true
      }
    });

    const velocities = new Map<string, number>(); // key: sku_locationId, value: sum
    for (const e of entries) {
      const sku = e.variant?.sku;
      if (!sku) continue;
      const key = `${sku}_${e.locationId}`;
      velocities.set(key, (velocities.get(key) || 0) + Math.abs(e.quantity));
    }

    // 3. Fetch current inventory allocations
    const items = await this.prisma.inventoryItem.findMany();
    if (items.length === 0) return [];

    // Map current items with their velocities and distances
    const itemRecords = items.map(item => {
      const key = `${item.sku}_${item.locationId}`;
      const velocity = velocities.get(key) || 0;
      const distance = locDistanceMap.get(item.locationId) ?? 9999;
      return {
        sku: item.sku,
        locationId: item.locationId,
        velocity,
        distance
      };
    });

    // Sort items by velocity descending
    itemRecords.sort((a, b) => b.velocity - a.velocity);

    const suggestions: SlottingSuggestion[] = [];
    const matchedLocations = new Set<string>();

    for (const item of itemRecords) {
      if (item.velocity === 0) continue;
      if (matchedLocations.has(item.locationId)) continue;

      // Find an occupied location with lower velocity that is closer to (0,0)
      let bestSwapTarget: typeof itemRecords[0] | null = null;
      let maxDistanceDiff = 0;

      for (const target of itemRecords) {
        if (target.locationId === item.locationId) continue;
        if (matchedLocations.has(target.locationId)) continue;
        
        // Target must be closer to (0,0) than the current item location
        if (target.distance < item.distance) {
          // Target velocity must be lower
          if (target.velocity < item.velocity) {
            const distanceDiff = item.distance - target.distance;
            if (distanceDiff > maxDistanceDiff) {
              maxDistanceDiff = distanceDiff;
              bestSwapTarget = target;
            }
          }
        }
      }

      if (bestSwapTarget) {
        const travelSavings = item.velocity * maxDistanceDiff * 2;

        suggestions.push({
          sku: item.sku,
          currentLocationId: item.locationId,
          currentDistance: item.distance,
          currentVelocity: item.velocity,
          recommendedLocationId: bestSwapTarget.locationId,
          recommendedDistance: bestSwapTarget.distance,
          potentialSwapSku: bestSwapTarget.sku,
          estimatedSavings: travelSavings
        });

        matchedLocations.add(item.locationId);
        matchedLocations.add(bestSwapTarget.locationId);
      }
    }

    return suggestions.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
  }
}
