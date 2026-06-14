import { IReplenishmentRuleRepository } from '../repositories/IReplenishmentRuleRepository';
import { IInventoryRepository } from '../repositories/IInventoryRepository';
import { IProductRepository } from '../repositories/IProductRepository';
import { IStockTransferRepository } from '../repositories/IStockTransferRepository';
import { IPurchaseOrderRepository } from '../repositories/IPurchaseOrderRepository';
import { ReorderPointForecaster } from './ReplenishmentForecaster';
import { ReplenishmentType } from '../enums/ReplenishmentType';
import { Sku } from '../valueObjects/Sku';
import { TenantId } from '../valueObjects/TenantId';
import { LocationId } from '../valueObjects/LocationId';
import { StockTransfer } from '../entities/StockTransfer';
import { StockTransferId } from '../valueObjects/StockTransferId';
import { StockTransferItem } from '../valueObjects/StockTransferItem';
import { PurchaseOrder } from '../entities/PurchaseOrder';
import { PurchaseOrderId } from '../valueObjects/PurchaseOrderId';
import { PurchaseOrderItem } from '../valueObjects/PurchaseOrderItem';
import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { PurchaseOrderStatus } from '../enums/PurchaseOrderStatus';
import { StockTransferStatus } from '../enums/StockTransferStatus';
import crypto from 'crypto';

export interface ReplenishmentEvaluationResult {
  ruleId: string;
  sku: string;
  locationId: string;
  triggered: boolean;
  reason?: string;
  actionId?: string;
  actionType?: 'TRANSFER' | 'SUPPLIER';
  reorderPoint: number;
  inventoryPosition: number;
}

export class ReplenishmentEvaluator {
  constructor(
    private readonly ruleRepo: IReplenishmentRuleRepository,
    private readonly inventoryRepo: IInventoryRepository,
    private readonly productRepo: IProductRepository,
    private readonly transferRepo: IStockTransferRepository,
    private readonly poRepo: IPurchaseOrderRepository,
    private readonly forecaster: ReorderPointForecaster
  ) {}

