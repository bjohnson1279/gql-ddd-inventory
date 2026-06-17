import crypto from 'crypto';
import { ReplenishmentRule } from '../../domain/entities/ReplenishmentRule';
import { ReplenishmentRuleId } from '../../domain/valueObjects/ReplenishmentRuleId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { Sku } from '../../domain/valueObjects/Sku';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { ReplenishmentType } from '../../domain/enums/ReplenishmentType';
import { IReplenishmentRuleRepository } from '../../domain/repositories/IReplenishmentRuleRepository';
import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { IPurchaseOrderRepository } from '../../domain/repositories/IPurchaseOrderRepository';
import { ILedgerRepository } from '../../domain/repositories/ILedgerRepository';
import { PurchaseOrder } from '../../domain/entities/PurchaseOrder';
import { PurchaseOrderId } from '../../domain/valueObjects/PurchaseOrderId';
import { PurchaseOrderItem } from '../../domain/valueObjects/PurchaseOrderItem';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { PurchaseOrderStatus } from '../../domain/enums/PurchaseOrderStatus';
import { ReplenishmentEvaluator, ReplenishmentEvaluationResult } from '../../domain/services/ReplenishmentEvaluator';
import { Quantity } from '../../domain/valueObjects/Quantity';
import { InventoryItem } from '../../domain/entities/InventoryItem';
import { appendStockLedgerEntries } from '../../infrastructure/utils/ledgerEntryUtils';
import { ReasonCode } from '../../domain/enums/ReasonCode';

export interface ReplenishmentRuleDTO {
  id: string;
  tenantId: string;
  sku: string;
  locationId: string;
  reorderPoint: number;
  reorderQuantity: number;
  safetyStock: number;
  leadTimeDays: number;
  replenishmentType: string;
  sourceLocationId: string | null;
  supplierId: string | null;
  isActive: boolean;
  dynamicRopEnabled: boolean;
}

export interface PurchaseOrderDTO {
  id: string;
  tenantId: string;
  supplierId: string;
  destinationLocationId: string;
  status: string;
  items: { variantId: string; quantity: number }[];
  createdAt: string;
  updatedAt: string;
}

function toRuleDTO(rule: ReplenishmentRule): ReplenishmentRuleDTO {
  return {
    id: rule.id.value,
    tenantId: rule.tenantId.value,
    sku: rule.sku.value,
    locationId: rule.locationId.value,
    reorderPoint: rule.reorderPoint,
    reorderQuantity: rule.reorderQuantity,
    safetyStock: rule.safetyStock,
    leadTimeDays: rule.leadTimeDays,
    replenishmentType: rule.replenishmentType,
    sourceLocationId: rule.sourceLocationId ? rule.sourceLocationId.value : null,
    supplierId: rule.supplierId,
    isActive: rule.isActive,
    dynamicRopEnabled: rule.dynamicRopEnabled,
  };
}

function toPoDTO(po: PurchaseOrder): PurchaseOrderDTO {
  return {
    id: po.id.value,
    tenantId: po.tenantId.value,
    supplierId: po.supplierId,
    destinationLocationId: po.destinationLocationId.value,
    status: po.status,
    items: po.items.map((item) => ({
      variantId: item.variantId.value,
      quantity: item.quantity,
    })),
    createdAt: po.createdAt.toISOString(),
    updatedAt: po.updatedAt.toISOString(),
  };
}

export class CreateReplenishmentRuleUseCase {
  constructor(private readonly ruleRepo: IReplenishmentRuleRepository) {}

  async execute(input: {
    tenantId: string;
    sku: string;
    locationId: string;
    reorderPoint: number;
    reorderQuantity: number;
    safetyStock: number;
    leadTimeDays: number;
    replenishmentType: ReplenishmentType;
    sourceLocationId?: string | null;
    supplierId?: string | null;
    dynamicRopEnabled?: boolean;
  }): Promise<ReplenishmentRuleDTO> {
    const id = new ReplenishmentRuleId(crypto.randomUUID());
    const tenantId = new TenantId(input.tenantId);
    const sku = new Sku(input.sku);
    const locationId = new LocationId(input.locationId);
    const sourceLoc = input.sourceLocationId ? new LocationId(input.sourceLocationId) : null;

    const rule = ReplenishmentRule.createNew(
      id,
      tenantId,
      sku,
      locationId,
      input.reorderPoint,
      input.reorderQuantity,
      input.safetyStock,
      input.leadTimeDays,
      input.replenishmentType,
      sourceLoc,
      input.supplierId || null,
      input.dynamicRopEnabled
    );

    await this.ruleRepo.save(rule);
    return toRuleDTO(rule);
  }
}

export class UpdateReplenishmentRuleUseCase {
  constructor(private readonly ruleRepo: IReplenishmentRuleRepository) {}

