import { GetPutawayRecommendationsUseCase, OptimizePickingRouteUseCase } from '../../../src/application/useCases/ManageWarehouseRouting';
import { PutawaySuggester } from '../../../src/domain/services/PutawaySuggester';
import { PickingRouteOptimizer } from '../../../src/domain/services/PickingRouteOptimizer';
import { Sku } from '../../../src/domain/valueObjects/Sku';

describe('ManageWarehouseRouting Use Cases', () => {
  it('GetPutawayRecommendationsUseCase should delegate to PutawaySuggester', async () => {
    const mockSuggester = {
      suggestPutaway: jest.fn().mockResolvedValue([
        { locationId: 'LOC-A', quantity: 10, remainingWeightGrams: 100, remainingVolumeCubicMeters: 0.1 }
      ])
    } as unknown as PutawaySuggester;

    const useCase = new GetPutawayRecommendationsUseCase(mockSuggester);
    const result = await useCase.execute('SKU-123', 10);

    expect(mockSuggester.suggestPutaway).toHaveBeenCalledWith(new Sku('SKU-123'), 10);
    expect(result).toHaveLength(1);
    expect(result[0].locationId).toBe('LOC-A');
  });

  it('OptimizePickingRouteUseCase should delegate to PickingRouteOptimizer', async () => {
    const mockOptimizer = {
      optimizeRoute: jest.fn().mockResolvedValue([
        {
          warehouseId: 'WH1',
          items: [
            { sku: 'SKU-A', locationId: 'LOC-1', quantity: 5, warehouseId: 'WH1', zone: 'Z1', aisle: 'A01', rack: 'R1', shelf: 'S1', bin: 'B1' }
          ]
        }
      ])
    } as unknown as PickingRouteOptimizer;

    const useCase = new OptimizePickingRouteUseCase(mockOptimizer);
    const items = [{ sku: 'SKU-A', quantity: 5, locationId: 'LOC-1' }];
    const result = await useCase.execute('tenant-1', items);

    expect(mockOptimizer.optimizeRoute).toHaveBeenCalledWith(items);
    expect(result).toHaveLength(1);
    expect(result[0].warehouseId).toBe('WH1');
  });
});
