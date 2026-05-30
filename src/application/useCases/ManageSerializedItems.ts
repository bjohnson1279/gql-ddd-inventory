import { SerializedInventoryService } from '../../domain/services/SerializedInventoryService';
import { ISerializedItemRepository } from '../../domain/repositories/ISerializedItemRepository';
import { SerialNumber } from '../../domain/valueObjects/SerialNumber';
import { ProductVariantId } from '../../domain/valueObjects/ProductVariantId';
import { TenantId } from '../../domain/valueObjects/TenantId';
import { LocationId } from '../../domain/valueObjects/LocationId';
import { ActorId } from '../../domain/valueObjects/ActorId';
import { SerializedItem } from '../../domain/entities/SerializedItem';

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

export class GetSerializedItemBySerialUseCase {
  constructor(private readonly serialsRepo: ISerializedItemRepository) {}

  async execute(serialNumber: string, tenantId: string): Promise<SerializedItem | null> {
    return await this.serialsRepo.findBySerial(new SerialNumber(serialNumber), new TenantId(tenantId));
  }
}
