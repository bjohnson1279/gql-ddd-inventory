export interface ShopifyInventoryLevel {
  locationId: string;
  inventoryItemId: string;
  available: number;
}

export interface IShopifyClient {
  setInventory(
    storeDomain: string,
    accessToken: string,
    inventoryItemId: string,
    locationId: string,
    availableQuantity: number
  ): Promise<void>;

  // This would return the externalId of the product
  upsertProduct(
    storeDomain: string,
    accessToken: string,
    productData: any
  ): Promise<string>;

  getInventoryLevels(
    storeDomain: string,
    accessToken: string,
    inventoryItemId: string
  ): Promise<ShopifyInventoryLevel[]>;
}
