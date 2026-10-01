import { ShopifyIntegration } from '../../../../src/domain/integrations/services/adapters/ShopifyIntegration';
import { AmazonSPIntegration } from '../../../../src/domain/integrations/services/adapters/AmazonSPIntegration';
import { WooCommerceIntegration } from '../../../../src/domain/integrations/services/adapters/WooCommerceIntegration';

describe('Omnichannel Adapters', () => {
  describe('ShopifyIntegration', () => {
    it('should map shopify payload to ExternalOrder', async () => {
      const adapter = new ShopifyIntegration('shopify-1');
      const payload = {
        id: 12345,
        created_at: '2023-01-01T12:00:00Z',
        shipping_address: { address1: '123 Main St' },
        line_items: [
          { sku: 'SKU1', quantity: 2, price: '19.99' }
        ]
      };
      
      const order = await adapter.ingestOrder(payload);
      expect(order.externalOrderId).toBe('12345');
      expect(order.items[0].unitPriceCents).toBe(1999);
      expect(order.shippingAddress).toBe('123 Main St');
    });
  });

  describe('AmazonSPIntegration', () => {
    it('should map amazon payload to ExternalOrder', async () => {
      const adapter = new AmazonSPIntegration('amazon-1');
      const payload = {
        AmazonOrderId: 'AMZ-123',
        PurchaseDate: '2023-01-01T12:00:00Z',
        ShippingAddress: { AddressLine1: '456 Oak St' },
        OrderItems: [
          { SellerSKU: 'SKU2', QuantityOrdered: 1, ItemPrice: { Amount: '29.99' } }
        ]
      };
      
      const order = await adapter.ingestOrder(payload);
      expect(order.externalOrderId).toBe('AMZ-123');
      expect(order.items[0].unitPriceCents).toBe(2999);
    });
  });

  describe('WooCommerceIntegration', () => {
    it('should map woo payload to ExternalOrder', async () => {
      const adapter = new WooCommerceIntegration('woo-1');
      const payload = {
        id: 999,
        date_created_gmt: '2023-01-01T12:00:00',
        shipping: { address_1: '789 Pine St' },
        line_items: [
          { sku: 'SKU3', quantity: 3, price: '9.99' }
        ]
      };
      
      const order = await adapter.ingestOrder(payload);
      expect(order.externalOrderId).toBe('999');
      expect(order.items[0].unitPriceCents).toBe(999);
    });
  });
});