  async execute(input: {
    id: string;
    reorderQuantity: number;
    safetyStock: number;
    leadTimeDays: number;
    dynamicRopEnabled: boolean;
    reorderPoint?: number;
  }): Promise<ReplenishmentRuleDTO> {
    const ruleId = new ReplenishmentRuleId(input.id);
    const rule = await this.ruleRepo.findById(ruleId);
    if (!rule) {
      throw new Error(`Replenishment rule ${input.id} not found.`);
    }

    rule.updateConfiguration(
      input.reorderQuantity,
      input.safetyStock,
      input.leadTimeDays,
      input.dynamicRopEnabled,
      input.reorderPoint
    );

    await this.ruleRepo.save(rule);
    return toRuleDTO(rule);
  }
}

export class ToggleReplenishmentRuleUseCase {
  constructor(private readonly ruleRepo: IReplenishmentRuleRepository) {}

  async execute(id: string, isActive: boolean): Promise<ReplenishmentRuleDTO> {
    const ruleId = new ReplenishmentRuleId(id);
    const rule = await this.ruleRepo.findById(ruleId);
    if (!rule) {
      throw new Error(`Replenishment rule ${id} not found.`);
    }

    rule.toggleActive(isActive);
    await this.ruleRepo.save(rule);
    return toRuleDTO(rule);
  }
}

export class EvaluateReplenishmentUseCase {
  constructor(private readonly evaluator: ReplenishmentEvaluator) {}

  async execute(tenantId: string, windowDays: number = 30): Promise<ReplenishmentEvaluationResult[]> {
    return await this.evaluator.evaluateRulesForTenant(new TenantId(tenantId), windowDays);
  }
}

export class GetReplenishmentRulesUseCase {
  constructor(private readonly ruleRepo: IReplenishmentRuleRepository) {}

  async execute(tenantId: string): Promise<ReplenishmentRule[]> {
    return await this.ruleRepo.findAllByTenant(new TenantId(tenantId));
  }
}

export class CreatePurchaseOrderUseCase {
  constructor(private readonly poRepo: IPurchaseOrderRepository) {}

  async execute(input: {
    tenantId: string;
    supplierId: string;
    destinationLocationId: string;
    items: { variantId: string; quantity: number }[];
  }): Promise<PurchaseOrderDTO> {
    const id = new PurchaseOrderId(crypto.randomUUID());
    const tenantId = new TenantId(input.tenantId);
    const destLoc = new LocationId(input.destinationLocationId);
    const items = input.items.map(
      (item) => new PurchaseOrderItem(new ProductVariantId(item.variantId), item.quantity)
    );

    const po = PurchaseOrder.createNew(id, tenantId, input.supplierId, destLoc, items);
    await this.poRepo.save(po);
    return toPoDTO(po);
  }
}

export class PlacePurchaseOrderUseCase {
  constructor(
    private readonly poRepo: IPurchaseOrderRepository,
    private readonly inventoryRepo: IInventoryRepository,
    private readonly productRepo: IProductRepository
  ) {}

  async execute(id: string): Promise<PurchaseOrderDTO> {
    const poId = new PurchaseOrderId(id);
    const po = await this.poRepo.findById(poId);
    if (!po) {
      throw new Error(`Purchase order ${id} not found.`);
    }

    po.place();

    // Batch operations to fix N+1 query
    const variantIds = po.items.map(i => i.variantId.value);
    const variantSkus = await this.productRepo.findSkusByVariantIds(variantIds);

    const destPairs = po.items.map(item => {
      const sku = variantSkus.get(item.variantId.value);
      if (!sku) throw new Error(`Variant ${item.variantId.value} not found in product catalog.`);
      return { sku, locationId: po.destinationLocationId.value };
    });

    const destItemsList = await this.inventoryRepo.findBySkuAndLocationBatch(destPairs);
    const destItemsMap = new Map(destItemsList.map(i => [`${i.sku.value}_${i.locationId.value}`, i]));

    const itemsToSave = new Map<string, InventoryItem>();

    // Increment in-transit stock for items
    for (const item of po.items) {
      const sku = variantSkus.get(item.variantId.value)!;
      const key = `${sku}_${po.destinationLocationId.value}`;

      let invItem = destItemsMap.get(key);
      if (!invItem) {
        invItem = InventoryItem.createNew(crypto.randomUUID(), sku, po.destinationLocationId.value);
        destItemsMap.set(key, invItem);
      }
      invItem.createInTransit(new Quantity(item.quantity));
      itemsToSave.add(invItem);
    }

    await this.inventoryRepo.saveBatch(Array.from(itemsToSave));

    await this.poRepo.save(po);
    return toPoDTO(po);
  }
}

