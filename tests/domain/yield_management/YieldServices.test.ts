import { MarkdownStatus, PriceMarkdownRecommendation } from '../../../src/domain/yield_management/YieldEntities';
import { YieldCalculationService, DynamicPricingEngine } from '../../../src/domain/yield_management/YieldServices';

describe('Yield Services', () => {
  describe('YieldCalculationService', () => {
    const calc = new YieldCalculationService();
    const profile = { sku: 'SKU1', basePriceCents: 10000, holdingCostPerDayCents: 10, minFloorPriceCents: 5000 };

    it('calculates optimal price by deducting accrued holding costs', () => {
      const metrics = { sku: 'SKU1', daysInInventory: 100, daysUntilExpiration: 100, historicalDailyDemand: 5.0, currentStockQuantity: 500 };
      expect(calc.calculateOptimalPrice(metrics, profile)).toBe(9000);
    });

    it('returns base price when item has zero days in inventory', () => {
      const metrics = { sku: 'SKU1', daysInInventory: 0, daysUntilExpiration: 100, historicalDailyDemand: 5.0, currentStockQuantity: 500 };
      expect(calc.calculateOptimalPrice(metrics, profile)).toBe(10000);
    });

    it('clamps optimal price to minimum floor price when holding cost exceeds allowed discount', () => {
      const metrics = { sku: 'SKU1', daysInInventory: 800, daysUntilExpiration: 100, historicalDailyDemand: 5.0, currentStockQuantity: 500 };
      expect(calc.calculateOptimalPrice(metrics, profile)).toBe(5000);
    });

    it('ignores expiration logic when daysUntilExpiration is null', () => {
      const metrics = { sku: 'SKU1', daysInInventory: 50, daysUntilExpiration: null, historicalDailyDemand: 2.0, currentStockQuantity: 500 };
      expect(calc.calculateOptimalPrice(metrics, profile)).toBe(9500);
    });

    it('ignores expiration logic when daysUntilExpiration is greater than or equal to 14', () => {
      const metrics = { sku: 'SKU1', daysInInventory: 50, daysUntilExpiration: 14, historicalDailyDemand: 2.0, currentStockQuantity: 500 };
      expect(calc.calculateOptimalPrice(metrics, profile)).toBe(9500);
    });

    it('reduces price to minFloorPriceCents when expiring soon and stock exceeds expected sales', () => {
      const metrics = { sku: 'SKU1', daysInInventory: 10, daysUntilExpiration: 10, historicalDailyDemand: 2.0, currentStockQuantity: 500 };
      expect(calc.calculateOptimalPrice(metrics, profile)).toBe(5000);
    });

    it('does not reduce price to minFloorPriceCents when expiring soon if stock does not exceed expected sales', () => {
      const metrics = { sku: 'SKU1', daysInInventory: 10, daysUntilExpiration: 10, historicalDailyDemand: 50.0, currentStockQuantity: 500 };
      expect(calc.calculateOptimalPrice(metrics, profile)).toBe(9900);
    });
  });

  describe('DynamicPricingEngine', () => {
    const calc = new YieldCalculationService();
    const engine = new DynamicPricingEngine(calc);
    const profile = { sku: 'SKU1', basePriceCents: 10000, holdingCostPerDayCents: 10, minFloorPriceCents: 5000 };

    it('returns null when optimal price equals or exceeds base price', () => {
      const metrics = { sku: 'SKU1', daysInInventory: 0, daysUntilExpiration: 100, historicalDailyDemand: 5.0, currentStockQuantity: 100 };
      expect(engine.generateMarkdown(metrics, profile)).toBeNull();
    });

    it('generates markdown recommendation with Accrued holding costs reasoning', () => {
      const metrics = { sku: 'SKU1', daysInInventory: 100, daysUntilExpiration: 100, historicalDailyDemand: 5.0, currentStockQuantity: 500 };
      const rec = engine.generateMarkdown(metrics, profile);
      expect(rec).not.toBeNull();
      expect(rec?.sku).toBe('SKU1');
      expect(rec?.recommendedPriceCents).toBe(9000);
      expect(rec?.reasoning).toBe('Accrued holding costs');
      expect(rec?.status).toBe(MarkdownStatus.PROPOSED);
      expect(typeof rec?.id).toBe('string');
      expect(rec?.id.length).toBeGreaterThan(0);
    });

    it('generates markdown recommendation with Approaching Expiration reasoning when overstocked and expiring soon', () => {
      const metrics = { sku: 'SKU1', daysInInventory: 100, daysUntilExpiration: 10, historicalDailyDemand: 2.0, currentStockQuantity: 500 };
      const rec = engine.generateMarkdown(metrics, profile);
      expect(rec).not.toBeNull();
      expect(rec?.recommendedPriceCents).toBe(5000);
      expect(rec?.reasoning).toBe('Approaching Expiration - High Overstock');
      expect(rec?.status).toBe(MarkdownStatus.PROPOSED);
    });
  });

  describe('PriceMarkdownRecommendation', () => {
    it('approves a proposed markdown successfully', () => {
      const rec = new PriceMarkdownRecommendation('test-id', 'SKU1', 5000, 'Test reasoning');
      expect(rec.status).toBe(MarkdownStatus.PROPOSED);
      rec.approve();
      expect(rec.status).toBe(MarkdownStatus.APPROVED);
    });

    it('throws error when approving non-proposed markdown', () => {
      const rec = new PriceMarkdownRecommendation('test-id', 'SKU1', 5000, 'Test reasoning', MarkdownStatus.APPROVED);
      expect(() => rec.approve()).toThrow('Can only approve PROPOSED markdowns');
    });

    it('pushes an approved markdown to channels successfully', () => {
      const rec = new PriceMarkdownRecommendation('test-id', 'SKU1', 5000, 'Test reasoning', MarkdownStatus.APPROVED);
      rec.pushToChannels();
      expect(rec.status).toBe(MarkdownStatus.PUSHED_TO_CHANNELS);
    });

    it('throws error when pushing non-approved markdown to channels', () => {
      const rec = new PriceMarkdownRecommendation('test-id', 'SKU1', 5000, 'Test reasoning', MarkdownStatus.PROPOSED);
      expect(() => rec.pushToChannels()).toThrow('Can only push APPROVED markdowns');
    });
  });
});
