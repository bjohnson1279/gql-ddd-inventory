import { Kit } from '../../domain/entities/Kit';
import { KitId } from '../../domain/valueObjects/KitId';
import { Sku } from '../../domain/valueObjects/Sku';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { ActorId } from '../../domain/valueObjects/ActorId';
import { InventoryService } from '../../domain/services/InventoryService';

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
