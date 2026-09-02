import { PurchaseOrder } from '../entities/PurchaseOrder';
import { ILedgerRepository } from '../repositories/ILedgerRepository';
import { IProductRepository } from '../repositories/IProductRepository';
import { IPurchaseOrderRepository } from '../repositories/IPurchaseOrderRepository';
import { Sku } from '../valueObjects/Sku';
import { LocationId } from '../valueObjects/LocationId';
import { TenantId } from '../valueObjects/TenantId';
import { ReasonCode } from '../enums/ReasonCode';
import { PurchaseOrderStatus } from '../enums/PurchaseOrderStatus';

export class DemandVelocityCalculator {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly ledgerRepo: ILedgerRepository
  ) {}

  async calculateAverageDailySales(
    sku: Sku,
    locationId: LocationId,
    windowDays: number = 30
  ): Promise<number> {
    const product = await this.productRepo.findBySku(sku);
    if (!product) {
      return 0;
    }

    const variant = product.findVariantBySku(sku);
    if (!variant) {
      return 0;
    }

    const entries = await this.ledgerRepo.entriesFor(variant.id, locationId);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - windowDays);
    const startDateCleanTime = startDate.getTime();

    let totalQuantity = 0;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (
        e.quantity < 0 &&
        (e.reason === ReasonCode.Sale || e.reason === ReasonCode.KitSale) &&
        e.occurredAt.getTime() >= startDateCleanTime
      ) {
        totalQuantity -= e.quantity;
      }
    }

    return totalQuantity / windowDays;
  }

  async calculateDailySalesStats(
    sku: Sku,
    locationId: LocationId,
    windowDays: number = 30
  ): Promise<{ average: number; stdDev: number }> {
    const product = await this.productRepo.findBySku(sku);
    if (!product) {
      return { average: 0, stdDev: 0 };
    }

    const variant = product.findVariantBySku(sku);
    if (!variant) {
      return { average: 0, stdDev: 0 };
    }

    const entries = await this.ledgerRepo.entriesFor(variant.id, locationId);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - windowDays);
    const startDateClean = new Date(startDate);
    startDateClean.setHours(0, 0, 0, 0);
    const startDateCleanTime = startDateClean.getTime();

    const dailyQuantities = new Array(windowDays).fill(0);
    const msInDay = 24 * 60 * 60 * 1000;
    const todayClean = new Date();
    todayClean.setHours(23, 59, 59, 999);
    const todayCleanTime = todayClean.getTime();

    let totalQuantity = 0;

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (
        e.quantity < 0 &&
        (e.reason === ReasonCode.Sale || e.reason === ReasonCode.KitSale)
      ) {
        const occurredAtTime = e.occurredAt.getTime();
        if (occurredAtTime >= startDateCleanTime) {
          const absQty = -e.quantity;
          totalQuantity += absQty;

          const diffMs = todayCleanTime - occurredAtTime;
          const dayOffset = Math.floor(diffMs / msInDay);
          const dayIndex = windowDays - 1 - dayOffset;
          if (dayIndex >= 0 && dayIndex < windowDays) {
            dailyQuantities[dayIndex] += absQty;
          }
        }
      }
    }

    const average = totalQuantity / windowDays;

    const varianceSum = dailyQuantities.reduce((sum, qty) => sum + Math.pow(qty - average, 2), 0);
    const stdDev = Math.sqrt(varianceSum / windowDays);

    return { average, stdDev };
  }
}

export class ReorderPointForecaster {
  constructor(
    private readonly velocityCalculator: DemandVelocityCalculator,
    private readonly productRepo: IProductRepository,
    private readonly poRepo: IPurchaseOrderRepository
  ) {}

  async forecastReorderPoint(
    sku: Sku,
    locationId: LocationId,
    leadTimeDays: number,
    safetyStock: number,
    windowDays: number = 30,
    tenantId?: TenantId,
    preFetchedPos?: PurchaseOrder[]
  ): Promise<number> {
    // 1. Calculate daily sales average and standard deviation
    const salesStats = await this.velocityCalculator.calculateDailySalesStats(sku, locationId, windowDays);

    // 2. Fetch received purchase orders for lead time statistics
    let leadTimeDaysAvg = leadTimeDays;
    let leadTimeStdDev = 0;

    if (tenantId) {
      const product = await this.productRepo.findBySku(sku);
      if (product) {
        const variant = product.findVariantBySku(sku);
        if (variant) {
          const getLocIdStr = (loc: any) => typeof loc === 'string' ? loc : (loc && typeof loc.value === 'string' ? loc.value : '');
          const ruleLocIdStr = getLocIdStr(locationId);
          const ruleVarId = typeof variant.id === 'string' ? variant.id : (variant.id && 'value' in variant.id ? variant.id.value : '');

          // ⚡ Bolt: Use preFetchedPos to prevent N+1 query when evaluated in a loop
          const allPos = preFetchedPos || await this.poRepo.findAllByTenant(tenantId);

          let receivedPos = [];
          let fallbackReceivedPos = [];

          // ⚡ Bolt: Single pass iteration instead of multiple filters and some() to avoid O(N*M) lookups
          for (const po of allPos) {
            if (po.status !== PurchaseOrderStatus.Received) continue;

            let hasVariant = false;
            for (const item of po.items) {
              const itemVarId = typeof item.variantId === 'string' ? item.variantId : (item.variantId && 'value' in item.variantId ? item.variantId.value : '');
              if (itemVarId === ruleVarId) {
                hasVariant = true;
                break;
              }
            }

            if (hasVariant) {
              fallbackReceivedPos.push(po);
              if (getLocIdStr(po.destinationLocationId) === ruleLocIdStr) {
                receivedPos.push(po);
              }
            }
          }

          if (receivedPos.length === 0) {
            receivedPos = fallbackReceivedPos;
          }

          if (receivedPos.length > 0) {
            const leadTimes = receivedPos.map((po) => {
              const diffMs = po.updatedAt.getTime() - po.createdAt.getTime();
              return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
            });

            const totalLT = leadTimes.reduce((sum, lt) => sum + lt, 0);
            leadTimeDaysAvg = totalLT / leadTimes.length;

            const ltVarianceSum = leadTimes.reduce((sum, lt) => sum + Math.pow(lt - leadTimeDaysAvg, 2), 0);
            leadTimeStdDev = Math.sqrt(ltVarianceSum / leadTimes.length);
          }
        }
      }
    }

    // 3. Calculate Safety Stock using the statistical lead-time variance formula
    // Z-score = 1.65 (95% service level)
    const zScore = 1.65;
    const term1 = leadTimeDaysAvg * Math.pow(salesStats.stdDev, 2);
    const term2 = Math.pow(salesStats.average, 2) * Math.pow(leadTimeStdDev, 2);
    const calculatedSafetyStock = zScore * Math.sqrt(term1 + term2);

    // 4. Forecast ROP
    const calculatedRop = (salesStats.average * leadTimeDaysAvg) + calculatedSafetyStock;
    return Math.ceil(calculatedRop);
  }
}
