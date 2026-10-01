import { BaseChannelAdapter, ExternalOrder } from './BaseChannelAdapter';

export class WooCommerceIntegration implements BaseChannelAdapter {
  private channelId: string;

  constructor(channelId: string) {
    this.channelId = channelId;
  }

  async syncInventory(sku: string, availableQuantity: number): Promise<boolean> {
    // WooCommerce REST API call
    return true;
  }

  async ingestOrder(payload: any): Promise<ExternalOrder> {
    if (!payload.id || !payload.line_items) {
      throw new Error('Invalid WooCommerce order payload');
    }

    return {
      externalOrderId: payload.id.toString(),
      channelId: this.channelId,
      items: payload.line_items.map((item: any) => ({
        sku: item.sku,
        quantity: item.quantity,
        unitPriceCents: Math.round(parseFloat(item.price) * 100)
      })),
      shippingAddress: payload.shipping?.address_1 || '',
      createdAt: new Date(payload.date_created_gmt)
    };
  }

  async pushFulfillmentStatus(externalOrderId: string, trackingNumber: string, carrier: string): Promise<boolean> {
    return true;
  }
}
