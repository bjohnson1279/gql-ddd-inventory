import { ISerializedItemRepository } from '../repositories/ISerializedItemRepository';
import { ILedgerRepository } from '../repositories/ILedgerRepository';
import { SerialNumber } from '../valueObjects/SerialNumber';
import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { TenantId } from '../valueObjects/TenantId';
import { LocationId } from '../valueObjects/LocationId';
import { ActorId } from '../valueObjects/ActorId';
import { SerializedItem } from '../entities/SerializedItem';
import { SerializedItemId } from '../valueObjects/SerializedItemId';
import { SerializedItemStatus } from '../enums/SerializedItemStatus';
import { LedgerEntry } from '../entities/LedgerEntry';
import { LedgerEntryId } from '../valueObjects/LedgerEntryId';
import { ReasonCode } from '../enums/ReasonCode';

export class SerializedInventoryService {
  constructor(
    private readonly serials: ISerializedItemRepository,
    private readonly ledger: ILedgerRepository,
    private readonly eventDispatcher: (event: any) => void = () => {}
  ) {}

  async register(
    serialNumber: SerialNumber,
    variantId: ProductVariantId,
    tenantId: TenantId,
    locationId: LocationId,
    actor: ActorId
  ): Promise<SerializedItem> {
    if (await this.serials.isRegistered(serialNumber, tenantId)) {
      throw new Error(`Serial number ${serialNumber.value} is already registered.`);
    }

    const item = new SerializedItem(
      new SerializedItemId(this.generateId()),
      variantId,
      serialNumber,
      tenantId,
      locationId,
      SerializedItemStatus.Pending
    );

    await this.serials.save(item);
    return item;
  }

  async receive(
    serialNumber: SerialNumber,
    tenantId: TenantId,
    location: LocationId,
    purchaseOrderId: string,
    unitCostCents: number,
    actor: ActorId
  ): Promise<void> {
    const item = await this.serials.findBySerial(serialNumber, tenantId);
    if (!item) {
      throw new Error(`Serial number ${serialNumber.value} not found.`);
    }

    item.receive(location, actor, purchaseOrderId);

    const entry = new LedgerEntry(
      new LedgerEntryId(this.generateId()),
      tenantId,
      location,
      item.variantId,
      1,
      ReasonCode.PurchaseReceipt,
      actor,
      new Date(),
      purchaseOrderId,
      { serialNumber: serialNumber.value, unitCostCents }
    );

    await this.ledger.append(entry);
    await this.serials.save(item);
    this.dispatchEvents(item);
  }

  async sell(
    serialNumber: SerialNumber,
    tenantId: TenantId,
    saleId: string,
    actor: ActorId
  ): Promise<void> {
    const item = await this.serials.findBySerial(serialNumber, tenantId);
    if (!item) {
      throw new Error(`Serial number ${serialNumber.value} not found.`);
    }

    item.sell(saleId, actor);

    const entry = new LedgerEntry(
      new LedgerEntryId(this.generateId()),
      tenantId,
      item.locationId,
      item.variantId,
      -1,
      ReasonCode.Sale,
      actor,
      new Date(),
      saleId,
      { serialNumber: serialNumber.value }
    );

    await this.ledger.append(entry);
    await this.serials.save(item);
    this.dispatchEvents(item);
  }

  private dispatchEvents(item: SerializedItem): void {
    const events = item.pullDomainEvents();
    for (const event of events) {
      this.eventDispatcher(event);
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
