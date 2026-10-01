import { cycleCountResolvers } from '../../../src/infrastructure/graphql/cycleCountResolvers';

describe('cycleCountResolvers', () => {
  it('should get assigned cycle counts and mask blind counts', () => {
    const result = cycleCountResolvers.Query.getAssignedCycleCounts(null, { operatorId: 'operator-1' }, {});
    expect(result).toHaveLength(2);
    
    const blindCount = result.find(r => r.id === 'cc-123');
    expect(blindCount?.items[0].expectedQuantity).toBeNull();
    
    const nonBlindCount = result.find(r => r.id === 'cc-456');
    expect(nonBlindCount?.items[0].expectedQuantity).toBe(10);
  });

  it('should submit cycle count and resolve status correctly', () => {
    const result = cycleCountResolvers.Mutation.submitCycleCount(null, {
      cycleCountId: 'cc-123',
      items: [{ sku: 'SKU-1', countedQuantity: 10 }] // Perfect match
    });
    
    expect(result.status).toBe('COMPLETED');
    expect(result.items[0].status).toBe('MATCHED');
  });

  it('should submit offline cycle counts', () => {
    const results = cycleCountResolvers.Mutation.syncOfflineCycleCounts(null, {
      submissions: [
        {
          cycleCountId: 'cc-456',
          items: [{ sku: 'SKU-2', countedQuantity: 5 }] // 50% variance, recount required
        }
      ]
    });
    
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].status).toBe('RECOUNT_REQUIRED');
  });
});
