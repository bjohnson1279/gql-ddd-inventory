import { ReplenishmentEvaluator } from '../../../src/domain/services/ReplenishmentEvaluator';
import { IReplenishmentRuleRepository } from '../../../src/domain/repositories/IReplenishmentRuleRepository';
import { IInventoryRepository } from '../../../src/domain/repositories/IInventoryRepository';
import { IProductRepository } from '../../../src/domain/repositories/IProductRepository';
import { IStockTransferRepository } from '../../../src/domain/repositories/IStockTransferRepository';
import { IPurchaseOrderRepository } from '../../../src/domain/repositories/IPurchaseOrderRepository';
import { ReorderPointForecaster } from '../../../src/domain/services/ReplenishmentForecaster';
import { ReplenishmentRule } from '../../../src/domain/entities/ReplenishmentRule';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';

describe('ReplenishmentEvaluator', () => {
  let evaluator: ReplenishmentEvaluator;
  let mockRuleRepo: jest.Mocked<IReplenishmentRuleRepository>;
  let mockInventoryRepo: jest.Mocked<IInventoryRepository>;
  let mockProductRepo: jest.Mocked<IProductRepository>;
  let mockTransferRepo: jest.Mocked<IStockTransferRepository>;
  let mockPoRepo: jest.Mocked<IPurchaseOrderRepository>;
  let mockForecaster: jest.Mocked<ReorderPointForecaster>;

  beforeEach(() => {
    mockRuleRepo = {
      findAllByTenant: jest.fn(),
    } as any;
    mockInventoryRepo = {
      findBySkuAndLocationBatch: jest.fn(),
    } as any;
    mockProductRepo = {
      findBySkus: jest.fn(),
    } as any;
    mockTransferRepo = {
      findAllByTenant: jest.fn(),
    } as any;
    mockPoRepo = {
      findAllByTenant: jest.fn(),
    } as any;
    mockForecaster = {
      forecastReorderPoint: jest.fn(),
    } as any;

    evaluator = new ReplenishmentEvaluator(
      mockRuleRepo,
      mockInventoryRepo,
      mockProductRepo,
      mockTransferRepo,
      mockPoRepo,
      mockForecaster
    );
  });

  describe('evaluateRulesForTenant', () => {
    it('should catch errors thrown during rule evaluation and return a failed result', async () => {
      const tenantId = { value: 'tenant-1' } as unknown as TenantId;
      const rule = {
        id: { value: 'rule-1' },
        sku: { value: 'SKU-1' } as unknown as Sku,
        locationId: { value: 'loc-1' } as unknown as LocationId,
        reorderPoint: 20,
        isActive: true, // Needed for the filter active rules check
        dynamicRopEnabled: true, // Triggers forecaster
      } as unknown as ReplenishmentRule;

      mockRuleRepo.findAllByTenant.mockResolvedValue([rule]);
      mockPoRepo.findAllByTenant.mockResolvedValue([]);
      mockTransferRepo.findAllByTenant.mockResolvedValue([]);
      mockInventoryRepo.findBySkuAndLocationBatch.mockResolvedValue([]);
      mockProductRepo.findBySkus.mockResolvedValue([]);

      const error = new Error('Test Error');
      mockForecaster.forecastReorderPoint.mockRejectedValue(error);

      const results = await evaluator.evaluateRulesForTenant(tenantId);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        ruleId: 'rule-1',
        sku: 'SKU-1',
        locationId: 'loc-1',
        triggered: false,
        reason: 'Failed to evaluate rule: Test Error',
        reorderPoint: 20,
        inventoryPosition: 0,
      });
    });
  });
});
