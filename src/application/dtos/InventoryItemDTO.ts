export interface InventoryItemDTO {
  id: string;
  sku: string;
  locationId: string;
  quantity: number;
  allocated: number;
  inTransit: number;
  available: number;
  version: number;
}
