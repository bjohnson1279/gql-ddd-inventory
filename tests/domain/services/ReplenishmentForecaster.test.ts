import { DemandVelocityCalculator, ReorderPointForecaster } from '../../../src/domain/services/ReplenishmentForecaster';
import { Sku } from '../../../src/domain/valueObjects/Sku';
import { LocationId } from '../../../src/domain/valueObjects/LocationId';
import { TenantId } from '../../../src/domain/valueObjects/TenantId';
import { IProductRepository } from '../../../src/domain/repositories/IProductRepository';
import { ILedgerRepository } from '../../../src/domain/repositories/ILedgerRepository';
import { IPurchaseOrderRepository } from '../../../src/domain/repositories/IPurchaseOrderRepository';
import { ReasonCode } from '../../../src/domain/enums/ReasonCode';
import { PurchaseOrderStatus } from '../../../src/domain/enums/PurchaseOrderStatus';
import { PurchaseOrder } from '../../../src/domain/entities/PurchaseOrder';
import { PurchaseOrderId } from '../../../src/domain/valueObjects/PurchaseOrderId';

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

  it('should calculate daily sales stats correctly with standard deviation', async () => {
    const mockVariant = { id: 'variant-1' };
    const mockProduct = {
      findVariantBySku: jest.fn().mockReturnValue(mockVariant)
    };
    productRepoMock.findBySku.mockResolvedValue(mockProduct as any);

    const now = new Date();
    now.setHours(12, 0, 0, 0); // set to midday to avoid boundary issues

    // We'll create entries for 2 days out of a 5-day window.
    // Day 0 (4 days ago): 10 units sold
    // Day 1 (3 days ago): 0 units sold
    // Day 2 (2 days ago): 20 units sold
    // Day 3 (1 day ago): 0 units sold
    // Day 4 (today): 0 units sold
    const dateDay0 = new Date(now.getTime() - (4 * 24 * 60 * 60 * 1000));
    const dateDay2 = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000));

    const mockEntries = [
      { occurredAt: dateDay0, quantity: -10, reason: ReasonCode.Sale },
      { occurredAt: dateDay2, quantity: -20, reason: ReasonCode.Sale }
    ];
    ledgerRepoMock.entriesFor.mockResolvedValue(mockEntries as any);

    const stats = await velocityCalculator.calculateDailySalesStats(sku, locationId, 5);

    // Mean: (10 + 0 + 20 + 0 + 0) / 5 = 6
    expect(stats.average).toBe(6);

    // Variance:
    // Day 0: (10 - 6)^2 = 16
    // Day 1: (0 - 6)^2 = 36
    // Day 2: (20 - 6)^2 = 196
    // Day 3: (0 - 6)^2 = 36
    // Day 4: (0 - 6)^2 = 36
    // Sum = 16 + 36 + 196 + 36 + 36 = 320
    // Variance = 320 / 5 = 64
    // StdDev = sqrt(64) = 8
    expect(stats.stdDev).toBe(8);
  });
});

