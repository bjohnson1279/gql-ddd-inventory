import { CycleCountExecutionService, CycleCountLineItem } from '../../../src/domain/cycleCount/CycleCountExecutionService';

describe('CycleCountExecutionService', () => {
  it('should return true and mark items as MATCHED if counts match perfectly', () => {
    const service = new CycleCountExecutionService();
    const items: CycleCountLineItem[] = [
      { id: '1', cycleCountId: 'cc-1', sku: 'A', expectedQuantity: 10, status: 'PENDING' }
    ];
    
    const submissions = [{ sku: 'A', countedQuantity: 10 }];
    const success = service.processSubmission(items, submissions);
    
    expect(success).toBe(true);
    expect(items[0].status).toBe('MATCHED');
    expect(items[0].varianceQuantity).toBe(0);
  });

  it('should flag recount and return false if variance exceeds threshold', () => {
    const service = new CycleCountExecutionService();
    const items: CycleCountLineItem[] = [
      { id: '1', cycleCountId: 'cc-1', sku: 'A', expectedQuantity: 100, status: 'PENDING' }
    ];
    
    // 90 counted, 100 expected => 10% variance (threshold default 5%)
    const submissions = [{ sku: 'A', countedQuantity: 90 }];
    const success = service.processSubmission(items, submissions);
    
    expect(success).toBe(false);
    expect(items[0].status).toBe('VARIANCE_FLAGGED');
    expect(items[0].varianceQuantity).toBe(-10);
  });

  it('should not flag recount if variance is within threshold', () => {
    const service = new CycleCountExecutionService();
    const items: CycleCountLineItem[] = [
      { id: '1', cycleCountId: 'cc-1', sku: 'A', expectedQuantity: 100, status: 'PENDING' }
    ];
    
    // 96 counted, 100 expected => 4% variance (threshold default 5%)
    const submissions = [{ sku: 'A', countedQuantity: 96 }];
    const success = service.processSubmission(items, submissions);
    
    expect(success).toBe(true);
    expect(items[0].status).toBe('MATCHED');
    expect(items[0].varianceQuantity).toBe(-4);
  });
});
