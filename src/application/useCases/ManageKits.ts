import { Kit } from '../../domain/entities/Kit';
import { KitId } from '../../domain/valueObjects/KitId';
import { Sku } from '../../domain/valueObjects/Sku';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { ActorId } from '../../domain/valueObjects/ActorId';
import { InventoryService } from '../../domain/services/InventoryService';
import { IKitRepository } from '../../domain/repositories/IKitRepository';
import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { ILedgerRepository } from '../../domain/repositories/ILedgerRepository';
import { IJournalRepository } from '../../domain/repositories/IJournalRepository';
import { IInventoryCostLayerRepository } from '../../domain/repositories/IInventoryCostLayerRepository';
import { LedgerEntry } from '../../domain/entities/LedgerEntry';
import { LedgerEntryId } from '../../domain/valueObjects/LedgerEntryId';
import { ReasonCode } from '../../domain/enums/ReasonCode';
import { InventoryCostLayer, InventoryCostLayerId } from '../../domain/entities/InventoryCostLayer';
import { CostLayerService } from '../../domain/services/CostLayerService';
import { JournalEntry } from '../../domain/entities/JournalEntry';
import { JournalEntryId } from '../../domain/valueObjects/JournalEntryId';
import { AccountCode } from '../../domain/valueObjects/AccountCode';
import { DebitCredit, AccountingMethod } from '../../domain/enums/AccountingEnums';

export interface KitComponentInput {
  variantId: string;
  quantity: number;
}

export class SellKitUseCase {
  constructor(private readonly inventoryService: InventoryService) {}

  async execute(input: {
    tenantId: string;
    locationId: string;
    kitId: string;
    sku: string;
    name: string;
    quantity: number;
    referenceId: string;
    actorId: string;
    components: KitComponentInput[];
  }): Promise<boolean> {
    const kit = new Kit(
      new KitId(input.kitId),
      new Sku(input.sku),
      input.name
    );

    for (const comp of input.components) {
      kit.addComponent(new ProductVariantId(comp.variantId), comp.quantity);
    }

    await this.inventoryService.decrementForKitSale(
      new TenantId(input.tenantId),
      new LocationId(input.locationId),
      kit,
      input.quantity,
      input.referenceId,
      new ActorId(input.actorId)
    );

    return true;
  }
}

export interface AssembleKitInput {
  tenantId: string;
  locationId: string;
  kitSku: string;
  quantity: number;
  actorId: string;
  referenceId: string;
}

export class AssembleKitUseCase {
  constructor(
    private readonly kitRepo: IKitRepository,
    private readonly productRepo: IProductRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly costLayers: IInventoryCostLayerRepository,
    private readonly journalRepo: IJournalRepository
  ) {}

