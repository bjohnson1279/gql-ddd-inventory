import crypto from 'crypto';
import { shopifyWebhookHandler, verifyShopifyHmac } from '../../../src/infrastructure/webhooks/shopifyWebhookHandler';

import { ProcessShopifyOrder } from '../../../src/application/integrations/shopify/ProcessShopifyOrder';
import { SyncProductFromShopify } from '../../../src/application/integrations/shopify/SyncProductFromShopify';

jest.mock('../../../src/application/integrations/shopify/ProcessShopifyOrder');
jest.mock('../../../src/application/integrations/shopify/SyncProductFromShopify');

const mockProcessExecute = jest.fn();
const mockSyncExecute = jest.fn();

// Mock the resolvers / repositories
const mockConnection = {
  id: { value: 'integration-uuid' },
  tenantId: { value: 'tenant-uuid' },
  isActive: true
};

const mockFindByStoreDomain = jest.fn();

jest.mock('../../../src/infrastructure/graphql/resolvers', () => {
  return {
    integrationRepository: {
      findByStoreDomain: (...args: any[]) => mockFindByStoreDomain(...args)
    },
    externalMappingRepository: {},
    productRepository: {},
    inventoryService: {}
  };
});

describe('ShopifyWebhookHandler', () => {
  const secret = 'test-secret-key-123';
  let mockReq: any;
  let mockRes: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = process.env;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SHOPIFY_WEBHOOK_SECRET = secret;

    process.env = { ...originalEnv, SHOPIFY_WEBHOOK_SECRET: secret };

    jest.mocked(ProcessShopifyOrder).mockImplementation(() => ({
      execute: mockProcessExecute
    } as any));

    jest.mocked(SyncProductFromShopify).mockImplementation(() => ({
      execute: mockSyncExecute
    } as any));
    
    mockReq = {
      headers: {
        'x-shopify-shop-domain': 'test.myshopify.com',
        'x-shopify-topic': 'orders/create',
        'x-shopify-hmac-sha256': ''
      },
      body: Buffer.from('')
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
  });

  const signBody = (bodyStr: string) => {
    return crypto
      .createHmac('sha256', secret)
      .update(bodyStr)
      .digest('base64');
  };

  it('should return 401 and log an error if SHOPIFY_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.SHOPIFY_WEBHOOK_SECRET;
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockReq.body = Buffer.from(JSON.stringify({ id: 123 }));
    mockReq.headers['x-shopify-hmac-sha256'] = 'some-hmac';

    await shopifyWebhookHandler(mockReq, mockRes);

    expect(consoleErrorSpy).toHaveBeenCalledWith('[Shopify Webhook] Critical Error: SHOPIFY_WEBHOOK_SECRET is not configured.');
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.send).toHaveBeenCalledWith('Unauthorized');

    consoleErrorSpy.mockRestore();
  });

  it('should return 401 if HMAC signature is missing or invalid', async () => {
    mockReq.body = Buffer.from(JSON.stringify({ id: 123 }));
    mockReq.headers['x-shopify-hmac-sha256'] = 'invalid-hmac';

    await shopifyWebhookHandler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.send).toHaveBeenCalledWith('Unauthorized');
  });

  it('should return 401 if SHOPIFY_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.SHOPIFY_WEBHOOK_SECRET;

    const rawBody = JSON.stringify({ id: 123 });
    mockReq.body = Buffer.from(rawBody);
    mockReq.headers['x-shopify-hmac-sha256'] = signBody(rawBody);

    await shopifyWebhookHandler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.send).toHaveBeenCalledWith('Unauthorized');
  });

  it('should return 400 if request body is not valid JSON', async () => {
    const rawBody = '{invalid-json';
    mockReq.body = Buffer.from(rawBody);
    mockReq.headers['x-shopify-hmac-sha256'] = signBody(rawBody);

    await shopifyWebhookHandler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith('Invalid JSON');
  });

  it('should return 400 if no active integration connection exists for store domain', async () => {
    const rawBody = JSON.stringify({ id: 123 });
    mockReq.body = Buffer.from(rawBody);
    mockReq.headers['x-shopify-hmac-sha256'] = signBody(rawBody);
    mockFindByStoreDomain.mockResolvedValue(null);

    await shopifyWebhookHandler(mockReq, mockRes);

    expect(mockFindByStoreDomain).toHaveBeenCalledWith('test.myshopify.com');
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('No active connection found'));
  });

  it('should process orders/create webhook correctly', async () => {
    const orderPayload = {
      id: 999,
      location_id: 'loc-external',
      line_items: [
        { variant_id: 111, quantity: 2 }
      ]
    };
    const rawBody = JSON.stringify(orderPayload);
    mockReq.body = Buffer.from(rawBody);
    mockReq.headers['x-shopify-hmac-sha256'] = signBody(rawBody);
    mockReq.headers['x-shopify-topic'] = 'orders/create';
    
    mockFindByStoreDomain.mockResolvedValue(mockConnection);
    mockProcessExecute.mockResolvedValue(undefined);

    await shopifyWebhookHandler(mockReq, mockRes);

    expect(mockProcessExecute).toHaveBeenCalledWith({
      integrationId: 'integration-uuid',
      shopifyOrderId: '999',
      shopifyLocationId: 'loc-external',
      lineItems: [
        { shopifyVariantId: '111', quantity: 2 }
      ]
    });
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.send).toHaveBeenCalledWith('OK');
  });

  it('should process products/update webhook correctly', async () => {
    const productPayload = {
      id: 777,
      title: 'Cool Shirt',
      variants: [
        { id: 222, sku: 'SKU-SHIRT', inventory_item_id: 'inv-item-1', title: 'Small' }
      ]
    };
    const rawBody = JSON.stringify(productPayload);
    mockReq.body = Buffer.from(rawBody);
    mockReq.headers['x-shopify-hmac-sha256'] = signBody(rawBody);
    mockReq.headers['x-shopify-topic'] = 'products/update';
    
    mockFindByStoreDomain.mockResolvedValue(mockConnection);
    mockSyncExecute.mockResolvedValue(undefined);

    await shopifyWebhookHandler(mockReq, mockRes);

    expect(mockSyncExecute).toHaveBeenCalledWith(
      'integration-uuid',
      'tenant-uuid',
      {
        id: '777',
        title: 'Cool Shirt',
        variants: [
          { id: '222', sku: 'SKU-SHIRT', inventoryItemId: 'inv-item-1', title: 'Small' }
        ]
      }
    );
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.send).toHaveBeenCalledWith('OK');
  });
});
