import { DemandForecaster } from '../../../src/domain/services/DemandForecaster';
import { IProductRepository } from '../../../src/domain/repositories/IProductRepository';
import { IInventoryRepository } from '../../../src/domain/repositories/IInventoryRepository';
import { ILedgerRepository } from '../../../src/domain/repositories/ILedgerRepository';
import { IReplenishmentRuleRepository } from '../../../src/domain/repositories/IReplenishmentRuleRepository';
import { IDemandForecastRepository } from '../../../src/domain/repositories/IDemandForecastRepository';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { ReasonCode } from '../../../src/domain/enums/ReasonCode';

describe('DemandForecaster', () => {
  const sku = new Sku('SKU-123');
  const locationId = new LocationId('LOC-1');

  let productRepoMock: jest.Mocked<IProductRepository>;
  let inventoryRepoMock: jest.Mocked<IInventoryRepository>;
  let ledgerRepoMock: jest.Mocked<ILedgerRepository>;
  let replenishmentRuleRepoMock: jest.Mocked<IReplenishmentRuleRepository>;
  let demandForecastRepoMock: jest.Mocked<IDemandForecastRepository>;
  let demandForecaster: DemandForecaster;

  beforeEach(() => {
    productRepoMock = {
      findBySku: jest.fn(),
      findBySkus: jest.fn(),
    } as unknown as jest.Mocked<IProductRepository>;

    inventoryRepoMock = {
      findBySkuAndLocation: jest.fn(),
      findByLocation: jest.fn(),
    } as unknown as jest.Mocked<IInventoryRepository>;

    ledgerRepoMock = {
      entriesFor: jest.fn(),
      entriesForBatch: jest.fn(),
    } as unknown as jest.Mocked<ILedgerRepository>;

    replenishmentRuleRepoMock = {
      findAllByLocation: jest.fn(),
    } as unknown as jest.Mocked<IReplenishmentRuleRepository>;

    demandForecastRepoMock = {
      save: jest.fn(),
      findAllForLocation: jest.fn(),
    } as unknown as jest.Mocked<IDemandForecastRepository>;

    demandForecaster = new DemandForecaster(
      productRepoMock,
      inventoryRepoMock,
      ledgerRepoMock,
      replenishmentRuleRepoMock,
      demandForecastRepoMock
    );
  });

  describe('calculateSalesVelocity', () => {
    it('should throw an error if product is not found', async () => {
      productRepoMock.findBySku.mockResolvedValue(null);

      await expect(demandForecaster.calculateSalesVelocity(sku, locationId))
        .rejects.toThrow(`Product not found for SKU: ${sku.value}`);
    });

    it('should throw an error if variant is not found', async () => {
      const mockProduct = {
        findVariantBySku: jest.fn().mockReturnValue(undefined)
      };
      productRepoMock.findBySku.mockResolvedValue(mockProduct as any);

      await expect(demandForecaster.calculateSalesVelocity(sku, locationId))
        .rejects.toThrow(`Variant not found for SKU: ${sku.value}`);
    });

    it('should calculate correct average daily sales', async () => {
      const mockVariant = { id: { value: 'variant-1' } };
      const mockProduct = {
        findVariantBySku: jest.fn().mockReturnValue(mockVariant)
      };
      productRepoMock.findBySku.mockResolvedValue(mockProduct as any);

      inventoryRepoMock.findBySkuAndLocation.mockResolvedValue({ quantity: { value: 100 } } as any);

      const now = new Date();
      const date5DaysAgo = new Date(now.getTime() - (5 * 24 * 60 * 60 * 1000));
      const date20DaysAgo = new Date(now.getTime() - (20 * 24 * 60 * 60 * 1000));
      const date60DaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));
      const date100DaysAgo = new Date(now.getTime() - (100 * 24 * 60 * 60 * 1000));

      const mockEntries = [
        { occurredAt: date5DaysAgo, quantity: -14, reason: ReasonCode.Sale }, // 7d, 30d, 90d
        { occurredAt: date20DaysAgo, quantity: -30, reason: ReasonCode.Sale }, // 30d, 90d
        { occurredAt: date60DaysAgo, quantity: -90, reason: ReasonCode.Sale }, // 90d
        { occurredAt: date100DaysAgo, quantity: -200, reason: ReasonCode.Sale }, // Ignored
        { occurredAt: date5DaysAgo, quantity: 10, reason: ReasonCode.Sale }, // Ignored (positive)
        { occurredAt: date5DaysAgo, quantity: -20, reason: ReasonCode.Transfer } // Ignored (not sale)
      ];

      ledgerRepoMock.entriesFor.mockResolvedValue(mockEntries as any);

      const result = await demandForecaster.calculateSalesVelocity(sku, locationId);

      expect(result.averageDailySales7d).toBe(2); // 14 / 7
      expect(result.averageDailySales30d).toBe(1.467); // (14 + 30) = 44 / 30 = 1.4666...
      expect(result.averageDailySales90d).toBe(1.489); // (14 + 30 + 90) = 134 / 90 = 1.4888...
      expect(result.currentStock).toBe(100);
    });

    it('should correctly calculate daysOfCover and runOutDate', async () => {
      const mockVariant = { id: { value: 'variant-1' } };
      const mockProduct = {
        findVariantBySku: jest.fn().mockReturnValue(mockVariant)
      };
      productRepoMock.findBySku.mockResolvedValue(mockProduct as any);
      inventoryRepoMock.findBySkuAndLocation.mockResolvedValue({ quantity: { value: 60 } } as any);

      const now = new Date();
      const date10DaysAgo = new Date(now.getTime() - (10 * 24 * 60 * 60 * 1000));
      const mockEntries = [
        { occurredAt: date10DaysAgo, quantity: -60, reason: ReasonCode.Sale } // 60 total over 30d = 2/day
      ];
      ledgerRepoMock.entriesFor.mockResolvedValue(mockEntries as any);

      const result = await demandForecaster.calculateSalesVelocity(sku, locationId);

      expect(result.averageDailySales30d).toBe(2);
      expect(result.daysOfCover).toBe(30); // 60 / 2

      // runOutDate should be ~30 days from now
      expect(result.runOutDate).toBeDefined();
      const expectedRunOutTime = now.getTime() + (30 * 24 * 60 * 60 * 1000);
      expect(Math.abs(result.runOutDate!.getTime() - expectedRunOutTime)).toBeLessThan(100); // 100ms tolerance
    });

    it('should default currentStock to 0 if inventory item is not found', async () => {
      const mockVariant = { id: { value: 'variant-1' } };
      const mockProduct = {
        findVariantBySku: jest.fn().mockReturnValue(mockVariant)
      };
      productRepoMock.findBySku.mockResolvedValue(mockProduct as any);

      inventoryRepoMock.findBySkuAndLocation.mockResolvedValue(null as any);
      ledgerRepoMock.entriesFor.mockResolvedValue([]);

      const result = await demandForecaster.calculateSalesVelocity(sku, locationId);

      expect(result.currentStock).toBe(0);
      expect(result.averageDailySales30d).toBe(0);
    });

    it('should return Infinity daysOfCover if averageDailySales30d is 0', async () => {
      const mockVariant = { id: { value: 'variant-1' } };
      const mockProduct = {
        findVariantBySku: jest.fn().mockReturnValue(mockVariant)
      };
      productRepoMock.findBySku.mockResolvedValue(mockProduct as any);
      inventoryRepoMock.findBySkuAndLocation.mockResolvedValue({ quantity: { value: 60 } } as any);

      ledgerRepoMock.entriesFor.mockResolvedValue([]);

      const result = await demandForecaster.calculateSalesVelocity(sku, locationId);

      expect(result.averageDailySales30d).toBe(0);
      expect(result.daysOfCover).toBe(Infinity);
      expect(result.runOutDate).toBeNull();
    });
  });

  describe('generateDemandForecast', () => {
    it('should generate forecast correctly and save it', async () => {
      const mockVariant = { id: { value: 'variant-1' } };
      const mockProduct = {
        findVariantBySku: jest.fn().mockReturnValue(mockVariant)
      };
      productRepoMock.findBySku.mockResolvedValue(mockProduct as any);
      inventoryRepoMock.findBySkuAndLocation.mockResolvedValue({ quantity: { value: 60 } } as any);

      const now = new Date();
      const date10DaysAgo = new Date(now.getTime() - (10 * 24 * 60 * 60 * 1000));
      const mockEntries = [
        { occurredAt: date10DaysAgo, quantity: -60, reason: ReasonCode.Sale } // 2/day
      ];
      ledgerRepoMock.entriesFor.mockResolvedValue(mockEntries as any);

      const forecast = await demandForecaster.generateDemandForecast(sku, locationId, 15, 1.2);

      // base: 2 * 15 = 30. multiplier: 1.2. 30 * 1.2 = 36
      expect(forecast.forecastedQuantity).toBe(36);
      expect(forecast.confidenceLevel).toBe(0.85); // >0 sales
      expect(demandForecastRepoMock.save).toHaveBeenCalledWith(forecast);
    });

    it('should assign lower confidence level if 30d sales velocity is 0', async () => {
       const mockVariant = { id: { value: 'variant-1' } };
       const mockProduct = {
         findVariantBySku: jest.fn().mockReturnValue(mockVariant)
       };
       productRepoMock.findBySku.mockResolvedValue(mockProduct as any);
       inventoryRepoMock.findBySkuAndLocation.mockResolvedValue({ quantity: { value: 60 } } as any);
       ledgerRepoMock.entriesFor.mockResolvedValue([]);

       const forecast = await demandForecaster.generateDemandForecast(sku, locationId, 15);
       expect(forecast.confidenceLevel).toBe(0.50);
       expect(forecast.forecastedQuantity).toBe(0);
    });
  });

  describe('getDemandPlanningReport', () => {
    it('should generate demand planning report correctly', async () => {
      const inventoryItems = [
        { sku: new Sku('SKU-1'), quantity: { value: 10 } },
        { sku: new Sku('SKU-2'), quantity: { value: 50 } }
      ];
      inventoryRepoMock.findByLocation.mockResolvedValue(inventoryItems as any);

      const now = new Date();
      const activeForecastSku1 = {
        sku: new Sku('SKU-1'),
        periodStart: new Date(now.getTime() - 1000),
        periodEnd: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
        forecastedQuantity: 100,
        confidenceLevel: 0.9
      };
      demandForecastRepoMock.findAllForLocation.mockResolvedValue([activeForecastSku1 as any]);

      const policies = [
        { sku: new Sku('SKU-1'), reorderPoint: 15, reorderQuantity: 30, safetyStock: 5 }
      ];
      replenishmentRuleRepoMock.findAllByLocation.mockResolvedValue(policies as any);

      const mockProducts = [
        { variants: [{ sku: new Sku('SKU-1'), id: { value: 'v1' } }] },
        { variants: [{ sku: new Sku('SKU-2'), id: { value: 'v2' } }] }
      ];
      productRepoMock.findBySkus.mockResolvedValue(mockProducts as any);

      const mockEntriesMap = new Map();
      mockEntriesMap.set('v1', [
        { occurredAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), quantity: -30, reason: ReasonCode.Sale } // 1/day over 30d
      ]);
      mockEntriesMap.set('v2', []); // 0 sales
      ledgerRepoMock.entriesForBatch.mockResolvedValue(mockEntriesMap);

      const report = await demandForecaster.getDemandPlanningReport(locationId);

      expect(report.length).toBe(2);

      const item1 = report.find(r => r.sku === 'SKU-1');
      expect(item1).toBeDefined();
      expect(item1!.currentStock).toBe(10);
      expect(item1!.averageDailySales30d).toBe(1);
      expect(item1!.forecastedDemand30d).toBe(100); // from active forecast
      expect(item1!.confidenceLevel).toBe(0.9); // from active forecast
      expect(item1!.actionRequired).toBe(true); // 10 <= 15
      expect(item1!.recommendedOrderQuantity).toBe(30);

      const item2 = report.find(r => r.sku === 'SKU-2');
      expect(item2).toBeDefined();
      expect(item2!.currentStock).toBe(50);
      expect(item2!.averageDailySales30d).toBe(0);
      expect(item2!.forecastedDemand30d).toBe(0); // 0 * 30
      expect(item2!.confidenceLevel).toBe(0.5); // default for 0 sales
      expect(item2!.actionRequired).toBe(false); // 50 > 10 (default ROP)
      expect(item2!.recommendedOrderQuantity).toBe(0);
    });

    it('should handle missing variants, unmapped entries, and inactive forecasts', async () => {
      const inventoryItems = [
        { sku: new Sku('SKU-3'), quantity: { value: 5 } } // Item present, variant missing
      ];
      inventoryRepoMock.findByLocation.mockResolvedValue(inventoryItems as any);

      const now = new Date();
      const inactiveForecast = {
        sku: new Sku('SKU-3'),
        periodStart: new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000), // very old
        periodEnd: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        forecastedQuantity: 50,
        confidenceLevel: 0.9
      };
      demandForecastRepoMock.findAllForLocation.mockResolvedValue([inactiveForecast as any]);
      replenishmentRuleRepoMock.findAllByLocation.mockResolvedValue([] as any);

      // SKU-3 has no matching variant in the product response initially (missing variant test)
      // but findBySku handles the missing variant case by fetching the product and variants inside calculateSalesVelocity
      const mockVariant = { sku: new Sku('SKU-3'), id: { value: 'v3' } };
      const mockProduct = {
        variants: [
           mockVariant,
           { sku: new Sku('SKU-IGNORED'), id: { value: 'v-ignored' } } // Ignored branch test
        ],
        findVariantBySku: jest.fn().mockReturnValue(mockVariant)
      };
      productRepoMock.findBySkus.mockResolvedValue([mockProduct as any]);
      productRepoMock.findBySku.mockResolvedValue(mockProduct as any); // Fallback for when variant not in map

      ledgerRepoMock.entriesForBatch.mockResolvedValue(new Map()); // Returns no batch entries for v3
      ledgerRepoMock.entriesFor.mockResolvedValue([]); // Fallback ledger fetch

      const report = await demandForecaster.getDemandPlanningReport(locationId);

      // Execute the case where variant exists in the map but returns no entries from batch,
      // forcing the `|| []` branch on line 197.
      const mockVariant2 = { sku: new Sku('SKU-4'), id: { value: 'v4' } };
      const mockProduct2 = {
        variants: [ mockVariant2 ],
        findVariantBySku: jest.fn().mockReturnValue(mockVariant2)
      };
      productRepoMock.findBySkus.mockResolvedValue([mockProduct2 as any]);

      const mapWithV4NoEntries = new Map();
      // Notice we are NOT setting 'v4' in the ledger batch map, so .get returns undefined and triggers `|| []`.
      ledgerRepoMock.entriesForBatch.mockResolvedValue(mapWithV4NoEntries);

      inventoryRepoMock.findByLocation.mockResolvedValue([
        { sku: new Sku('SKU-4'), quantity: { value: 10 } }
      ] as any);

      await demandForecaster.getDemandPlanningReport(locationId);

      expect(report.length).toBe(1);
      const item = report[0];
      expect(item.sku).toBe('SKU-3');
      expect(item.forecastedDemand30d).toBe(0); // No active forecast
      expect(item.confidenceLevel).toBe(0.5); // Fallback confidence
    });
  });
});