describe('ReorderPointForecaster', () => {
  const sku = new Sku('SKU-123');
  const locationId = new LocationId('LOC-1');
  const tenantId = new TenantId('tenant-1');

  let productRepoMock: jest.Mocked<IProductRepository>;
  let ledgerRepoMock: jest.Mocked<ILedgerRepository>;
  let poRepoMock: jest.Mocked<IPurchaseOrderRepository>;
  let velocityCalculator: DemandVelocityCalculator;
  let reorderPointForecaster: ReorderPointForecaster;

  beforeEach(() => {
    productRepoMock = {
      findBySku: jest.fn(),
    } as unknown as jest.Mocked<IProductRepository>;

    ledgerRepoMock = {
      entriesFor: jest.fn(),
    } as unknown as jest.Mocked<ILedgerRepository>;

    poRepoMock = {
      findAllByTenant: jest.fn(),
    } as unknown as jest.Mocked<IPurchaseOrderRepository>;

    velocityCalculator = new DemandVelocityCalculator(productRepoMock, ledgerRepoMock);
    reorderPointForecaster = new ReorderPointForecaster(velocityCalculator, productRepoMock, poRepoMock);

    // Mock the velocity calculator stats method directly
    velocityCalculator.calculateDailySalesStats = jest.fn();
  });

  it('should correctly calculate reorder point with standard values (no lead time variance)', async () => {
    // Mean sales = 10, StdDev = 0
    (velocityCalculator.calculateDailySalesStats as jest.Mock).mockResolvedValue({ average: 10, stdDev: 0 });
    poRepoMock.findAllByTenant.mockResolvedValue([]); // No POs, so LT stdDev = 0, avg = rule.leadTimeDays

    const leadTimeDays = 5;
    const safetyStock = 20;

    const rop = await reorderPointForecaster.forecastReorderPoint(sku, locationId, leadTimeDays, safetyStock, 30, tenantId);

    // Formula:
    // Avg Lead Time = 5 (default), StdDev Lead Time = 0
    // Avg Daily Sales = 10, StdDev Daily Sales = 0
    // term1 = 5 * 0^2 = 0
    // term2 = 10^2 * 0^2 = 0
    // calculatedSafetyStock = 1.65 * sqrt(0) = 0
    // ROP = (10 * 5) + 0 = 50
    expect(rop).toBe(50);
  });

  it('should calculate reorder point with lead-time variance from historical purchase orders', async () => {
    // Mean sales = 10, StdDev = 2
    (velocityCalculator.calculateDailySalesStats as jest.Mock).mockResolvedValue({ average: 10, stdDev: 2 });

    const mockVariant = { id: 'variant-1' };
    const mockProduct = {
      findVariantBySku: jest.fn().mockReturnValue(mockVariant)
    };
    productRepoMock.findBySku.mockResolvedValue(mockProduct as any);

    // Create mock purchase orders with different lead times
    // PO 1: Lead time 4 days
    // PO 2: Lead time 6 days
    // Avg Lead Time = 5, StdDev = 1
    const baseTime = new Date('2026-07-01T12:00:00Z').getTime();
    const po1 = PurchaseOrder.reconstruct(
      new PurchaseOrderId('po-1'),
      tenantId,
      'supplier-1',
      locationId,
      [{ variantId: mockVariant.id, quantity: 100 } as any],
      PurchaseOrderStatus.Received,
      new Date(baseTime),
      new Date(baseTime + (4 * 24 * 60 * 60 * 1000))
    );
    const po2 = PurchaseOrder.reconstruct(
      new PurchaseOrderId('po-2'),
      tenantId,
      'supplier-1',
      locationId,
      [{ variantId: mockVariant.id, quantity: 100 } as any],
      PurchaseOrderStatus.Received,
      new Date(baseTime),
      new Date(baseTime + (6 * 24 * 60 * 60 * 1000))
    );

    poRepoMock.findAllByTenant.mockResolvedValue([po1, po2]);

    const leadTimeDays = 3; // Rule default, should be overridden by actual avg = 5
    const safetyStock = 0; // Will be calculated dynamically

    const rop = await reorderPointForecaster.forecastReorderPoint(sku, locationId, leadTimeDays, safetyStock, 30, tenantId);

    // Calculations:
    // Avg LT = 5, StdDev LT = 1
    // Avg Daily Sales = 10, StdDev Daily Sales = 2
    // term1 = 5 * 2^2 = 20
    // term2 = 10^2 * 1^2 = 100
    // safetyStock = 1.65 * sqrt(20 + 100) = 1.65 * sqrt(120) = 1.65 * 10.95445 = 18.0748
    // ROP = (10 * 5) + 18.0748 = 68.0748 -> ceil -> 69
    expect(rop).toBe(69);
  });
});
