import { BaseChannelAdapter, ExternalOrder } from './BaseChannelAdapter';

export class ShopifyIntegration implements BaseChannelAdapter {
  private channelId: string;

  constructor(channelId: string) {
    this.channelId = channelId;
  }

  async syncInventory(sku: string, availableQuantity: number): Promise<boolean> {
    // In a real implementation, call Shopify Admin API
    return true;
  }

  async ingestOrder(payload: any): Promise<ExternalOrder> {
    if (!payload.id || !payload.line_items) {
      throw new Error('Invalid Shopify order payload');
    }

    return {
      externalOrderId: payload.id.toString(),
      channelId: this.channelId,
      items: payload.line_items.map((item: any) => ({
        sku: item.sku,
        quantity: item.quantity,
        unitPriceCents: parseInt(item.price.replace('.', ''), 10)
      })),
      shippingAddress: payload.shipping_address?.address1 || '',
      createdAt: new Date(payload.created_at)
    };
  }

  async pushFulfillmentStatus(externalOrderId: string, trackingNumber: string, carrier: string): Promise<boolean> {
    return true;
  }
}
