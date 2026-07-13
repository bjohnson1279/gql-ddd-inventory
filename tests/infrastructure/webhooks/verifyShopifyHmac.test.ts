import crypto from 'crypto';
import { verifyShopifyHmac } from '../../../src/infrastructure/webhooks/shopifyWebhookHandler';

describe('verifyShopifyHmac', () => {
  const secret = 'test-secret-key-123';
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = process.env;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, SHOPIFY_WEBHOOK_SECRET: secret };
  });

  const signBody = (bodyStr: string) => {
    return crypto
      .createHmac('sha256', secret)
      .update(bodyStr)
      .digest('base64');
  };

  it('should return false if SHOPIFY_WEBHOOK_SECRET is not configured', () => {
    delete process.env.SHOPIFY_WEBHOOK_SECRET;
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = verifyShopifyHmac('{}', 'some-hmac');

    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[Shopify Webhook] Critical Error: SHOPIFY_WEBHOOK_SECRET is not configured.');

    consoleErrorSpy.mockRestore();
  });

  it('should return false if hmacHeader is missing', () => {
    const result = verifyShopifyHmac('{}', '');
    expect(result).toBe(false);
  });

  it('should return true for a valid HMAC signature', () => {
    const rawBody = JSON.stringify({ id: 123 });
    const validHmac = signBody(rawBody);

    const result = verifyShopifyHmac(rawBody, validHmac);
    expect(result).toBe(true);
  });

  it('should return false for an invalid HMAC signature (same length)', () => {
    const rawBody = JSON.stringify({ id: 123 });
    // Generating an HMAC with a different body to ensure same length but different content
    const invalidHmac = signBody(JSON.stringify({ id: 999 }));

    const result = verifyShopifyHmac(rawBody, invalidHmac);
    expect(result).toBe(false);
  });

  it('should return false if the hash and hmacHeader lengths mismatch', () => {
    const rawBody = JSON.stringify({ id: 123 });
    const shortHmac = 'short'; // Different length than a base64 encoded sha256 hash

    const result = verifyShopifyHmac(rawBody, shortHmac);
    expect(result).toBe(false);
  });

  it('should catch exceptions and return false if Buffer operations fail', () => {
    const rawBody = JSON.stringify({ id: 123 });
    // Passing a non-string/non-buffer (like an object) to Buffer.from will throw a TypeError in Node.js
    const invalidHmacObject = { invalid: true } as any;

    const result = verifyShopifyHmac(rawBody, invalidHmacObject);
    expect(result).toBe(false);
  });
});
