export interface LocationCoordinate {
  id: string;
  grid_x: number;
  grid_y: number;
  grid_z?: number;
}

export interface InventoryItemLocation {
  sku: string;
  location_id: string;
}

export interface DispatchRecord {
  sku: string;
  location_id: string;
  quantity: number;
  date: string;
}

export interface SlottingRecommendation {
  sku: string;
  currentLocationId: string;
  currentDistance: number;
  currentVelocity: number;
  recommendedLocationId: string;
  recommendedDistance: number;
  potentialSwapSku?: string;
  estimatedSavings: number;
}

export class SlottingOptimizerService {
  private sidecarUrl: string;

  constructor(sidecarUrl: string = process.env.PYTHON_SIDECAR_URL || 'http://localhost:8000') {
    this.sidecarUrl = sidecarUrl;
  }

  public async getSlottingOptimization(
    locations: LocationCoordinate[],
    inventory: InventoryItemLocation[],
    dispatches: DispatchRecord[]
  ): Promise<SlottingRecommendation[]> {
    try {
      const response = await fetch(`${this.sidecarUrl}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations, inventory, dispatches }),
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(`Sidecar HTTP error! status: ${response.status}`);
      }

      return (await response.json()) as SlottingRecommendation[];
    } catch (error) {
      console.warn('Python sidecar unavailable, fallback to local heuristic:', error);
      return this.fallbackLocalHeuristic(locations, inventory, dispatches);
    }
  }

  private fallbackLocalHeuristic(
    locations: LocationCoordinate[],
    inventory: InventoryItemLocation[],
    dispatches: DispatchRecord[]
  ): SlottingRecommendation[] {
    const suggestions: SlottingRecommendation[] = [];
    const locMap = new Map<string, number>();

    locations.forEach((loc) => {
      locMap.set(loc.id, Math.abs(loc.grid_x) + Math.abs(loc.grid_y) + (2 * Math.abs(loc.grid_z || 0)));
    });

    const velocities = new Map<string, number>();
    dispatches.forEach((d) => {
      const key = `${d.sku}:${d.location_id}`;
      velocities.set(key, (velocities.get(key) || 0) + Math.abs(d.quantity));
    });

    const items = inventory.map((inv) => ({
      sku: inv.sku,
      locationId: inv.location_id,
      velocity: velocities.get(`${inv.sku}:${inv.location_id}`) || 0,
      distance: locMap.get(inv.location_id) || 99,
    })).sort((a, b) => b.velocity - a.velocity);

    for (let i = 0; i < items.length; i++) {
      for (let j = items.length - 1; j > i; j--) {
        if (items[i].distance > items[j].distance && items[i].velocity > items[j].velocity) {
          const savings = items[i].velocity * (items[i].distance - items[j].distance) * 2;
          suggestions.push({
            sku: items[i].sku,
            currentLocationId: items[i].locationId,
            currentDistance: items[i].distance,
            currentVelocity: items[i].velocity,
            recommendedLocationId: items[j].locationId,
            recommendedDistance: items[j].distance,
            potentialSwapSku: items[j].sku,
            estimatedSavings: savings,
          });
          break;
        }
      }
    }

    return suggestions;
  }
}
