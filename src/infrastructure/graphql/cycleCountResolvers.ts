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

export const cycleCountResolvers = {
  Query: {
    getAssignedCycleCounts: (_: any, { operatorId }: { operatorId: string }, context: any) => {
      // In a real app we'd filter by context.tenantId as well
      const assigned = mockCycleCounts.filter(c => c.assignedTo === operatorId);
      
      // Mask expectedQuantity if it's a blind count
      return assigned.map(cc => {
        const items = mockLineItems.filter(li => li.cycleCountId === cc.id).map(li => ({
          ...li,
          expectedQuantity: cc.isBlindCount ? null : li.expectedQuantity
        }));
        
        return {
          ...cc,
          createdAt: cc.createdAt.toISOString(),
          items
        };
      });
    }
  },
  Mutation: {
    submitCycleCount: (_: any, { cycleCountId, items }: { cycleCountId: string, items: { sku: string, countedQuantity: number }[] }) => {
      const cc = mockCycleCounts.find(c => c.id === cycleCountId);
      if (!cc) throw new Error('Cycle count not found');
      
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
    syncOfflineCycleCounts: (_: any, { submissions }: { submissions: { cycleCountId: string, items: { sku: string, countedQuantity: number }[] }[] }) => {
      const service = new CycleCountExecutionService();
      const results = [];
      
      for (const sub of submissions) {
        const cc = mockCycleCounts.find(c => c.id === sub.cycleCountId);
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
