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
    const results = await this.calculateSalesVelocityBatch(
      [sku],
      locationId,
      preFetchedStock !== undefined ? new Map([[sku.value, preFetchedStock]]) : undefined
    );
    const result = results.get(sku.value);
    if (!result) {
      throw new Error(`Could not calculate sales velocity for SKU: ${sku.value}`);
    }
    return result;
  }

  async calculateSalesVelocityBatch(skus: Sku[], locationId: LocationId, preFetchedStockMap?: Map<string, number>): Promise<Map<string, SalesVelocityResult>> {
    if (skus.length === 0) return new Map();

    const products = await this.productRepo.findBySkus(skus);
    const productBySkuMap = new Map();
    for (const p of products) {
      for (const v of p.variants) {
        productBySkuMap.set(v.sku.value, p);
      }
    }

    const variantIds = [];
    const variantToSkuMap = new Map<string, string>();
    for (const sku of skus) {
      const product = productBySkuMap.get(sku.value);
      if (!product) {
        throw new Error(`Product not found for SKU: ${sku.value}`);
      }
      const variant = product.findVariantBySku(sku);
      if (!variant) {
        throw new Error(`Variant not found for SKU: ${sku.value}`);
      }
      variantIds.push(variant.id);
      variantToSkuMap.set(variant.id.value, sku.value);
    }

    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoTime = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    const sevenDaysAgoTime = now.getTime() - 7 * 24 * 60 * 60 * 1000;

    const entriesMap = await this.ledgerRepo.entriesForBatch(variantIds, locationId);

    const skusMissingStock = skus.filter(sku => preFetchedStockMap?.get(sku.value) === undefined);
    let inventoryItemsMap = new Map<string, number>();
    if (skusMissingStock.length > 0) {
      const pairs = skusMissingStock.map(sku => ({ sku: sku.value, locationId: locationId.value }));
      const items = await this.inventoryRepo.findBySkuAndLocationBatch(pairs);
      for (const item of items) {
        inventoryItemsMap.set(item.sku.value, item.quantity.value);
      }
    }

    const results = new Map<string, SalesVelocityResult>();

    for (const sku of skus) {
      const product = productBySkuMap.get(sku.value);
      const variant = product!.findVariantBySku(sku)!;

      const entries = entriesMap.get(variant.id.value) || [];

      const history90d = entries.filter((e) =>
        e.occurredAt >= ninetyDaysAgo &&
        e.quantity < 0 &&
        (e.reason === ReasonCode.Sale || e.reason === ReasonCode.KitSale)
      );

      const history30d = history90d.filter((r) => r.occurredAt.getTime() >= thirtyDaysAgoTime);
      const history7d = history30d.filter((r) => r.occurredAt.getTime() >= sevenDaysAgoTime);

      let currentStock = preFetchedStockMap?.get(sku.value);
      if (currentStock === undefined) {
        currentStock = inventoryItemsMap.get(sku.value) || 0;
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

      results.set(sku.value, {
        sku: sku.value,
        locationId: locationId.value,
        currentStock,
        averageDailySales7d: ads7d,
        averageDailySales30d: ads30d,
        averageDailySales90d: ads90d,
        daysOfCover,
        runOutDate
      });
    }

    return results;
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

    const skusToFetch = inventoryItems.map(item => new Sku(item.sku.value));
    const preFetchedStockMap = new Map<string, number>(inventoryItems.map(item => [item.sku.value, item.quantity.value]));

    const velocityMap = await this.calculateSalesVelocityBatch(skusToFetch, locationId, preFetchedStockMap);

    const reportItems: DemandPlanningReportItem[] = inventoryItems.map((item) => {
      const skuStr = item.sku.value;
      const velocity = velocityMap.get(skuStr)!;
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

    return reportItems;
  }
}
