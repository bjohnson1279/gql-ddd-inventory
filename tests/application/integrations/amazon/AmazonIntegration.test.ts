import { AmazonIntegration } from '../../../../src/application/integrations/amazon/AmazonIntegration';
import { ExternalMapping } from '../../../../src/application/integrations/types';

describe('AmazonIntegration Adapter', () => {
  let integration: AmazonIntegration;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    integration = new AmazonIntegration();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('connect', () => {
    it('should log connection attempt with sellerId', () => {
      const connectionParams = {
        sellerId: 'seller-123',
        mwsAuthToken: 'token-xyz',
        marketplaceId: 'mkt-us',
      };

      integration.connect(connectionParams);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Connecting to Amazon SP-API with SellerId:',
        'seller-123'
      );
    });
  });

  describe('disconnect', () => {
    it('should log disconnection message', () => {
      integration.disconnect();

      expect(consoleLogSpy).toHaveBeenCalledWith('Disconnecting from Amazon SP-API');
    });
  });

  describe('getConnections', () => {
    it('should return an empty array for a tenant', async () => {
      const connections = await integration.getConnections('tenant-abc');

      expect(connections).toEqual([]);
    });
  });

  describe('createConnection', () => {
    it('should log connection creation for a tenant', async () => {
      const params = {
        sellerId: 'seller-456',
        mwsAuthToken: 'auth-token',
        marketplaceId: 'ATVPDKIKX0DER',
      };

      await integration.createConnection('tenant-abc', params);

      expect(consoleLogSpy).toHaveBeenCalledWith('Creating Amazon connection for tenant tenant-abc');
    });
  });

  describe('syncInventory', () => {
    it('should log inventory sync and invoke progress callback with 100 when provided', async () => {
      const progressCallback = jest.fn();

      await integration.syncInventory('conn-1', progressCallback);

      expect(consoleLogSpy).toHaveBeenCalledWith('Syncing inventory to Amazon connection conn-1');
      expect(progressCallback).toHaveBeenCalledTimes(1);
      expect(progressCallback).toHaveBeenCalledWith(100);
    });

    it('should successfully sync inventory when progress callback is omitted', async () => {
      await expect(integration.syncInventory('conn-2')).resolves.toBeUndefined();

      expect(consoleLogSpy).toHaveBeenCalledWith('Syncing inventory to Amazon connection conn-2');
    });
  });

  describe('ingestOrder', () => {
    it('should map order data into standard pending order structure without external mapping', () => {
      const orderData = {
        externalOrderId: 'AMZ-987654',
      };

      const result = integration.ingestOrder(orderData);

      expect(consoleLogSpy).toHaveBeenCalledWith('Ingesting Amazon order:', 'AMZ-987654');
      expect(result).toEqual({
        id: 'temp-id',
        channelId: 'amazon',
        externalOrderId: 'AMZ-987654',
        status: 'pending',
      });
    });

    it('should map order data when external mapping is provided', () => {
      const orderData = {
        externalOrderId: 'AMZ-112233',
      };
      const mapping: ExternalMapping = {
        id: 'map-1',
        externalId: 'AMZ-112233',
        internalId: 'ORD-1',
        entityType: 'Variant',
      };

      const result = integration.ingestOrder(orderData, mapping);

      expect(consoleLogSpy).toHaveBeenCalledWith('Ingesting Amazon order:', 'AMZ-112233');
      expect(result).toEqual({
        id: 'temp-id',
        channelId: 'amazon',
        externalOrderId: 'AMZ-112233',
        status: 'pending',
      });
    });
  });

  describe('pushFulfillmentStatus', () => {
    it('should log pushing pending fulfillment status', async () => {
      await integration.pushFulfillmentStatus('AMZ-100', 'pending');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Pushing fulfillment status pending to Amazon for order AMZ-100'
      );
    });

    it('should log pushing shipped fulfillment status', async () => {
      await integration.pushFulfillmentStatus('AMZ-200', 'shipped');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Pushing fulfillment status shipped to Amazon for order AMZ-200'
      );
    });

    it('should log pushing delivered fulfillment status', async () => {
      await integration.pushFulfillmentStatus('AMZ-300', 'delivered');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Pushing fulfillment status delivered to Amazon for order AMZ-300'
      );
    });
  });

  describe('subscribeEvents', () => {
    it('should log event subscription and return an unsubscribe function that logs unsubscription', () => {
      const unsubscribe = integration.subscribeEvents('tenant-123', 'https://example.com/webhook');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Subscribing to Amazon SP-API events for tenant tenant-123'
      );
      expect(typeof unsubscribe).toBe('function');

      unsubscribe();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Unsubscribing from Amazon events for tenant-123'
      );
    });

    it('should subscribe without webhookUrl parameter', () => {
      const unsubscribe = integration.subscribeEvents('tenant-456');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Subscribing to Amazon SP-API events for tenant tenant-456'
      );

      unsubscribe();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Unsubscribing from Amazon events for tenant-456'
      );
    });
  });
});
