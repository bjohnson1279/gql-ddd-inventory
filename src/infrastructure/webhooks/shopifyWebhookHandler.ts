import crypto from 'crypto';
import express from 'express';
import { ProcessShopifyOrder } from '../../application/integrations/shopify/ProcessShopifyOrder';
import { SyncProductFromShopify } from '../../application/integrations/shopify/SyncProductFromShopify';
import {
  integrationRepository,
  externalMappingRepository,
  productRepository,
  inventoryService
} from '../graphql/resolvers';

export function verifyShopifyHmac(rawBody: string, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[Shopify Webhook] Critical Error: SHOPIFY_WEBHOOK_SECRET is not configured.');
    return false;
  }

  if (!hmacHeader) return false;

  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');
  return hash === hmacHeader;
}

function validateAndParsePayload(rawBody: string, hmacHeader: string): { isValid: boolean; payload?: any; error?: string; status?: number } {
  if (!verifyShopifyHmac(rawBody, hmacHeader)) {
    console.warn(`[Shopify Webhook] Authentication failed. Invalid HMAC signature.`);
    return { isValid: false, status: 401, error: 'Unauthorized' };
  }

  try {
    return { isValid: true, payload: JSON.parse(rawBody) };
  } catch (err: any) {
    return { isValid: false, status: 400, error: 'Invalid JSON' };
  }
}

async function processOrderWebhook(payload: any, connection: any, useCase: ProcessShopifyOrder, shopDomain: string): Promise<void> {
  const lineItems = (payload.line_items || []).map((item: any) => ({
    shopifyVariantId: String(item.variant_id),
    quantity: Number(item.quantity)
  }));

  const shopifyLocationId = String(payload.location_id || 'default-shopify-location');

  await useCase.execute({
    integrationId: connection.id.value,
    shopifyOrderId: String(payload.id),
    shopifyLocationId,
    lineItems
  });
  console.log(`[Shopify Webhook] Successfully processed order: ${payload.id} for shop ${shopDomain}`);
}

async function processProductWebhook(payload: any, connection: any, useCase: SyncProductFromShopify, shopDomain: string): Promise<void> {
  const variants = (payload.variants || []).map((v: any) => ({
    id: String(v.id),
    sku: String(v.sku || ''),
    inventoryItemId: String(v.inventory_item_id || ''),
    title: String(v.title || '')
  }));

  await useCase.execute(
    connection.id.value,
    connection.tenantId.value,
    {
      id: String(payload.id),
      title: String(payload.title),
      variants
    }
  );
  console.log(`[Shopify Webhook] Successfully synced product: ${payload.id} for shop ${shopDomain}`);
}

export async function shopifyWebhookHandler(req: express.Request, res: express.Response): Promise<void> {
  const processShopifyOrderUseCase = new ProcessShopifyOrder(
    integrationRepository,
    externalMappingRepository,
    inventoryService
  );

  const syncProductFromShopifyUseCase = new SyncProductFromShopify(
    productRepository,
    externalMappingRepository
  );

  const hmacHeader = (req.headers['x-shopify-hmac-sha256'] as string) || '';
  const shopDomain = (req.headers['x-shopify-shop-domain'] as string) || '';
  const topic = (req.headers['x-shopify-topic'] as string) || '';
  const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : '';

  const { isValid, payload, error, status } = validateAndParsePayload(rawBody, hmacHeader);
  if (!isValid) {
    res.status(status || 500).send(error);
    return;
  }

  try {
    const connection = await integrationRepository.findByStoreDomain(shopDomain);
    if (!connection || !connection.isActive) {
      console.warn(`[Shopify Webhook] No active connection found for shop: ${shopDomain}`);
      res.status(400).send(`No active connection found for shop: ${shopDomain}`);
      return;
    }

    if (topic === 'orders/create' || topic === 'orders/paid') {
      await processOrderWebhook(payload, connection, processShopifyOrderUseCase, shopDomain);
    } else if (topic === 'products/create' || topic === 'products/update') {
      await processProductWebhook(payload, connection, syncProductFromShopifyUseCase, shopDomain);
    } else {
      console.warn(`[Shopify Webhook] Unhandled topic: ${topic}`);
    }

    res.status(200).send('OK');
  } catch (err: any) {
    console.error(`[Shopify Webhook] Error processing webhook:`, err);
    res.status(500).send(`Error processing webhook: ${err.message}`);
  }
}
