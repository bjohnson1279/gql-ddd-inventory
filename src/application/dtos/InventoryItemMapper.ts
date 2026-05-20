import { InventoryItem } from '../../domain/entities/InventoryItem';
import { InventoryItemDTO } from './InventoryItemDTO';

export class InventoryItemMapper {
  static toDTO(item: InventoryItem): InventoryItemDTO {
    return {
      id: item.id,
      sku: item.sku.value,
      quantity: item.quantity.value,
    };
  }
}
