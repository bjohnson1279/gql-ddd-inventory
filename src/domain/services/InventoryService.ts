import { ILedgerRepository } from '../repositories/ILedgerRepository';
import { ProductVariantId } from '../valueObjects/ProductVariantId';
import { ActorId } from '../valueObjects/ActorId';
import { LedgerEntry } from '../entities/LedgerEntry';
import { LedgerEntryId } from '../valueObjects/LedgerEntryId';
import { ReasonCode } from '../enums/ReasonCode';
import { Kit } from '../entities/Kit';
import { InventoryDecremented } from '../events/InventoryEvents';
import { LocationId } from '../valueObjects/LocationId';
import { TenantId } from '../valueObjects/TenantId';

export class InventoryService {
  constructor(
    private readonly ledgerRepository: ILedgerRepository,
    private readonly eventDispatcher: (event: any) => void = () => {}
  ) {}

  async decrementForSale(
    tenantId: TenantId,
    locationId: LocationId,
    variantId: ProductVariantId,
    quantity: number,
    saleId: string,
    actor: ActorId
  ): Promise<void> {
    await this.assertSufficientStock(variantId, locationId, quantity);

    const entry = new LedgerEntry(
      new LedgerEntryId(this.generateId()),
      tenantId,
      locationId,
      variantId,
      -quantity,
      ReasonCode.Sale,
      actor,
      new Date(),
      saleId
    );

    await this.ledgerRepository.append(entry);
    this.eventDispatcher(new InventoryDecremented(tenantId.value, locationId.value, variantId, quantity, saleId));
  }

  async decrementForKitSale(
    tenantId: TenantId,
    locationId: LocationId,
    kit: Kit,
    kitQuantity: number,
    saleId: string,
    actor: ActorId
  ): Promise<void> {
    if (kit.isEmpty) {
      throw new Error('Cannot sell a kit with no components.');
    }

    // --- Pass 1: validate all components upfront ---
    for (const component of kit.components) {
      const needed = component.quantity * kitQuantity;
      await this.assertSufficientStock(component.variantId, locationId, needed);
    }

    // --- Pass 2: write ledger entries for each component ---
    for (const component of kit.components) {
      const needed = component.quantity * kitQuantity;
      const entry = new LedgerEntry(
        new LedgerEntryId(this.generateId()),
        tenantId,
        locationId,
        component.variantId,
        -needed,
        ReasonCode.KitSale,
        actor,
        new Date(),
        saleId
      );

      await this.ledgerRepository.append(entry);
      this.eventDispatcher(new InventoryDecremented(tenantId.value, locationId.value, component.variantId, needed, saleId));
    }
  }

  private async assertSufficientStock(
    variantId: ProductVariantId,
    locationId: LocationId,
    needed: number
  ): Promise<void> {
    const available = await this.ledgerRepository.currentQuantity(variantId, locationId);

    if (available < needed) {
      throw new Error(
        `Insufficient stock for variant ${variantId.value}. Requested: ${needed}, Available: ${available}`
      );
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
