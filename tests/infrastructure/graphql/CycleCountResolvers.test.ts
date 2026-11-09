import { cycleCountResolvers } from '../../../src/infrastructure/graphql/cycleCountResolvers';

describe('cycleCountResolvers', () => {
  const validContext = { auth: { actorId: 'operator-1', tenantId: 'tenant-1', roles: ['warehouse_operator'] } };

  it('should get assigned cycle counts and mask blind counts', () => {
    const result = cycleCountResolvers.Query.getAssignedCycleCounts(null, { operatorId: 'operator-1' }, validContext);
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
    }, validContext);
    
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
    }, validContext);
    
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].status).toBe('RECOUNT_REQUIRED');
  });

  it('should throw authentication error when auth context is missing', () => {
    expect(() => {
      cycleCountResolvers.Query.getAssignedCycleCounts(null, { operatorId: 'operator-1' }, {});
    }).toThrow('Authentication required: Access token is missing or invalid.');
  });

  it('should throw unauthorized error when tenantId is missing from auth context', () => {
    expect(() => {
      cycleCountResolvers.Query.getAssignedCycleCounts(null, { operatorId: 'operator-1' }, { auth: { actorId: 'operator-1' } });
    }).toThrow('Unauthorized: Tenant identification missing from context.');
  });

  it('should reject submitCycleCount for a cycle count belonging to another tenant (IDOR prevention)', () => {
    const crossTenantContext = { auth: { actorId: 'operator-1', tenantId: 'tenant-2', roles: ['warehouse_operator'] } };
    expect(() => {
      cycleCountResolvers.Mutation.submitCycleCount(null, {
        cycleCountId: 'cc-123',
        items: [{ sku: 'SKU-1', countedQuantity: 10 }]
      }, crossTenantContext);
    }).toThrow('Cycle count not found or access denied');
  });

  it('should reject syncOfflineCycleCounts for a cycle count belonging to another tenant (IDOR prevention)', () => {
    const crossTenantContext = { auth: { actorId: 'operator-1', tenantId: 'tenant-2', roles: ['warehouse_operator'] } };
    const results = cycleCountResolvers.Mutation.syncOfflineCycleCounts(null, {
      submissions: [
        {
          cycleCountId: 'cc-456',
          items: [{ sku: 'SKU-2', countedQuantity: 5 }]
        }
      ]
    }, crossTenantContext);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].status).toBe('NOT_FOUND');
  });
});