  async execute(input: AssembleKitInput): Promise<boolean> {
    const tenantId = new TenantId(input.tenantId);
    const locationId = new LocationId(input.locationId);
    const actorId = new ActorId(input.actorId);
    const kitSku = new Sku(input.kitSku);

    // 1. Resolve kit details
    const kit = await this.kitRepo.findBySku(kitSku);
    if (!kit) {
      throw new Error(`Kit with SKU ${input.kitSku} not found.`);
    }

    // 2. Resolve kit's product variant
    const kitProduct = await this.productRepo.findBySku(kitSku);
    if (!kitProduct) {
      throw new Error(`Product variant for Kit SKU ${input.kitSku} not found.`);
    }
    const kitVariant = kitProduct.variants.find(v => v.sku.equals(kitSku));
    if (!kitVariant) {
      throw new Error(`Variant for Kit SKU ${input.kitSku} not found.`);
    }

    // 3. First pass: Validate component stock level
    const componentVariantIds = kit.components.map(c => c.variantId);
    const availableQuantities = await this.ledgerRepo.currentQuantities(componentVariantIds, locationId);

    for (const component of kit.components) {
      const needed = component.quantity * input.quantity;
      const available = availableQuantities.get(component.variantId.value) || 0;
      if (available < needed) {
        throw new Error(`Insufficient stock for component variant ID ${component.variantId.value}. Needed: ${needed}, Available: ${available}`);
      }
    }

    // 4. Second pass: Consume FIFO costing layers for components and calculate total components cost
    const costService = new CostLayerService(this.costLayers);
    let totalCostCents = 0;

    for (const component of kit.components) {
      const needed = component.quantity * input.quantity;
      const breakdown = await costService.consumeFifoLayers(component.variantId, needed);
      totalCostCents += breakdown.totalCostCents;

      // Add deduction ledger entry for this component
      const entryId = Math.random().toString(36).substring(2, 15);
      const ledgerEntry = new LedgerEntry(
        new LedgerEntryId(entryId),
        tenantId,
        locationId,
        component.variantId,
        -needed,
        ReasonCode.KitAssembly,
        actorId,
        new Date(),
        input.referenceId
      );
      await this.ledgerRepo.append(ledgerEntry);
    }

    // 5. Calculate assembled unit cost
    const unitCostCents = Math.round(totalCostCents / input.quantity);

    // 6. Create new costing layer for the assembled Kit variant
    const kitLayerId = Math.random().toString(36).substring(2, 15);
    const newKitLayer = new InventoryCostLayer(
      new InventoryCostLayerId(kitLayerId),
      kitVariant.id,
      input.quantity,
      unitCostCents,
      new Date()
    );
    await this.costLayers.save(newKitLayer);

    // 7. Add increment ledger entry for the Kit variant
    const kitEntryId = Math.random().toString(36).substring(2, 15);
    const kitLedgerEntry = new LedgerEntry(
      new LedgerEntryId(kitEntryId),
      tenantId,
      locationId,
      kitVariant.id,
      input.quantity,
      ReasonCode.KitAssembly,
      actorId,
      new Date(),
      input.referenceId
    );
    await this.ledgerRepo.append(kitLedgerEntry);

    // 8. Write balanced double-entry Journal Entry to record inventory value shift
    const journalId = Math.random().toString(36).substring(2, 15);
    const journalEntry = new JournalEntry(
      new JournalEntryId(journalId),
      tenantId,
      new Date(),
      `Assemble ${input.quantity} units of Kit ${input.kitSku}`,
      AccountingMethod.Accrual,
      input.referenceId
    );

    // Debit finished goods (kits)
    journalEntry.addLine(
      AccountCode.fromCode('1200'),
      totalCostCents,
      DebitCredit.Debit,
      `Debit Kit Inventory for ${input.kitSku} assembly`
    );

    // Credit raw components
    journalEntry.addLine(
      AccountCode.fromCode('1210'),
      totalCostCents,
      DebitCredit.Credit,
      `Credit Component Inventory for ${input.kitSku} assembly`
    );

    await this.journalRepo.save(journalEntry);

    return true;
  }
}

export interface DisassembleKitInput {
  tenantId: string;
  locationId: string;
  kitSku: string;
  quantity: number;
  actorId: string;
  referenceId: string;
}

export class DisassembleKitUseCase {
  constructor(
    private readonly kitRepo: IKitRepository,
    private readonly productRepo: IProductRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly costLayers: IInventoryCostLayerRepository,
    private readonly journalRepo: IJournalRepository
  ) {}

