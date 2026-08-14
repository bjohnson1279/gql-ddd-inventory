import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import { IInventoryCostLayerRepository } from '../../domain/repositories/IInventoryCostLayerRepository';
import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { Sku } from '../../domain/valueObjects/Sku';
import { CostLayerService } from '../../domain/services/CostLayerService';
import { CostingMethod } from '../../domain/enums/AccountingEnums';

export interface StockValuationLineItem {
  sku: string;
  variantId: string;
  locationId: string;
  quantityOnHand: number;
  unitCostCents: number;
  totalValueCents: number;
  costingMethod: string;
}

export interface StockValuationReport {
  tenantId: string;
  locationId: string | null;
  method: CostingMethod;
  generatedAt: string;
  totalValueCents: number;
  lineItems: StockValuationLineItem[];
}

export class GetStockValuationReportUseCase {
  private readonly costLayerService: CostLayerService;

  constructor(
    private readonly inventoryRepo: IInventoryRepository,
    private readonly costLayerRepo: IInventoryCostLayerRepository,
    private readonly productRepo: IProductRepository
  ) {
    this.costLayerService = new CostLayerService(costLayerRepo);
  }

  async execute(tenantId: string, locationId: string | null, method: CostingMethod = CostingMethod.FIFO): Promise<StockValuationReport> {
    // Get inventory items (filtered by locationId at the database level if provided)
    const filteredItems = locationId
      ? await this.inventoryRepo.findByLocation(locationId)
      : await this.inventoryRepo.findAll();

    // Get unique SKUs
    const uniqueSkus = Array.from(new Set(filteredItems.map(item => item.sku.value)));

    // Batch-lookup products to get variant IDs for each SKU
    const products = await this.productRepo.findBySkus(uniqueSkus.map(s => new Sku(s)));

    // Build sku → variantId map (use first variant that matches the SKU exactly)
    const skuToVariantId = new Map<string, string>();
    for (const product of products) {
      for (const variant of product.variants) {
        skuToVariantId.set(variant.sku.value, variant.id.value);
      }
    }

    const lineItems: StockValuationLineItem[] = [];
    let totalValueCents = 0;

    const itemsToCalculate = [];
    for (const invItem of filteredItems) {
      const qtyOnHand = invItem.quantity.value;
      if (qtyOnHand <= 0) continue;

      const variantIdStr = skuToVariantId.get(invItem.sku.value);
      if (!variantIdStr) continue;

      itemsToCalculate.push({
        invItem,
        variantIdStr,
        variantId: new ProductVariantId(variantIdStr),
        qtyOnHand,
      });
    }

    const aggregatedRequestMap = new Map<string, { variantId: ProductVariantId; quantity: number }>();

    for (const item of itemsToCalculate) {
      const existing = aggregatedRequestMap.get(item.variantIdStr);
      if (existing) {
        existing.quantity += item.qtyOnHand;
      } else {
        aggregatedRequestMap.set(item.variantIdStr, {
          variantId: item.variantId,
          quantity: item.qtyOnHand,
        });
      }
    }

    const batchRequest = Array.from(aggregatedRequestMap.values());
    const batchResults = await this.costLayerService.calculateCostBatch(batchRequest, method);

    const variantUnitCosts = new Map<string, number>();
    for (let i = 0; i < batchRequest.length; i++) {
      const req = batchRequest[i];
      const costBreakdown = batchResults[i];
      if (costBreakdown && req.quantity > 0) {
        variantUnitCosts.set(req.variantId.value, costBreakdown.totalCostCents / req.quantity);
      } else {
        variantUnitCosts.set(req.variantId.value, 0);
      }
    }

    for (let i = 0; i < itemsToCalculate.length; i++) {
      const { invItem, variantIdStr, qtyOnHand } = itemsToCalculate[i];
      const unitCost = variantUnitCosts.get(variantIdStr) || 0;
      const roundedUnitCost = Math.round(unitCost);
      const totalCostCents = Math.round(unitCost * qtyOnHand);

      lineItems.push({
        sku: invItem.sku.value,
        variantId: variantIdStr,
        locationId: invItem.locationId.value,
        quantityOnHand: qtyOnHand,
        unitCostCents: roundedUnitCost,
        totalValueCents: totalCostCents,
        costingMethod: method,
      });
      totalValueCents += totalCostCents;
    }

    return {
      tenantId,
      locationId,
      method,
      generatedAt: new Date().toISOString(),
      totalValueCents,
      lineItems,
    };
  }
}
