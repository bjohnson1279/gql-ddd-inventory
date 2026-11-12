import { WooCommerceIntegration } from '../../../../src/application/integrations/woocommerce/WooCommerceIntegration';
import { ExternalMapping } from '../../../../src/application/integrations/types';

describe('WooCommerceIntegration', () => {
  let integration: WooCommerceIntegration;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    integration = new WooCommerceIntegration();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should instantiate successfully', () => {
    expect(integration).toBeInstanceOf(WooCommerceIntegration);
  });

  describe('connect', () => {
    it('should log connection message with storeUrl', () => {
      integration.connect({
        storeUrl: 'https://example-store.com',
        consumerKey: 'ck_12345',
        consumerSecret: 'cs_67890',
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Connecting to WooCommerce with Store URL:',
        'https://example-store.com'
      );
    });
  });

  describe('disconnect', () => {
    it('should log disconnection message', () => {
      integration.disconnect();

      expect(consoleLogSpy).toHaveBeenCalledWith('Disconnecting from WooCommerce');
    });
  });

  describe('getConnections', () => {
    it('should return an empty array for a tenant', async () => {
      const connections = await integration.getConnections('tenant-123');

      expect(connections).toEqual([]);
    });
  });

  describe('createConnection', () => {
    it('should log creation of connection for tenant', async () => {
      await integration.createConnection('tenant-123', {
        storeUrl: 'https://example-store.com',
        consumerKey: 'ck_12345',
        consumerSecret: 'cs_67890',
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Creating WooCommerce connection for tenant tenant-123'
      );
    });
  });

  describe('syncInventory', () => {
    it('should sync inventory without a progress callback', async () => {
      await integration.syncInventory('conn-1');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Syncing inventory to WooCommerce connection conn-1'
      );
    });

    it('should invoke progress callback with 100 when provided', async () => {
      const progressCallback = jest.fn();

      await integration.syncInventory('conn-1', progressCallback);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Syncing inventory to WooCommerce connection conn-1'
      );
      expect(progressCallback).toHaveBeenCalledTimes(1);
      expect(progressCallback).toHaveBeenCalledWith(100);
    });
  });

  describe('ingestOrder', () => {
    it('should format and return ingested order without mapping', () => {
      const orderData = { id: 101, total: '59.99' };
      const result = integration.ingestOrder(orderData);

      expect(consoleLogSpy).toHaveBeenCalledWith('Ingesting WooCommerce order:', 101);
      expect(result).toEqual({
        id: 'temp-id',
        channelId: 'woocommerce',
        externalOrderId: 101,
        status: 'pending',
      });
    });

    it('should format and return ingested order with mapping', () => {
      const orderData = { id: 102, total: '120.00' };
      const mapping: ExternalMapping = {
        id: 'map-1',
        externalId: 'ext-loc-1',
        internalId: 'loc-1',
        entityType: 'Location',
      };

      const result = integration.ingestOrder(orderData, mapping);

      expect(consoleLogSpy).toHaveBeenCalledWith('Ingesting WooCommerce order:', 102);
      expect(result).toEqual({
        id: 'temp-id',
        channelId: 'woocommerce',
        externalOrderId: 102,
        status: 'pending',
      });
    });
  });

  describe('pushFulfillmentStatus', () => {
    it('should log pushing pending fulfillment status', async () => {
      await integration.pushFulfillmentStatus('order-123', 'pending');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Pushing fulfillment status pending to WooCommerce for order order-123'
      );
    });

    it('should log pushing shipped fulfillment status', async () => {
      await integration.pushFulfillmentStatus('order-456', 'shipped');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Pushing fulfillment status shipped to WooCommerce for order order-456'
      );
    });

    it('should log pushing delivered fulfillment status', async () => {
      await integration.pushFulfillmentStatus('order-789', 'delivered');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Pushing fulfillment status delivered to WooCommerce for order order-789'
      );
    });
  });

  describe('subscribeEvents', () => {
    it('should log subscribing without webhookUrl and return unsubscribe callback', () => {
      const unsubscribe = integration.subscribeEvents('tenant-123');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Subscribing to WooCommerce webhooks for tenant tenant-123'
      );
      expect(typeof unsubscribe).toBe('function');

      unsubscribe();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Unsubscribing from WooCommerce webhooks for tenant-123'
      );
    });

    it('should log subscribing with webhookUrl and unsubscribe properly', () => {
      const unsubscribe = integration.subscribeEvents('tenant-456', 'https://example.com/webhook');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Subscribing to WooCommerce webhooks for tenant tenant-456'
      );

      unsubscribe();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Unsubscribing from WooCommerce webhooks for tenant-456'
      );
    });
  });
});
