import { PutawaySuggester, PutawayRecommendation } from '../../domain/services/PutawaySuggester';
import { PickingRouteOptimizer, PickItemInput, PickRoute } from '../../domain/services/PickingRouteOptimizer';
import { Sku } from '../../domain/valueObjects/Sku';

export class GetPutawayRecommendationsUseCase {
  constructor(private readonly putawaySuggester: PutawaySuggester) {}

  async execute(sku: string, quantity: number): Promise<PutawayRecommendation[]> {
    const skuObj = new Sku(sku);
    return await this.putawaySuggester.suggestPutaway(skuObj, quantity);
  }
}

export class OptimizePickingRouteUseCase {
  constructor(private readonly pickingRouteOptimizer: PickingRouteOptimizer) {}

  async execute(tenantId: string, items: PickItemInput[]): Promise<PickRoute[]> {
    // If tenant verification is needed, it can be added here or enforced by the GraphQL API gateway.
    return await this.pickingRouteOptimizer.optimizeRoute(items);
  }
}
