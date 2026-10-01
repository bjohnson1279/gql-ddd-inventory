import { ScheduleStatus } from '../../../src/domain/labor/LaborEntities';
import { OperatorPerformanceService, PredictiveSchedulingEngine } from '../../../src/domain/labor/LaborServices';

describe('Labor Services', () => {
  it('OperatorPerformanceService calculates KPIs', () => {
    const service = new OperatorPerformanceService();
    
    const kpi = service.calculateDailyKpi("OP1", new Date(), 800, 8.0, 48, 50, 15000.0);
    expect(kpi.actualPicksPerHour).toBe(100.0);
    expect(kpi.cycleCountAccuracyPercent).toBe(96.0);
  });

  it('PredictiveSchedulingEngine calculates headcount', () => {
    const engine = new PredictiveSchedulingEngine();
    
    const schedule = engine.generateStaffingRecommendation(new Date(), 2000, 6000, 100.0, 8.0);
    expect(schedule.recommendedHeadcount).toBe(10);
    expect(schedule.status).toBe(ScheduleStatus.DRAFT);
    
    schedule.publish();
    expect(schedule.status).toBe(ScheduleStatus.PUBLISHED);
  });
});
