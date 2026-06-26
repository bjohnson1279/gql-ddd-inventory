import { DemandVelocityCalculator, ReorderPointForecaster } from '../../../src/domain/services/ReplenishmentForecaster';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { IProductRepository } from '../../../src/domain/repositories/IProductRepository';
import { ILedgerRepository } from '../../../src/domain/repositories/ILedgerRepository';

import { ReasonCode } from '../../../src/domain/enums/ReasonCode';

describe('DemandVelocityCalculator', () => {
  const sku = new Sku('SKU-123');
  const locationId = new LocationId('LOC-1');

  let productRepoMock: jest.Mocked<IProductRepository>;
  let ledgerRepoMock: jest.Mocked<ILedgerRepository>;
  let velocityCalculator: DemandVelocityCalculator;

  beforeEach(() => {
    productRepoMock = {
      findBySku: jest.fn(),
    } as unknown as jest.Mocked<IProductRepository>;

    ledgerRepoMock = {
      entriesFor: jest.fn(),
    } as unknown as jest.Mocked<ILedgerRepository>;

    velocityCalculator = new DemandVelocityCalculator(productRepoMock, ledgerRepoMock);
  });

  it('should return 0 if product is not found', async () => {
    productRepoMock.findBySku.mockResolvedValue(null);
    const result = await velocityCalculator.calculateAverageDailySales(sku, locationId);
    expect(result).toBe(0);
    expect(productRepoMock.findBySku).toHaveBeenCalledWith(sku);
  });

  it('should return 0 if variant is not found in product', async () => {
    const mockProduct = {
      findVariantBySku: jest.fn().mockReturnValue(undefined)
    };
    productRepoMock.findBySku.mockResolvedValue(mockProduct as any);

    const result = await velocityCalculator.calculateAverageDailySales(sku, locationId);
    expect(result).toBe(0);
    expect(mockProduct.findVariantBySku).toHaveBeenCalledWith(sku);
  });

  it('should calculate average daily sales correctly', async () => {
    const mockVariant = { id: 'variant-1' };
    const mockProduct = {
      findVariantBySku: jest.fn().mockReturnValue(mockVariant)
    };
    productRepoMock.findBySku.mockResolvedValue(mockProduct as any);

    const now = new Date();
    const validDate = new Date(now.getTime() - (5 * 24 * 60 * 60 * 1000)); // 5 days ago
    const outsideWindowDate = new Date(now.getTime() - (40 * 24 * 60 * 60 * 1000)); // 40 days ago

    const mockEntries = [
      // Valid sales within 30-day window
      { occurredAt: validDate, quantity: -10, reason: ReasonCode.Sale },
      { occurredAt: validDate, quantity: -5, reason: ReasonCode.KitSale },

      // Invalid entries that should be ignored
      { occurredAt: validDate, quantity: 10, reason: ReasonCode.Sale }, // Positive quantity
      { occurredAt: validDate, quantity: -20, reason: ReasonCode.Transfer }, // Not a sale reason
      { occurredAt: outsideWindowDate, quantity: -50, reason: ReasonCode.Sale } // Outside 30-day window
    ];
    ledgerRepoMock.entriesFor.mockResolvedValue(mockEntries as any);

    const result = await velocityCalculator.calculateAverageDailySales(sku, locationId, 30);

    // Valid total quantity = |-10| + |-5| = 15
    // Average daily = 15 / 30 = 0.5
    expect(result).toBe(0.5);
    expect(ledgerRepoMock.entriesFor).toHaveBeenCalledWith('variant-1', locationId);
  });
});

