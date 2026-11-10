import { MarkdownStatus } from '../../../src/domain/yield_management/YieldEntities';
import { YieldCalculationService, DynamicPricingEngine } from '../../../src/domain/yield_management/YieldServices';

describe('Yield Services', () => {
  describe('YieldCalculationService', () => {
    it('calculates price reduced by accrued holding cost', () => {
      const calc = new YieldCalculationService();
      const profile = { sku: "SKU1", basePriceCents: 10000, holdingCostPerDayCents: 10, minFloorPriceCents: 5000 };
      const metrics = { sku: "SKU1", daysInInventory: 100, daysUntilExpiration: 100, historicalDailyDemand: 5.0, currentStockQuantity: 500 };
      expect(calc.calculateOptimalPrice(metrics, profile)).toBe(9000);
    });

    it('clamps to minFloorPriceCents when accrued holding cost exceeds floor threshold', () => {
      const calc = new YieldCalculationService();
      const profile = { sku: "SKU1", basePriceCents: 10000, holdingCostPerDayCents: 100, minFloorPriceCents: 5000 };
      const metrics = { sku: "SKU1", daysInInventory: 100, daysUntilExpiration: 100, historicalDailyDemand: 5.0, currentStockQuantity: 500 };
      expect(calc.calculateOptimalPrice(metrics, profile)).toBe(5000);
    });

    it('retains basePriceCents when days in inventory is zero', () => {
      const calc = new YieldCalculationService();
      const profile = { sku: "SKU1", basePriceCents: 10000, holdingCostPerDayCents: 20, minFloorPriceCents: 4000 };
      const metrics = { sku: "SKU1", daysInInventory: 0, daysUntilExpiration: 90, historicalDailyDemand: 1.0, currentStockQuantity: 50 };
      expect(calc.calculateOptimalPrice(metrics, profile)).toBe(10000);
    });

    it('sets price to minFloorPriceCents when approaching expiration with excess stock', () => {
      const calc = new YieldCalculationService();
      const profile = { sku: "SKU1", basePriceCents: 10000, holdingCostPerDayCents: 10, minFloorPriceCents: 5000 };
      const metrics = { sku: "SKU1", daysInInventory: 10, daysUntilExpiration: 10, historicalDailyDemand: 2.0, currentStockQuantity: 500 };
      expect(calc.calculateOptimalPrice(metrics, profile)).toBe(5000);
    });

    it('does not clamp to minFloorPriceCents if stock does not exceed expected sales near expiration', () => {
      const calc = new YieldCalculationService();
      const profile = { sku: "SKU1", basePriceCents: 10000, holdingCostPerDayCents: 10, minFloorPriceCents: 5000 };
      // daysUntilExpiration = 10, historicalDailyDemand = 5.0 -> expectedSales = 50. stock is 40 (not > 50).
      // holding cost: 10 * 10 = 100. currentPrice: 10000 - 100 = 9900.
      const metrics = { sku: "SKU1", daysInInventory: 10, daysUntilExpiration: 10, historicalDailyDemand: 5.0, currentStockQuantity: 40 };
      expect(calc.calculateOptimalPrice(metrics, profile)).toBe(9900);
    });

    it('handles daysUntilExpiration being null gracefully without triggering expiration discounting', () => {
      const calc = new YieldCalculationService();
      const profile = { sku: "SKU1", basePriceCents: 10000, holdingCostPerDayCents: 10, minFloorPriceCents: 5000 };
      const metrics = { sku: "SKU1", daysInInventory: 50, daysUntilExpiration: null, historicalDailyDemand: 2.0, currentStockQuantity: 1000 };
      expect(calc.calculateOptimalPrice(metrics, profile)).toBe(9500);
    });
  });

  describe('DynamicPricingEngine', () => {
    it('returns null when optimal price equals base price', () => {
      const calc = new YieldCalculationService();
      const engine = new DynamicPricingEngine(calc);
      const profile = { sku: "SKU1", basePriceCents: 10000, holdingCostPerDayCents: 10, minFloorPriceCents: 5000 };
      const metrics = { sku: "SKU1", daysInInventory: 0, daysUntilExpiration: null, historicalDailyDemand: 1.0, currentStockQuantity: 10 };

      const rec = engine.generateMarkdown(metrics, profile);
      expect(rec).toBeNull();
    });

    it('generates recommendation with reasoning "Accrued holding costs" when discounted solely by holding costs', () => {
      const calc = new YieldCalculationService();
      const engine = new DynamicPricingEngine(calc);
      const profile = { sku: "SKU1", basePriceCents: 10000, holdingCostPerDayCents: 10, minFloorPriceCents: 5000 };
      const metrics = { sku: "SKU1", daysInInventory: 100, daysUntilExpiration: 100, historicalDailyDemand: 5.0, currentStockQuantity: 500 };

      const rec = engine.generateMarkdown(metrics, profile);
      expect(rec).not.toBeNull();
      expect(rec?.sku).toBe("SKU1");
      expect(rec?.recommendedPriceCents).toBe(9000);
      expect(rec?.reasoning).toBe("Accrued holding costs");
      expect(rec?.status).toBe(MarkdownStatus.PROPOSED);
    });

    it('generates recommendation with reasoning "Approaching Expiration - High Overstock" when reduced to floor price near expiration', () => {
      const calc = new YieldCalculationService();
      const engine = new DynamicPricingEngine(calc);
      const profile = { sku: "SKU1", basePriceCents: 10000, holdingCostPerDayCents: 10, minFloorPriceCents: 5000 };
      const metrics = { sku: "SKU1", daysInInventory: 10, daysUntilExpiration: 10, historicalDailyDemand: 2.0, currentStockQuantity: 500 };

      const rec = engine.generateMarkdown(metrics, profile);
      expect(rec).not.toBeNull();
      expect(rec?.sku).toBe("SKU1");
      expect(rec?.recommendedPriceCents).toBe(5000);
      expect(rec?.reasoning).toBe("Approaching Expiration - High Overstock");
      expect(rec?.status).toBe(MarkdownStatus.PROPOSED);
    });
  });

  describe('PriceMarkdownRecommendation', () => {
    it('progresses status from PROPOSED to APPROVED to PUSHED_TO_CHANNELS', () => {
      const calc = new YieldCalculationService();
      const engine = new DynamicPricingEngine(calc);
      const profile = { sku: "SKU1", basePriceCents: 10000, holdingCostPerDayCents: 10, minFloorPriceCents: 5000 };
      const metrics = { sku: "SKU1", daysInInventory: 100, daysUntilExpiration: 10, historicalDailyDemand: 2.0, currentStockQuantity: 500 };

      const rec = engine.generateMarkdown(metrics, profile);
      expect(rec).not.toBeNull();
      expect(rec?.status).toBe(MarkdownStatus.PROPOSED);

      rec?.approve();
      expect(rec?.status).toBe(MarkdownStatus.APPROVED);

      rec?.pushToChannels();
      expect(rec?.status).toBe(MarkdownStatus.PUSHED_TO_CHANNELS);
    });

    it('throws error when approving non-PROPOSED recommendation', () => {
      const calc = new YieldCalculationService();
      const engine = new DynamicPricingEngine(calc);
      const profile = { sku: "SKU1", basePriceCents: 10000, holdingCostPerDayCents: 10, minFloorPriceCents: 5000 };
      const metrics = { sku: "SKU1", daysInInventory: 100, daysUntilExpiration: 10, historicalDailyDemand: 2.0, currentStockQuantity: 500 };

      const rec = engine.generateMarkdown(metrics, profile);
      expect(rec).not.toBeNull();
      rec?.approve();

      expect(() => rec?.approve()).toThrow("Can only approve PROPOSED markdowns");
    });

    it('throws error when pushing to channels from non-APPROVED status', () => {
      const calc = new YieldCalculationService();
      const engine = new DynamicPricingEngine(calc);
      const profile = { sku: "SKU1", basePriceCents: 10000, holdingCostPerDayCents: 10, minFloorPriceCents: 5000 };
      const metrics = { sku: "SKU1", daysInInventory: 100, daysUntilExpiration: 10, historicalDailyDemand: 2.0, currentStockQuantity: 500 };

      const rec = engine.generateMarkdown(metrics, profile);
      expect(rec).not.toBeNull();

      expect(() => rec?.pushToChannels()).toThrow("Can only push APPROVED markdowns");
    });
  });
});
