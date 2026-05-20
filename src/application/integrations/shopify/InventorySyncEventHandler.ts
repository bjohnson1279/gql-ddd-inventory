import { InventoryDecremented } from '../../../domain/events/InventoryEvents';
import { SyncInventoryToShopify } from './SyncInventoryToShopify';

export class InventorySyncEventHandler {
  constructor(private readonly syncUseCase: SyncInventoryToShopify) {}

  async handleInventoryDecremented(event: InventoryDecremented): Promise<void> {
    await this.syncUseCase.execute(
      event.tenantId,
      event.locationId,
      event.variantId.value
    );
  }
}
