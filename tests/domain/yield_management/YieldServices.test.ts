import { MarkdownStatus } from '../../../src/domain/yield_management/YieldEntities';
import { YieldCalculationService, DynamicPricingEngine } from '../../../src/domain/yield_management/YieldServices';

describe('Yield Services', () => {
  it('YieldCalculationService calculates correct price', () => {
    const calc = new YieldCalculationService();
    const profile = { sku: "SKU1", basePriceCents: 10000, holdingCostPerDayCents: 10, minFloorPriceCents: 5000 };
    
    const metrics1 = { sku: "SKU1", daysInInventory: 100, daysUntilExpiration: 100, historicalDailyDemand: 5.0, currentStockQuantity: 500 };
    expect(calc.calculateOptimalPrice(metrics1, profile)).toBe(9000);
    
    const metrics2 = { sku: "SKU1", daysInInventory: 100, daysUntilExpiration: 10, historicalDailyDemand: 2.0, currentStockQuantity: 500 };
    expect(calc.calculateOptimalPrice(metrics2, profile)).toBe(5000);
  });

  it('DynamicPricingEngine generates recommendations', () => {
    const calc = new YieldCalculationService();
    const engine = new DynamicPricingEngine(calc);
    
    const profile = { sku: "SKU1", basePriceCents: 10000, holdingCostPerDayCents: 10, minFloorPriceCents: 5000 };
    const metrics = { sku: "SKU1", daysInInventory: 100, daysUntilExpiration: 10, historicalDailyDemand: 2.0, currentStockQuantity: 500 };
    
    const rec = engine.generateMarkdown(metrics, profile);
    expect(rec).not.toBeNull();
    expect(rec?.recommendedPriceCents).toBe(5000);
    expect(rec?.status).toBe(MarkdownStatus.PROPOSED);
    
    rec?.approve();
    expect(rec?.status).toBe(MarkdownStatus.APPROVED);
    
    rec?.pushToChannels();
    expect(rec?.status).toBe(MarkdownStatus.PUSHED_TO_CHANNELS);
  });
});
