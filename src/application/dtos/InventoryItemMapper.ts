import { InventoryItem } from '../../domain/entities/InventoryItem';
import { InventoryItemDTO } from './InventoryItemDTO';

export class InventoryItemMapper {
  static toDTO(item: InventoryItem): InventoryItemDTO {
    return {
      id: item.id,
      sku: item.sku.value,
      locationId: item.locationId.value,
      quantity: item.quantity.value,
      allocated: item.allocated.value,
      inTransit: item.inTransit.value,
      available: item.available.value,
      version: item.version
    };
  }
}
