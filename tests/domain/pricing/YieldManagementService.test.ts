import { YieldManagementService, YieldManagementRepository } from '../../../src/domain/pricing/YieldManagementService';
import { LiquidationRule } from '../../../src/domain/pricing/LiquidationRule';
import { MarkdownEvent } from '../../../src/domain/pricing/MarkdownEvent';

describe('YieldManagementService', () => {
  const tenantId = 'tenant-test-123';

  it('returns empty events when no active rules exist', async () => {
    const repo: YieldManagementRepository = {
      getActiveRules: jest.fn().mockResolvedValue([]),
      getLotsExpiringWithin: jest.fn(),
      updateVariantPrice: jest.fn(),
      saveMarkdownEvent: jest.fn(),
    };

    const service = new YieldManagementService(repo);
    const result = await service.runYieldOptimization(tenantId);

    expect(result).toEqual([]);
    expect(repo.getLotsExpiringWithin).not.toHaveBeenCalled();
    expect(repo.updateVariantPrice).not.toHaveBeenCalled();
    expect(repo.saveMarkdownEvent).not.toHaveBeenCalled();
  });

  it('calculates correct markdown prices and creates events for expiring lots', async () => {
    const rules = [
      new LiquidationRule('rule-1', tenantId, 10, 25, true),
      new LiquidationRule('rule-2', tenantId, 30, 50, true),
    ];
    const expiringLots = [
      { variantId: 'var-1', currentPriceCents: 10000 },
      { variantId: 'var-2', currentPriceCents: 2000 },
    ];

    const repo: YieldManagementRepository = {
      getActiveRules: jest.fn().mockResolvedValue(rules),
      getLotsExpiringWithin: jest.fn().mockResolvedValue(expiringLots),
      updateVariantPrice: jest.fn().mockResolvedValue(undefined),
      saveMarkdownEvent: jest.fn().mockResolvedValue(undefined),
    };

    const service = new YieldManagementService(repo);
    const events = await service.runYieldOptimization(tenantId);

    expect(repo.getLotsExpiringWithin).toHaveBeenCalledWith(tenantId, 30);
    expect(events).toHaveLength(2);

    expect(events[0].variantId).toBe('var-1');
    expect(events[0].originalPriceCents).toBe(10000);
    expect(events[0].newPriceCents).toBe(7500); // 10000 * (1 - 0.25)
    expect(events[0].ruleId).toBe('rule-1');

    expect(events[1].variantId).toBe('var-2');
    expect(events[1].originalPriceCents).toBe(2000);
    expect(events[1].newPriceCents).toBe(1500); // 2000 * (1 - 0.25)
    expect(events[1].ruleId).toBe('rule-1');
  });

  it('falls back to individual repository methods when batch methods are absent', async () => {
    const rules = [new LiquidationRule('rule-1', tenantId, 15, 10, true)];
    const expiringLots = [
      { variantId: 'var-1', currentPriceCents: 5000 },
      { variantId: 'var-2', currentPriceCents: 8000 },
    ];

    const repo: YieldManagementRepository = {
      getActiveRules: jest.fn().mockResolvedValue(rules),
      getLotsExpiringWithin: jest.fn().mockResolvedValue(expiringLots),
      updateVariantPrice: jest.fn().mockResolvedValue(undefined),
      saveMarkdownEvent: jest.fn().mockResolvedValue(undefined),
    };

    const service = new YieldManagementService(repo);
    const events = await service.runYieldOptimization(tenantId);

    expect(events).toHaveLength(2);
    expect(repo.updateVariantPrice).toHaveBeenCalledTimes(2);
    expect(repo.updateVariantPrice).toHaveBeenNthCalledWith(1, tenantId, 'var-1', 4500);
    expect(repo.updateVariantPrice).toHaveBeenNthCalledWith(2, tenantId, 'var-2', 7200);

    expect(repo.saveMarkdownEvent).toHaveBeenCalledTimes(2);
    expect(repo.saveMarkdownEvent).toHaveBeenNthCalledWith(1, events[0]);
    expect(repo.saveMarkdownEvent).toHaveBeenNthCalledWith(2, events[1]);
  });

  it('uses batch methods when updateVariantPrices and saveMarkdownEvents are implemented', async () => {
    const rules = [new LiquidationRule('rule-1', tenantId, 15, 10, true)];
    const expiringLots = [
      { variantId: 'var-1', currentPriceCents: 5000 },
      { variantId: 'var-2', currentPriceCents: 8000 },
    ];

    const repo: YieldManagementRepository = {
      getActiveRules: jest.fn().mockResolvedValue(rules),
      getLotsExpiringWithin: jest.fn().mockResolvedValue(expiringLots),
      updateVariantPrice: jest.fn().mockResolvedValue(undefined),
      saveMarkdownEvent: jest.fn().mockResolvedValue(undefined),
      updateVariantPrices: jest.fn().mockResolvedValue(undefined),
      saveMarkdownEvents: jest.fn().mockResolvedValue(undefined),
    };

    const service = new YieldManagementService(repo);
    const events = await service.runYieldOptimization(tenantId);

    expect(events).toHaveLength(2);
    expect(repo.updateVariantPrices).toHaveBeenCalledTimes(1);
    expect(repo.updateVariantPrices).toHaveBeenCalledWith(tenantId, [
      { variantId: 'var-1', newPriceCents: 4500 },
      { variantId: 'var-2', newPriceCents: 7200 },
    ]);

    expect(repo.saveMarkdownEvents).toHaveBeenCalledTimes(1);
    expect(repo.saveMarkdownEvents).toHaveBeenCalledWith(events);

    expect(repo.updateVariantPrice).not.toHaveBeenCalled();
    expect(repo.saveMarkdownEvent).not.toHaveBeenCalled();
  });
});