describe('ReorderPointForecaster', () => {
  const sku = new Sku('SKU-123');
  const locationId = new LocationId('LOC-1');

  let productRepoMock: jest.Mocked<IProductRepository>;
  let ledgerRepoMock: jest.Mocked<ILedgerRepository>;
  let velocityCalculator: DemandVelocityCalculator;
  let reorderPointForecaster: ReorderPointForecaster;

  beforeEach(() => {
    productRepoMock = {} as any;
    ledgerRepoMock = {} as any;
    velocityCalculator = new DemandVelocityCalculator(productRepoMock, ledgerRepoMock);
    reorderPointForecaster = new ReorderPointForecaster(velocityCalculator);

    // Mock the velocity calculator method directly
    velocityCalculator.calculateAverageDailySales = jest.fn();
  });

  it('should correctly calculate reorder point with standard values', async () => {
    const dailyRunrate = 10;
    (velocityCalculator.calculateAverageDailySales as jest.Mock).mockResolvedValue(dailyRunrate);

    const leadTimeDays = 5;
    const safetyStock = 20;

    const rop = await reorderPointForecaster.forecastReorderPoint(sku, locationId, leadTimeDays, safetyStock);

    // Formula: (dailyRunrate * leadTimeDays) + safetyStock
    // (10 * 5) + 20 = 70
    expect(rop).toBe(70);
    expect(velocityCalculator.calculateAverageDailySales).toHaveBeenCalledWith(sku, locationId, 30);
  });

  it('should round up the calculated reorder point', async () => {
    const dailyRunrate = 3.2; // Not an integer
    (velocityCalculator.calculateAverageDailySales as jest.Mock).mockResolvedValue(dailyRunrate);

    const leadTimeDays = 7;
    const safetyStock = 15;

    const rop = await reorderPointForecaster.forecastReorderPoint(sku, locationId, leadTimeDays, safetyStock);

    // Formula: (dailyRunrate * leadTimeDays) + safetyStock
    // (3.2 * 7) + 15 = 22.4 + 15 = 37.4 -> ceil -> 38
    expect(rop).toBe(38);
  });

  it('should handle zero demand properly', async () => {
    const dailyRunrate = 0;
    (velocityCalculator.calculateAverageDailySales as jest.Mock).mockResolvedValue(dailyRunrate);

    const leadTimeDays = 5;
    const safetyStock = 10;

    const rop = await reorderPointForecaster.forecastReorderPoint(sku, locationId, leadTimeDays, safetyStock);

    // Formula: (0 * 5) + 10 = 10
    expect(rop).toBe(10);
  });

  it('should calculate reorder point properly when using custom window days', async () => {
    const dailyRunrate = 15;
    (velocityCalculator.calculateAverageDailySales as jest.Mock).mockResolvedValue(dailyRunrate);

    const leadTimeDays = 10;
    const safetyStock = 50;
    const windowDays = 60;

    const rop = await reorderPointForecaster.forecastReorderPoint(sku, locationId, leadTimeDays, safetyStock, windowDays);

    // Formula: (15 * 10) + 50 = 200
    expect(rop).toBe(200);
    expect(velocityCalculator.calculateAverageDailySales).toHaveBeenCalledWith(sku, locationId, 60);
  });

  it('should correctly calculate reorder point when lead time is 0', async () => {
    const dailyRunrate = 10;
    (velocityCalculator.calculateAverageDailySales as jest.Mock).mockResolvedValue(dailyRunrate);

    const leadTimeDays = 0;
    const safetyStock = 20;

    const rop = await reorderPointForecaster.forecastReorderPoint(sku, locationId, leadTimeDays, safetyStock);

    expect(rop).toBe(20);
  });

  it('should correctly calculate reorder point when safety stock is 0', async () => {
    const dailyRunrate = 10;
    (velocityCalculator.calculateAverageDailySales as jest.Mock).mockResolvedValue(dailyRunrate);

    const leadTimeDays = 5;
    const safetyStock = 0;

    const rop = await reorderPointForecaster.forecastReorderPoint(sku, locationId, leadTimeDays, safetyStock);

    expect(rop).toBe(50);
  });

  it('should propagate errors from DemandVelocityCalculator', async () => {
    const error = new Error('Database connection failed');
    (velocityCalculator.calculateAverageDailySales as jest.Mock).mockRejectedValue(error);

    const leadTimeDays = 5;
    const safetyStock = 20;

    await expect(reorderPointForecaster.forecastReorderPoint(sku, locationId, leadTimeDays, safetyStock)).rejects.toThrow('Database connection failed');
  });
});
