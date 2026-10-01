import { BaseChannelAdapter, ExternalOrder } from './BaseChannelAdapter';

export class AmazonSPIntegration implements BaseChannelAdapter {
  private channelId: string;

  constructor(channelId: string) {
    this.channelId = channelId;
  }

  async syncInventory(sku: string, availableQuantity: number): Promise<boolean> {
    // Amazon SP-API Feeds call
    return true;
  }

  async ingestOrder(payload: any): Promise<ExternalOrder> {
    if (!payload.AmazonOrderId || !payload.OrderItems) {
      throw new Error('Invalid Amazon SP-API order payload');
    }

    return {
      externalOrderId: payload.AmazonOrderId,
      channelId: this.channelId,
      items: payload.OrderItems.map((item: any) => ({
        sku: item.SellerSKU,
        quantity: item.QuantityOrdered,
        unitPriceCents: parseInt(item.ItemPrice?.Amount?.replace('.', '') || '0', 10)
      })),
      shippingAddress: payload.ShippingAddress?.AddressLine1 || '',
      createdAt: new Date(payload.PurchaseDate)
    };
  }

  async pushFulfillmentStatus(externalOrderId: string, trackingNumber: string, carrier: string): Promise<boolean> {
    return true;
  }
}
