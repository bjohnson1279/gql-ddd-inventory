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

    const variantQuantities = new Map<string, number>();
    for (const invItem of filteredItems) {
      const qtyOnHand = invItem.quantity.value;
      if (qtyOnHand <= 0) continue;
      const variantIdStr = skuToVariantId.get(invItem.sku.value);
      if (!variantIdStr) continue;

      variantQuantities.set(variantIdStr, (variantQuantities.get(variantIdStr) || 0) + qtyOnHand);
    }

    const batchRequest = Array.from(variantQuantities.entries()).map(([variantIdStr, quantity]) => ({
      variantId: new ProductVariantId(variantIdStr),
      quantity,
    }));

    const batchResults = await this.costLayerService.calculateCostBatch(batchRequest, method);

    const costMap = new Map<string, import('../../domain/valueObjects/CostBreakdown').CostBreakdown | null>();
    for (let i = 0; i < batchRequest.length; i++) {
        costMap.set(batchRequest[i].variantId.value, batchResults[i]);
    }

    for (const invItem of filteredItems) {
      const qtyOnHand = invItem.quantity.value;
      if (qtyOnHand <= 0) continue;

      const variantIdStr = skuToVariantId.get(invItem.sku.value);
      if (!variantIdStr) continue;

      const totalVariantQty = variantQuantities.get(variantIdStr) || 1;
      const costBreakdown = costMap.get(variantIdStr);

if (costBreakdown && costBreakdown.totalCostCents > 0) {
        const unitCostCents = Math.round(costBreakdown.totalCostCents / totalVariantQty);
        const itemTotalCents = Math.round(unitCostCents * qtyOnHand);

        lineItems.push({
          sku: invItem.sku.value,
          variantId: variantIdStr,
          locationId: invItem.locationId.value,
          quantityOnHand: qtyOnHand,
          unitCostCents,
          totalValueCents: itemTotalCents,
          costingMethod: method,
        });
        totalValueCents += itemTotalCents;
      } else {
        lineItems.push({
          sku: invItem.sku.value,
          variantId: variantIdStr,
          locationId: invItem.locationId.value,
          quantityOnHand: qtyOnHand,
          unitCostCents: 0,
          totalValueCents: 0,
          costingMethod: method,
        });
      }

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
