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
    // Get all inventory items (optionally filtered by locationId)
    const allItems = await this.inventoryRepo.findAll();
    const filteredItems = locationId
      ? allItems.filter(item => item.locationId.value === locationId)
      : allItems;

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
        variantId: new ProductVariantId(variantIdStr),
        quantity: qtyOnHand,
        invItem,
        variantIdStr
      });
    }

    const breakdowns = await this.costLayerService.calculateCostBatch(
      itemsToCalculate.map(i => ({ variantId: i.variantId, quantity: i.quantity })),
      new Map(itemsToCalculate.map(i => [i.variantIdStr, method]))
    );

    for (let i = 0; i < itemsToCalculate.length; i++) {
      const item = itemsToCalculate[i];
      const costBreakdown = breakdowns[i];

      if (costBreakdown) {
        const unitCostCents = item.quantity > 0 ? Math.round(costBreakdown.totalCostCents / item.quantity) : 0;

        lineItems.push({
          sku: item.invItem.sku.value,
          variantId: item.variantIdStr,
          locationId: item.invItem.locationId.value,
          quantityOnHand: item.quantity,
          unitCostCents,
          totalValueCents: costBreakdown.totalCostCents,
          costingMethod: method,
        });

        totalValueCents += costBreakdown.totalCostCents;
      } else {
        // No cost layers exist for this variant — include with $0 value
        lineItems.push({
          sku: item.invItem.sku.value,
          variantId: item.variantIdStr,
          locationId: item.invItem.locationId.value,
          quantityOnHand: item.quantity,
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
