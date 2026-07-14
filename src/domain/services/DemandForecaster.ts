import crypto from 'node:crypto';
import { IInventoryRepository } from '../repositories/IInventoryRepository';
import { ILedgerRepository } from '../repositories/ILedgerRepository';
import { IReplenishmentRuleRepository } from '../repositories/IReplenishmentRuleRepository';
import { IDemandForecastRepository } from '../repositories/IDemandForecastRepository';
import { Sku } from '../valueObjects/Sku';
import { LocationId } from '../valueObjects/LocationId';
import { DemandForecast } from '../entities/DemandForecast';
import { DemandForecastId } from '../valueObjects/DemandForecastId';
import { ReasonCode } from '../enums/ReasonCode';
import { IProductRepository } from '../repositories/IProductRepository';

export interface SalesVelocityResult {
  sku: string;
  locationId: string;
  currentStock: number;
  averageDailySales7d: number;
  averageDailySales30d: number;
  averageDailySales90d: number;
  daysOfCover: number;
  runOutDate: Date | null;
}

export interface DemandPlanningReportItem {
  sku: string;
  locationId: string;
  currentStock: number;
  averageDailySales7d: number;
  averageDailySales30d: number;
  averageDailySales90d: number;
  daysOfCover: number;
  runOutDate: Date | null;
  reorderPoint: number;
  reorderQuantity: number;
  safetyStock: number;
  forecastedDemand30d: number;
  confidenceLevel: number;
  actionRequired: boolean;
  recommendedOrderQuantity: number;
}

export class DemandForecaster {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly inventoryRepo: IInventoryRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly replenishmentRuleRepo: IReplenishmentRuleRepository,
    private readonly demandForecastRepo: IDemandForecastRepository
  ) {}

  async calculateSalesVelocity(sku: Sku, locationId: LocationId, preFetchedStock?: number): Promise<SalesVelocityResult> {
    const product = await this.productRepo.findBySku(sku);
    if (!product) {
      throw new Error(`Product not found for SKU: ${sku.value}`);
    }
    const variant = product.findVariantBySku(sku);
    if (!variant) {
      throw new Error(`Variant not found for SKU: ${sku.value}`);
    }

    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoTime = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    const sevenDaysAgoTime = now.getTime() - 7 * 24 * 60 * 60 * 1000;

    const entries = await this.ledgerRepo.entriesFor(variant.id, locationId);

    const history90d = entries.filter((e) =>
      e.occurredAt >= ninetyDaysAgo &&
      e.quantity < 0 &&
      (e.reason === ReasonCode.Sale || e.reason === ReasonCode.KitSale)
    );

    const history30d = history90d.filter((r) => r.occurredAt.getTime() >= thirtyDaysAgoTime);
    const history7d = history30d.filter((r) => r.occurredAt.getTime() >= sevenDaysAgoTime);

    let currentStock = preFetchedStock;
    if (currentStock === undefined) {
      const inventoryItem = await this.inventoryRepo.findBySkuAndLocation(sku.value, locationId.value);
      currentStock = inventoryItem ? inventoryItem.quantity.value : 0;
    }

    const sum7d = history7d.reduce((acc, r) => acc + Math.abs(r.quantity), 0);
    const sum30d = history30d.reduce((acc, r) => acc + Math.abs(r.quantity), 0);
    const sum90d = history90d.reduce((acc, r) => acc + Math.abs(r.quantity), 0);

    const ads7d = parseFloat((sum7d / 7).toFixed(3));
    const ads30d = parseFloat((sum30d / 30).toFixed(3));
    const ads90d = parseFloat((sum90d / 90).toFixed(3));

    let daysOfCover = Infinity;
    let runOutDate: Date | null = null;

    if (ads30d > 0) {
      daysOfCover = Math.ceil(currentStock / ads30d);
      runOutDate = new Date(now.getTime() + daysOfCover * 24 * 60 * 60 * 1000);
    }

    return {
      sku: sku.value,
      locationId: locationId.value,
      currentStock,
      averageDailySales7d: ads7d,
      averageDailySales30d: ads30d,
      averageDailySales90d: ads90d,
      daysOfCover,
      runOutDate
    };
  }

  async generateDemandForecast(
    sku: Sku,
    locationId: LocationId,
    forecastDays: number,
    trendMultiplier: number = 1.0
  ): Promise<DemandForecast> {
    const velocity = await this.calculateSalesVelocity(sku, locationId);
    const baseQuantity = velocity.averageDailySales30d * forecastDays;
    const forecastedQuantity = Math.ceil(baseQuantity * trendMultiplier);

    const periodStart = new Date();
    const periodEnd = new Date(periodStart.getTime() + forecastDays * 24 * 60 * 60 * 1000);

    const confidenceLevel = velocity.averageDailySales30d > 0 ? 0.85 : 0.50;

    const id = new DemandForecastId(crypto.randomUUID());

    const forecast = new DemandForecast(
      id,
      sku,
      locationId,
      forecastedQuantity,
      periodStart,
      periodEnd,
      confidenceLevel,
      new Date()
    );

    await this.demandForecastRepo.save(forecast);

    return forecast;
  }

  async getDemandPlanningReport(locationId: LocationId): Promise<DemandPlanningReportItem[]> {
    const inventoryItems = await this.inventoryRepo.findByLocation(locationId.value);
    const forecasts = await this.demandForecastRepo.findAllForLocation(locationId);
    const policies = await this.replenishmentRuleRepo.findAllByLocation(locationId);
    const policyMap = new Map(policies.map((p) => [p.sku.value, p]));

    const reportItemsPromises = inventoryItems.map(async (item) => {
      const skuStr = item.sku.value;
      const sku = new Sku(skuStr);

      const velocity = await this.calculateSalesVelocity(sku, locationId, item.quantity.value);
      const policy = policyMap.get(skuStr);

      const reorderPoint = policy ? policy.reorderPoint : 10;
      const reorderQuantity = policy ? policy.reorderQuantity : 20;
      const safetyStock = policy ? policy.safetyStock : 5;

      const now = new Date();
      const endWindow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const activeForecast = forecasts.find(
        (f) =>
          f.sku.value === skuStr &&
          f.periodEnd >= now &&
          f.periodStart <= endWindow
      );

      const forecastedDemand30d = activeForecast ? activeForecast.forecastedQuantity : Math.ceil(velocity.averageDailySales30d * 30);
      const defaultConfidence = velocity.averageDailySales30d > 0 ? 0.70 : 0.50;
      const confidenceLevel = activeForecast ? activeForecast.confidenceLevel : defaultConfidence;

      const actionRequired = item.quantity.value <= reorderPoint;
      const recommendedOrderQuantity = actionRequired ? reorderQuantity : 0;

      return {
        sku: skuStr,
        locationId: locationId.value,
        currentStock: item.quantity.value,
        averageDailySales7d: velocity.averageDailySales7d,
        averageDailySales30d: velocity.averageDailySales30d,
        averageDailySales90d: velocity.averageDailySales90d,
        daysOfCover: velocity.daysOfCover,
        runOutDate: velocity.runOutDate,

        reorderPoint,
        reorderQuantity,
        safetyStock,

        forecastedDemand30d,
        confidenceLevel,

        actionRequired,
        recommendedOrderQuantity
      };
    });

    return Promise.all(reportItemsPromises);
  }
}