  async execute(input: DisassembleKitInput): Promise<boolean> {
    const tenantId = new TenantId(input.tenantId);
    const locationId = new LocationId(input.locationId);
    const actorId = new ActorId(input.actorId);
    const kitSku = new Sku(input.kitSku);

    // 1. Resolve kit details
    const kit = await this.kitRepo.findBySku(kitSku);
    if (!kit) {
      throw new Error(`Kit with SKU ${input.kitSku} not found.`);
    }

    // 2. Resolve kit's product variant
    const kitProduct = await this.productRepo.findBySku(kitSku);
    if (!kitProduct) {
      throw new Error(`Product variant for Kit SKU ${input.kitSku} not found.`);
    }
    const kitVariant = kitProduct.variants.find(v => v.sku.equals(kitSku));
    if (!kitVariant) {
      throw new Error(`Variant for Kit SKU ${input.kitSku} not found.`);
    }

    // 3. First pass: Validate kit stock level
    const availableKitStock = await this.ledgerRepo.currentQuantity(kitVariant.id, locationId);
    if (availableKitStock < input.quantity) {
      throw new Error(`Insufficient stock for Kit variant ${input.kitSku}. Needed: ${input.quantity}, Available: ${availableKitStock}`);
    }

    // 4. Consume FIFO costing layers for the Kit variant
    const costService = new CostLayerService(this.costLayers);
    const kitBreakdown = await costService.consumeFifoLayers(kitVariant.id, input.quantity);
    const totalDisassembledCost = kitBreakdown.totalCostCents;

    // Add deduction ledger entry for the Kit variant
    const kitEntryId = Math.random().toString(36).substring(2, 15);
    const kitLedgerEntry = new LedgerEntry(
      new LedgerEntryId(kitEntryId),
      tenantId,
      locationId,
      kitVariant.id,
      -input.quantity,
      ReasonCode.KitDisassembly,
      actorId,
      new Date(),
      input.referenceId
    );
    await this.ledgerRepo.append(kitLedgerEntry);

    // 5. Estimate components value and distribute cost proportionally
    let totalEstimatedComponentsCost = 0;
    const componentAvgCosts: { variantId: ProductVariantId; quantity: number; avgUnitCost: number }[] = [];

    for (const component of kit.components) {
      const needed = component.quantity * input.quantity;
      let avgUnitCost = 0;
      try {
        const breakdown = await costService.calculateWeightedAverageCost(component.variantId, 1);
        avgUnitCost = breakdown.totalCostCents;
      } catch (err) {
        // Fallback if no inventory layers exist for this component
        const activeLayers = await this.costLayers.getActiveLayers(component.variantId);
        avgUnitCost = activeLayers.length > 0 ? activeLayers[0].unitCostCents : 1000; // default 10.00
      }
      componentAvgCosts.push({
        variantId: component.variantId,
        quantity: needed,
        avgUnitCost
      });
      totalEstimatedComponentsCost += needed * avgUnitCost;
    }

    const scaleFactor = totalEstimatedComponentsCost > 0 ? totalDisassembledCost / totalEstimatedComponentsCost : 0;

    // 6. Restore component variants stock and costing layers
    const newLayers: InventoryCostLayer[] = [];
    const newLedgerEntries: LedgerEntry[] = [];

    for (const item of componentAvgCosts) {
      const allocatedUnitCost = scaleFactor > 0 ? Math.round(item.avgUnitCost * scaleFactor) : 0;

      // Add new costing layer for restored component
      const layerId = Math.random().toString(36).substring(2, 15);
      const newLayer = new InventoryCostLayer(
        new InventoryCostLayerId(layerId),
        item.variantId,
        item.quantity,
        allocatedUnitCost,
        new Date()
      );
      newLayers.push(newLayer);

      // Add increment ledger entry for this component
      const entryId = Math.random().toString(36).substring(2, 15);
      const ledgerEntry = new LedgerEntry(
        new LedgerEntryId(entryId),
        tenantId,
        locationId,
        item.variantId,
        item.quantity,
        ReasonCode.KitDisassembly,
        actorId,
        new Date(),
        input.referenceId
      );
      newLedgerEntries.push(ledgerEntry);
    }

    // Use batch save methods if available, otherwise fallback to iterative saves
    if (this.costLayers.saveBatch) {
      await this.costLayers.saveBatch(newLayers);
    } else {
      for (const layer of newLayers) {
        await this.costLayers.save(layer);
      }
    }

    if (this.ledgerRepo.appendBatch) {
      await this.ledgerRepo.appendBatch(newLedgerEntries);
    } else {
      for (const entry of newLedgerEntries) {
        await this.ledgerRepo.append(entry);
      }
    }

    // 7. Write balanced double-entry Journal Entry to record inventory value shift
    const journalId = Math.random().toString(36).substring(2, 15);
    const journalEntry = new JournalEntry(
      new JournalEntryId(journalId),
      tenantId,
      new Date(),
      `Disassemble ${input.quantity} units of Kit ${input.kitSku}`,
      AccountingMethod.Accrual,
      input.referenceId
    );

    // Debit raw components (restored)
    journalEntry.addLine(
      AccountCode.fromCode('1210'),
      totalDisassembledCost,
      DebitCredit.Debit,
      `Debit Component Inventory for ${input.kitSku} disassembly`
    );

    // Credit finished goods (kits)
    journalEntry.addLine(
      AccountCode.fromCode('1200'),
      totalDisassembledCost,
      DebitCredit.Credit,
      `Credit Kit Inventory for ${input.kitSku} disassembly`
    );

    await this.journalRepo.save(journalEntry);

    return true;
  }
}
