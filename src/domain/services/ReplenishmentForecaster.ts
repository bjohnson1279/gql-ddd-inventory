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

    const salesEntries = entries.filter((e) => {
      return (
        e.occurredAt >= startDate &&
        e.quantity < 0 &&
        (e.reason === ReasonCode.Sale || e.reason === ReasonCode.KitSale)
      );
    });

    const totalQuantity = salesEntries.reduce((sum, e) => sum + Math.abs(e.quantity), 0);
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

    const salesEntries = entries.filter((e) => {
      return (
        e.occurredAt >= startDateClean &&
        e.quantity < 0 &&
        (e.reason === ReasonCode.Sale || e.reason === ReasonCode.KitSale)
      );
    });

    const totalQuantity = salesEntries.reduce((sum, e) => sum + Math.abs(e.quantity), 0);
    const average = totalQuantity / windowDays;

    const dailyQuantities = new Array(windowDays).fill(0);
    const msInDay = 24 * 60 * 60 * 1000;
    const todayClean = new Date();
    todayClean.setHours(23, 59, 59, 999);

    for (const entry of salesEntries) {
      const diffMs = todayClean.getTime() - entry.occurredAt.getTime();
      const dayOffset = Math.floor(diffMs / msInDay);
      const dayIndex = windowDays - 1 - dayOffset;
      if (dayIndex >= 0 && dayIndex < windowDays) {
        dailyQuantities[dayIndex] += Math.abs(entry.quantity);
      }
    }

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
    tenantId?: TenantId
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

          const allPos = await this.poRepo.findAllByTenant(tenantId);
          // Filter received POs containing this variant at this location
          let receivedPos = allPos.filter((po) =>
            po.status === PurchaseOrderStatus.Received &&
            getLocIdStr(po.destinationLocationId) === ruleLocIdStr &&
            po.items.some((item) => {
              const itemVarId = typeof item.variantId === 'string' ? item.variantId : (item.variantId && 'value' in item.variantId ? item.variantId.value : '');
              return itemVarId === ruleVarId;
            })
          );

          // Fallback: search across all locations for this tenant if none at destination location
          if (receivedPos.length === 0) {
            receivedPos = allPos.filter((po) =>
              po.status === PurchaseOrderStatus.Received &&
              po.items.some((item) => {
                const itemVarId = typeof item.variantId === 'string' ? item.variantId : (item.variantId && 'value' in item.variantId ? item.variantId.value : '');
                return itemVarId === ruleVarId;
              })
            );
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
