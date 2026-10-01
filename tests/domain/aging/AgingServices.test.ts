import { AgingBucket, RecommendedAction } from '../../../src/domain/aging/AgingEntities';
import { InventoryAgingService, DeadStockRecommendationEngine, EsgEmissionsCalculator } from '../../../src/domain/aging/AgingServices';

describe('Aging Services', () => {
  it('InventoryAgingService calculates correct bucket', () => {
    const service = new InventoryAgingService();
    const now = new Date();
    
    const entries = [
      { quantity: 10, occurredAt: new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000) },
      { quantity: 5, occurredAt: new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000) }
    ];
    
    const result = service.calculateAgingBuckets('SKU1', 'LOC1', 'T1', now, entries);
    expect(result.daysSinceLastMovement).toBe(100);
    expect(result.bucket).toBe(AgingBucket.DAYS_91_180);
  });

  it('DeadStockRecommendationEngine gives correct recommendations', () => {
    const engine = new DeadStockRecommendationEngine();
    
    // 200 days old -> Liquidate
    const r1 = engine.analyze('SKU1', 'L1', 'T1', 50, 100, 200, AgingBucket.OVER_180_DAYS, false);
    expect(r1.isDeadStock).toBe(true);
    expect(r1.recommendedAction).toBe(RecommendedAction.LIQUIDATE);
    expect(r1.lockedCapitalCents).toBe(5000);
    
    // 200 days old but few items -> Donate
    const r2 = engine.analyze('SKU1', 'L1', 'T1', 5, 100, 200, AgingBucket.OVER_180_DAYS, false);
    expect(r2.recommendedAction).toBe(RecommendedAction.DONATE);

    // 100 days old + overstock -> Markdown
    const r3 = engine.analyze('SKU1', 'L1', 'T1', 50, 100, 100, AgingBucket.DAYS_91_180, true);
    expect(r3.isDeadStock).toBe(false);
    expect(r3.recommendedAction).toBe(RecommendedAction.MARKDOWN);
  });

  it('EsgEmissionsCalculator calculates correct emissions', () => {
    const calc = new EsgEmissionsCalculator();
    expect(calc.calculateScrapEmissions('SKU1', 10, 2.5)).toBe(25.0);
  });
});
