import { DemandVelocityCalculator, ReorderPointForecaster } from '../../../src/domain/services/ReplenishmentForecaster';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { IProductRepository } from '../../../src/domain/repositories/IProductRepository';
import { ILedgerRepository } from '../../../src/domain/repositories/ILedgerRepository';

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
});