  async evaluateRulesForTenant(tenantId: TenantId, windowDays: number = 30): Promise<ReplenishmentEvaluationResult[]> {
    const rules = await this.ruleRepo.findAllByTenant(tenantId);
    const results: ReplenishmentEvaluationResult[] = [];

    if (rules.length === 0) {
      return results;
    }

    const activeRules = rules.filter(r => r.isActive);

    // Pre-fetch related entities to avoid N+1 queries in the loop
    const openPos = await this.poRepo.findAllByTenant(tenantId);
    const openTransfers = await this.transferRepo.findAllByTenant(tenantId);

    // Batch lookup inventory items
    const inventoryPairs = activeRules.map(rule => ({
      sku: rule.sku.value,
      locationId: rule.locationId.value
    }));
    const inventoryMap = new Map<string, any>();
    if (inventoryPairs.length > 0) {
      const inventoryItems = await this.inventoryRepo.findBySkuAndLocationBatch(inventoryPairs);
      for (const item of inventoryItems) {
        inventoryMap.set(`${item.sku.value}_${item.locationId.value}`, item);
      }
    }

    // Batch lookup products
    const skuMap = new Map<string, Sku>();
    for (const rule of activeRules) {
      skuMap.set(rule.sku.value, rule.sku);
    }
    const skusToFetch = Array.from(skuMap.values());
    const productMap = new Map<string, any>();
    if (skusToFetch.length > 0) {
      const products = await this.productRepo.findBySkus(skusToFetch);
      for (const product of products) {
        productMap.set(product.id.value, product);
      }
    }

    for (const rule of rules) {
      if (!rule.isActive) {
        continue;
      }

      try {
        const skuObj = rule.sku;
        const locId = rule.locationId;

        // 1. If dynamic ROP is enabled, calculate and update it
        if (rule.dynamicRopEnabled) {
          const forecastedRop = await this.forecaster.forecastReorderPoint(
            skuObj,
            locId,
            rule.leadTimeDays,
            rule.safetyStock,
            windowDays
          );
          rule.updateReorderPoint(forecastedRop);
          await this.ruleRepo.save(rule);
        }

        // 2. Fetch variantId for SKU
        let variant;
        for (const product of productMap.values()) {
          const v = product.findVariantBySku(skuObj);
          if (v) {
            variant = v;
            break;
          }
        }

        if (!variant) {
          results.push({
            ruleId: rule.id.value,
            sku: skuObj.value,
            locationId: locId.value,
            triggered: false,
            reason: `Product variant with SKU ${skuObj.value} not found in catalog.`,
            reorderPoint: rule.reorderPoint,
            inventoryPosition: 0,
          });
          continue;
        }

        const variantIdStr = variant.id.value;

        // 3. Check for existing open/draft Purchase Orders
        const hasOpenPo = openPos.some((po) => {
          return (
            po.destinationLocationId.equals(locId) &&
            (po.status === PurchaseOrderStatus.Draft || po.status === PurchaseOrderStatus.Ordered) &&
            po.items.some((item) => item.variantId.value === variantIdStr)
          );
        });

        if (hasOpenPo) {
          results.push({
            ruleId: rule.id.value,
            sku: skuObj.value,
            locationId: locId.value,
            triggered: false,
            reason: 'An open/draft Purchase Order already exists for this SKU and location.',
            reorderPoint: rule.reorderPoint,
            inventoryPosition: 0,
          });
          continue;
        }

        // 4. Check for existing open/draft Stock Transfers
        const hasOpenTransfer = openTransfers.some((st) => {
          return (
            st.destinationLocationId.equals(locId) &&
            (st.status === StockTransferStatus.Draft || st.status === StockTransferStatus.Dispatched) &&
            st.items.some((item) => item.variantId.value === variantIdStr)
          );
        });

        if (hasOpenTransfer) {
          results.push({
            ruleId: rule.id.value,
            sku: skuObj.value,
            locationId: locId.value,
            triggered: false,
            reason: 'An open/draft Stock Transfer already exists for this SKU and location.',
            reorderPoint: rule.reorderPoint,
            inventoryPosition: 0,
          });
          continue;
        }

        // 5. Calculate inventory position
        const invItem = inventoryMap.get(`${skuObj.value}_${locId.value}`);
        const onHand = invItem ? invItem.quantity.value : 0;
        const allocated = invItem ? invItem.allocated.value : 0;
        const inTransit = invItem ? invItem.inTransit.value : 0;
        const inventoryPosition = onHand - allocated + inTransit;

        // 6. Check if replenishment threshold is crossed
        if (inventoryPosition < rule.reorderPoint) {
          let actionId = '';
          let actionType: 'TRANSFER' | 'SUPPLIER';

          if (rule.replenishmentType === ReplenishmentType.Transfer) {
            actionType = 'TRANSFER';
            actionId = crypto.randomUUID();

            const stockTransfer = StockTransfer.createNew(
              new StockTransferId(actionId),
              tenantId,
              rule.sourceLocationId!,
              locId,
              [new StockTransferItem(new ProductVariantId(variantIdStr), rule.reorderQuantity)],
              `Replenishment Triggered (Rule: ${rule.id.value})`
            );

            await this.transferRepo.save(stockTransfer);
          } else {
            actionType = 'SUPPLIER';
            actionId = crypto.randomUUID();

            const purchaseOrder = PurchaseOrder.createNew(
              new PurchaseOrderId(actionId),
              tenantId,
              rule.supplierId!,
              locId,
              [new PurchaseOrderItem(new ProductVariantId(variantIdStr), rule.reorderQuantity)]
            );

            await this.poRepo.save(purchaseOrder);
          }

          results.push({
            ruleId: rule.id.value,
            sku: skuObj.value,
            locationId: locId.value,
            triggered: true,
            actionId,
            actionType,
            reorderPoint: rule.reorderPoint,
            inventoryPosition,
          });
        } else {
          results.push({
            ruleId: rule.id.value,
            sku: skuObj.value,
            locationId: locId.value,
            triggered: false,
            reason: `Inventory position (${inventoryPosition}) is at or above reorder point (${rule.reorderPoint}).`,
            reorderPoint: rule.reorderPoint,
            inventoryPosition,
          });
        }
      } catch (error: any) {
        results.push({
          ruleId: rule.id.value,
          sku: rule.sku.value,
          locationId: rule.locationId.value,
          triggered: false,
          reason: `Failed to evaluate rule: ${error.message}`,
          reorderPoint: rule.reorderPoint,
          inventoryPosition: 0,
        });
      }
    }

    return results;
  }
}
