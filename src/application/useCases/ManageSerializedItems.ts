import { SerializedInventoryService } from '../../domain/services/SerializedInventoryService';
import { ISerializedItemRepository } from '../../domain/repositories/ISerializedItemRepository';
import { IInventoryCostLayerRepository } from '../../domain/repositories/IInventoryCostLayerRepository';
import { IJournalRepository } from '../../domain/repositories/IJournalRepository';
import { SerialNumber } from '../../domain/valueObjects/SerialNumber';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { ActorId } from '../../domain/valueObjects/ActorId';
import { SerializedItem } from '../../domain/entities/SerializedItem';
import { SerializedItemStatus } from '../../domain/enums/SerializedItemStatus';
import { CostLayerService } from '../../domain/services/CostLayerService';
import { AccountingJournalService } from '../../domain/services/AccountingJournalService';

// ── Receive ────────────────────────────────────────────────────────────────────

export class ReceiveSerializedItemUseCase {
  constructor(
    private readonly serializedInventoryService: SerializedInventoryService,
    private readonly serialsRepo: ISerializedItemRepository
  ) {}

  async execute(input: {
    variantId: string;
    serialNumber: string;
    tenantId: string;
    locationId: string;
    actorId: string;
    purchaseOrderId: string;
    unitCostCents: number;
  }): Promise<boolean> {
    const sn = new SerialNumber(input.serialNumber);
    const tenant = new TenantId(input.tenantId);
    const variant = new ProductVariantId(input.variantId);
    const location = new LocationId(input.locationId);
    const actor = new ActorId(input.actorId);

    const registered = await this.serialsRepo.isRegistered(sn, tenant);
    if (!registered) {
      await this.serializedInventoryService.register(sn, variant, tenant, location, actor);
    }

    await this.serializedInventoryService.receive(
      sn,
      tenant,
      location,
      input.purchaseOrderId,
      input.unitCostCents,
      actor
    );
    return true;
  }
}

// ── Sell ───────────────────────────────────────────────────────────────────────

export class SellSerializedItemUseCase {
  constructor(private readonly serializedInventoryService: SerializedInventoryService) {}

  async execute(input: {
    serialNumber: string;
    tenantId: string;
    saleId: string;
    actorId: string;
  }): Promise<boolean> {
    await this.serializedInventoryService.sell(
      new SerialNumber(input.serialNumber),
      new TenantId(input.tenantId),
      input.saleId,
      new ActorId(input.actorId)
    );
    return true;
  }
}

// ── Return ─────────────────────────────────────────────────────────────────────

export class ReturnSerializedItemUseCase {
  constructor(private readonly serialsRepo: ISerializedItemRepository) {}

  async execute(input: {
    serialNumber: string;
    tenantId: string;
    referenceId: string;
    actorId: string;
  }): Promise<boolean> {
    const sn = new SerialNumber(input.serialNumber);
    const tenant = new TenantId(input.tenantId);
    const actor = new ActorId(input.actorId);

    const item = await this.serialsRepo.findBySerial(sn, tenant);
    if (!item) {
      throw new Error(`Serial number ${input.serialNumber} not found for tenant ${input.tenantId}.`);
    }

    item.transitionTo(SerializedItemStatus.Returned, `Returned — ref ${input.referenceId}`, actor, input.referenceId);
    await this.serialsRepo.save(item);
    return true;
  }
}

// ── Restock ────────────────────────────────────────────────────────────────────

export class RestockSerializedItemUseCase {
  constructor(private readonly serialsRepo: ISerializedItemRepository) {}

  async execute(input: {
    serialNumber: string;
    tenantId: string;
    locationId: string;
    referenceId: string;
    actorId: string;
  }): Promise<boolean> {
    const sn = new SerialNumber(input.serialNumber);
    const tenant = new TenantId(input.tenantId);
    const actor = new ActorId(input.actorId);

    const item = await this.serialsRepo.findBySerial(sn, tenant);
    if (!item) {
      throw new Error(`Serial number ${input.serialNumber} not found for tenant ${input.tenantId}.`);
    }

    item.transitionTo(SerializedItemStatus.InStock, `Restocked — ref ${input.referenceId}`, actor, input.referenceId);
    await this.serialsRepo.save(item);
    return true;
  }
}

// ── Write-Off ──────────────────────────────────────────────────────────────────

export class WriteOffSerializedItemUseCase {
  private readonly costLayerService: CostLayerService;
  private readonly journalService: AccountingJournalService;

  constructor(
    private readonly serialsRepo: ISerializedItemRepository,
    private readonly costLayerRepo: IInventoryCostLayerRepository,
    private readonly journalRepo: IJournalRepository
  ) {
    this.costLayerService = new CostLayerService(costLayerRepo);
    this.journalService = new AccountingJournalService(journalRepo);
  }

  async execute(input: {
    serialNumber: string;
    variantId: string;
    tenantId: string;
    reason: string;
    actorId: string;
  }): Promise<boolean> {
    const sn = new SerialNumber(input.serialNumber);
    const tenant = new TenantId(input.tenantId);
    const variant = new ProductVariantId(input.variantId);
    const actor = new ActorId(input.actorId);

    const item = await this.serialsRepo.findBySerial(sn, tenant);
    if (!item) {
      throw new Error(`Serial number ${input.serialNumber} not found for tenant ${input.tenantId}.`);
    }

    // Transition to written-off
    item.transitionTo(SerializedItemStatus.WrittenOff, `Written off: ${input.reason}`, actor);

    // Consume the cost layer for this serial and post write-off journal entry
    const costBreakdown = await this.costLayerService.costForSerial(variant, sn);
    await this.journalService.onInventoryWriteOff(
      item.serialNumber.value,
      costBreakdown.totalCostCents,
      new Date(),
      tenant.value
    );

    // Consume the cost layer
    await this.costLayerService.consumeLayers(variant, 1);

    await this.serialsRepo.save(item);
    return true;
  }
}

// ── Queries ────────────────────────────────────────────────────────────────────

export class GetSerializedItemBySerialUseCase {
  constructor(private readonly serialsRepo: ISerializedItemRepository) {}

  async execute(serialNumber: string, tenantId: string): Promise<SerializedItem | null> {
    return await this.serialsRepo.findBySerial(new SerialNumber(serialNumber), new TenantId(tenantId));
  }
}

export class ListSerializedItemsByVariantUseCase {
  constructor(private readonly serialsRepo: ISerializedItemRepository) {}

  async execute(variantId: string, tenantId: string): Promise<SerializedItem[]> {
    return await this.serialsRepo.findByVariantId(
      new ProductVariantId(variantId),
      new TenantId(tenantId)
    );
  }
}

export class CountSerializedItemsByStatusUseCase {
  constructor(private readonly serialsRepo: ISerializedItemRepository) {}

  async execute(variantId: string): Promise<Record<SerializedItemStatus, number>> {
    return await this.serialsRepo.countAllStatuses(new ProductVariantId(variantId));
  }
}