export class ReceivePurchaseOrderUseCase {
  constructor(
    private readonly poRepo: IPurchaseOrderRepository,
    private readonly inventoryRepo: IInventoryRepository,
    private readonly productRepo: IProductRepository,
    private readonly ledgerRepo: ILedgerRepository
  ) {}

  async execute(id: string, actorId: string, tenantId: string): Promise<PurchaseOrderDTO> {
    const poId = new PurchaseOrderId(id);
    const po = await this.poRepo.findById(poId);
    if (!po) {
      throw new Error(`Purchase order ${id} not found.`);
    }

    po.receive();

    // Batch operations to fix N+1 query
    const variantIds = po.items.map(i => i.variantId.value);
    const variantSkus = await this.productRepo.findSkusByVariantIds(variantIds);

    const destPairs = po.items.map(item => {
      const sku = variantSkus.get(item.variantId.value);
      if (!sku) throw new Error(`Variant ${item.variantId.value} not found in product catalog.`);
      return { sku, locationId: po.destinationLocationId.value };
    });

    const destItemsList = await this.inventoryRepo.findBySkuAndLocationBatch(destPairs);
    const destItemsMap = new Map(destItemsList.map(i => [`${i.sku.value}_${i.locationId.value}`, i]));

    const itemsToSave = new Map<string, InventoryItem>();
    const ledgerEntriesData: { sku: string; locationId: string; quantity: number }[] = [];

    // Deduct in-transit, increment physical stock, write ledger entry
    for (const item of po.items) {
      const sku = variantSkus.get(item.variantId.value)!;
      const key = `${sku}_${po.destinationLocationId.value}`;

      const invItem = destItemsMap.get(key);
      if (!invItem) {
        throw new Error(`Inventory record for SKU ${sku} at destination location ${po.destinationLocationId.value} not found.`);
      }

      invItem.receiveInTransit(new Quantity(item.quantity));
      itemsToSave.add(invItem);

      // Append ledger receipt
      ledgerEntriesData.push({ sku, locationId: po.destinationLocationId.value, quantity: item.quantity });
    }

    await this.inventoryRepo.saveBatch(Array.from(itemsToSave));

    await appendStockLedgerEntries(
      this.productRepo,
      this.ledgerRepo,
      ledgerEntriesData,
      ReasonCode.PurchaseReceipt,
      { auth: { tenantId, actorId } }
    );

    await this.poRepo.save(po);
    return toPoDTO(po);
  }
}

export class CancelPurchaseOrderUseCase {
  constructor(
    private readonly poRepo: IPurchaseOrderRepository,
    private readonly inventoryRepo: IInventoryRepository,
    private readonly productRepo: IProductRepository
  ) {}

  async execute(id: string): Promise<PurchaseOrderDTO> {
    const poId = new PurchaseOrderId(id);
    const po = await this.poRepo.findById(poId);
    if (!po) {
      throw new Error(`Purchase order ${id} not found.`);
    }

    const previousStatus = po.status;
    po.cancel();

    // Revert in-transit if it was already ordered
    if (previousStatus === PurchaseOrderStatus.Ordered) {
      // Batch operations to fix N+1 query
      const variantIds = po.items.map(i => i.variantId.value);
      const variantSkus = await this.productRepo.findSkusByVariantIds(variantIds);

      const destPairs = po.items.map(item => {
        const sku = variantSkus.get(item.variantId.value);
        if (!sku) throw new Error(`Variant ${item.variantId.value} not found in product catalog.`);
        return { sku, locationId: po.destinationLocationId.value };
      });

      const destItemsList = await this.inventoryRepo.findBySkuAndLocationBatch(destPairs);
      const destItemsMap = new Map(destItemsList.map(i => [`${i.sku.value}_${i.locationId.value}`, i]));

      const itemsToSave = new Set<InventoryItem>();

      for (const item of po.items) {
        const sku = variantSkus.get(item.variantId.value)!;
        const key = `${sku}_${po.destinationLocationId.value}`;
        const invItem = destItemsMap.get(key);
        if (invItem) {
          invItem.cancelInTransit(new Quantity(item.quantity));
          itemsToSave.add(invItem);
        }
      }

      await this.inventoryRepo.saveBatch(Array.from(itemsToSave));
    }

    await this.poRepo.save(po);
    return toPoDTO(po);
  }
}

export class GetPurchaseOrdersUseCase {
  constructor(private readonly poRepo: IPurchaseOrderRepository) {}

  async execute(tenantId: string): Promise<PurchaseOrder[]> {
    return await this.poRepo.findAllByTenant(new TenantId(tenantId));
  }
}

export class GetPurchaseOrderByIdUseCase {
  constructor(private readonly poRepo: IPurchaseOrderRepository) {}

  async execute(id: string): Promise<PurchaseOrder | null> {
    return await this.poRepo.findById(new PurchaseOrderId(id));
  }
}
