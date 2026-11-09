import { CycleCountExecutionService, CycleCountLineItem } from '../../domain/cycleCount/CycleCountExecutionService';
import { CycleCount } from '../../domain/cycleCount/CycleCount';

// In-memory mock for parity tests
let mockLineItems: CycleCountLineItem[] = [
  {
    id: 'li-1',
    cycleCountId: 'cc-123',
    sku: 'SKU-1',
    expectedQuantity: 10,
    status: 'PENDING'
  },
  {
    id: 'li-2',
    cycleCountId: 'cc-456',
    sku: 'SKU-2',
    expectedQuantity: 10,
    status: 'PENDING'
  }
];

let mockCycleCounts: CycleCount[] = [
  {
    id: 'cc-123',
    tenantId: 'tenant-1',
    name: 'Aisle A Count',
    status: 'PENDING',
    isBlindCount: true,
    assignedTo: 'operator-1',
    createdAt: new Date()
  },
  {
    id: 'cc-456',
    tenantId: 'tenant-1',
    name: 'Aisle B Count',
    status: 'PENDING',
    isBlindCount: false,
    assignedTo: 'operator-1',
    createdAt: new Date()
  }
];

function getCycleCountAuth(context: any): { operatorId?: string; tenantId: string } {
  const auth = context?.auth;
  if (!auth) {
    throw new Error('Authentication required: Access token is missing or invalid.');
  }
  const tenantId = auth.tenantId;
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant identification missing from context.');
  }
  const operatorId = auth.actorId || auth.userId || auth.operatorId;
  return { operatorId, tenantId };
}

export const cycleCountResolvers = {
  Query: {
    getAssignedCycleCounts: (_: any, { operatorId }: { operatorId: string }, context: any) => {
      const { tenantId } = getCycleCountAuth(context);
      const assigned = mockCycleCounts.filter(c => c.assignedTo === operatorId && c.tenantId === tenantId);
      
      // ⚡ Bolt: Group line items by cycleCountId in a single pass to eliminate O(N*M) nested iterations
      const itemsByCountId = new Map<string, typeof mockLineItems>();
      for (let i = 0; i < mockLineItems.length; i++) {
        const li = mockLineItems[i];
        let items = itemsByCountId.get(li.cycleCountId);
        if (!items) {
          items = [];
          itemsByCountId.set(li.cycleCountId, items);
        }
        items.push(li);
      }

      // Mask expectedQuantity if it's a blind count
      return assigned.map(cc => {
        const rawItems = itemsByCountId.get(cc.id) || [];
        const items = new Array(rawItems.length);
        for (let i = 0; i < rawItems.length; i++) {
          items[i] = {
            ...rawItems[i],
            expectedQuantity: cc.isBlindCount ? null : rawItems[i].expectedQuantity
          };
        }
        
        return {
          ...cc,
          createdAt: cc.createdAt.toISOString(),
          items
        };
      });
    }
  },
  Mutation: {
    submitCycleCount: (_: any, { cycleCountId, items }: { cycleCountId: string, items: { sku: string, countedQuantity: number }[] }, context: any) => {
      const { tenantId } = getCycleCountAuth(context);
      const cc = mockCycleCounts.find(c => c.id === cycleCountId && c.tenantId === tenantId);
      if (!cc) throw new Error('Cycle count not found or access denied');
      
      const ccItems = mockLineItems.filter(li => li.cycleCountId === cycleCountId);
      const service = new CycleCountExecutionService();
      
      const success = service.processSubmission(ccItems, items);
      
      if (success) {
        cc.status = 'COMPLETED';
      } else {
        cc.status = 'RECOUNT_REQUIRED' as any; // Cast for now
      }
      
      return {
        ...cc,
        createdAt: cc.createdAt.toISOString(),
        items: ccItems
      };
    },
    syncOfflineCycleCounts: (_: any, { submissions }: { submissions: { cycleCountId: string, items: { sku: string, countedQuantity: number }[] }[] }, context: any) => {
      const { tenantId } = getCycleCountAuth(context);
      const service = new CycleCountExecutionService();
      const results = [];
      
      for (const sub of submissions) {
        const cc = mockCycleCounts.find(c => c.id === sub.cycleCountId && c.tenantId === tenantId);
        if (!cc) {
          results.push({ cycleCountId: sub.cycleCountId, success: false, status: 'NOT_FOUND' });
          continue;
        }
        
        const ccItems = mockLineItems.filter(li => li.cycleCountId === sub.cycleCountId);
        const success = service.processSubmission(ccItems, sub.items);
        
        cc.status = success ? 'COMPLETED' : 'RECOUNT_REQUIRED' as any;
        results.push({ cycleCountId: sub.cycleCountId, success: true, status: cc.status });
      }
      
      return results;
    }
  }
};
