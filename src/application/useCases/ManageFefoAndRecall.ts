import crypto from 'crypto';
import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import { ILedgerRepository } from '../../domain/repositories/ILedgerRepository';
import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { IInventoryCostLayerRepository } from '../../domain/repositories/IInventoryCostLayerRepository';
import { WMSCapacityService } from '../../domain/services/WMSCapacityService';
import { Quantity } from '../../domain/valueObjects/Quantity';
import { InventoryItem } from '../../domain/entities/InventoryItem';
import { LedgerEntry } from '../../domain/entities/LedgerEntry';
import { LedgerEntryId } from '../../domain/valueObjects/LedgerEntryId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { ActorId } from '../../domain/valueObjects/ActorId';
import { ReasonCode } from '../../domain/enums/ReasonCode';
import { Sku } from '../../domain/valueObjects/Sku';
import { InventoryCostLayer, InventoryCostLayerId } from '../../domain/entities/InventoryCostLayer';
import { Lot } from '../../domain/valueObjects/Lot';
import { CostingMethod } from '../../domain/enums/AccountingEnums';
import { ProductVariant } from '../../domain/entities/ProductVariant';
import { FEFOPickingSuggester, FefoPickSuggestion } from '../../domain/services/FEFOPickingSuggester';
import { ProductRecallService, ContaminatedDispatch } from '../../domain/services/ProductRecallService';

export class UpdateVariantCostingMethodUseCase {
  constructor(private readonly productRepo: IProductRepository) {}

  async execute(sku: string, costingMethod: CostingMethod): Promise<ProductVariant> {
    const product = await this.productRepo.findBySku(new Sku(sku));
    if (!product) {
      throw new Error(`Product with SKU ${sku} not found.`);
    }
    const variant = product.variants.find(v => v.sku.value === sku);
    if (!variant) {
      throw new Error(`Variant with SKU ${sku} not found.`);
    }
    variant.costingMethod = costingMethod;
    await this.productRepo.save(product);
    return variant;
  }
}

export interface ReceiveStockWithLotInput {
  sku: string;
  locationId: string;
  quantity: number;
  unitCostCents: number;
  lotNumber: string;
  expirationDate: Date;
  tenantId: string;
  actorId: string;
}

export class ReceiveStockWithLotUseCase {
  constructor(
    private readonly inventoryRepo: IInventoryRepository,
    private readonly productRepo: IProductRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly costLayers: IInventoryCostLayerRepository,
    private readonly capacityService?: WMSCapacityService
  ) {}

  async execute(input: ReceiveStockWithLotInput): Promise<boolean> {
    const skuObj = new Sku(input.sku);
    const product = await this.productRepo.findBySku(skuObj);
    if (!product) {
      throw new Error(`Product variant with SKU ${input.sku} not found.`);
    }
    const variant = product.variants.find(v => v.sku.equals(skuObj));
    if (!variant) {
      throw new Error(`Product variant with SKU ${input.sku} not found.`);
    }

    if (this.capacityService) {
      await this.capacityService.validateCapacity(input.locationId, [
        { sku: input.sku, mode: 'relative', quantity: input.quantity }
      ]);
    }

    // 1. Update Inventory Item
    let item = await this.inventoryRepo.findBySkuAndLocation(input.sku, input.locationId);
    if (!item) {
      item = InventoryItem.createNew(crypto.randomUUID(), input.sku, input.locationId);
    }
    item.receiveStock(new Quantity(input.quantity));
    await this.inventoryRepo.save(item);

    // 2. Append Ledger Entry with Lot details in metadata
    const lot = new Lot(input.lotNumber, input.expirationDate);
    const ledgerEntry = new LedgerEntry(
      new LedgerEntryId(crypto.randomUUID()),
      new TenantId(input.tenantId),
      new LocationId(input.locationId),
      variant.id,
      input.quantity,
      ReasonCode.PurchaseReceipt,
      new ActorId(input.actorId),
      new Date(),
      undefined,
      {
        lotNumber: lot.lotNumber,
        expirationDate: lot.expirationDate.toISOString()
      }
    );
    await this.ledgerRepo.append(ledgerEntry);

    // 3. Create Cost Layer with Lot
    const costLayer = new InventoryCostLayer(
      new InventoryCostLayerId(crypto.randomUUID()),
      variant.id,
      input.quantity,
      input.unitCostCents,
      new Date(),
      undefined,
      lot
    );
    await this.costLayers.save(costLayer);

    return true;
  }
}

export class SuggestFefoPickingUseCase {
  constructor(private readonly pickingSuggester: FEFOPickingSuggester) {}

  async execute(sku: string, quantity: number): Promise<FefoPickSuggestion[]> {
    return await this.pickingSuggester.suggestFefoPicking(new Sku(sku), quantity);
  }
}

export class TraceProductRecallUseCase {
  constructor(private readonly recallService: ProductRecallService) {}

  async execute(lotNumber: string): Promise<ContaminatedDispatch[]> {
    return await this.recallService.traceProductRecall(lotNumber);
  }
}
