export interface ExternalOrder {
  externalOrderId: string;
  channelId: string;
  items: { sku: string; quantity: number; unitPriceCents: number }[];
  shippingAddress: string;
  createdAt: Date;
}

export interface BaseChannelAdapter {
  syncInventory(sku: string, availableQuantity: number): Promise<boolean>;
  ingestOrder(payload: any): Promise<ExternalOrder>;
  pushFulfillmentStatus(externalOrderId: string, trackingNumber: string, carrier: string): Promise<boolean>;
}
