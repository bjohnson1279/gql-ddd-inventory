export interface ShopifyInventoryLevel {
  locationId: string;
  inventoryItemId: string;
  available: number;
}

export interface ShopifyVariantData {
  id: string;
  sku: string;
  inventoryItemId: string;
  title: string;
}

export interface ShopifyProductData {
  id: string;
  title: string;
  variants: ShopifyVariantData[];
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
    productData: ShopifyProductData
  ): Promise<string>;

  getInventoryLevels(
    storeDomain: string,
    accessToken: string,
    inventoryItemId: string
  ): Promise<ShopifyInventoryLevel[]>;
}
