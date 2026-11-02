# REST & Webhook API Endpoints Reference

This document provides a comprehensive specification of all HTTP/REST endpoints exposed by the inventory service in `src/index.ts`.

---

## 1. Healthcheck Endpoints

The healthcheck routes are lightweight endpoints intended for container orchestrators (e.g., Kubernetes liveness/readiness probes, Docker healthchecks) and uptime monitors to verify that the Express server process is alive and responsive.

### Route Details
* **HTTP Method**: `GET`
* **Paths**:
  * `/api/health`
  * `/health`

### Headers & Parameters
* **Query Parameters**: None.
* **Path Parameters**: None.
* **Headers**: None required.
* **Request Body**: None (GET request).

### Response
* **Status Code**: `200 OK`
* **Content-Type**: `application/json`
* **Response Body Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": {
        "type": "string",
        "enum": ["ok"]
      },
      "timestamp": {
        "type": "string",
        "format": "date-time"
      }
    },
    "required": ["status", "timestamp"]
  }
  ```
* **Example Response**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-10-30T14:20:00.000Z"
  }
  ```

### Real-World Workflow
Container orchestrators query `/health` or `/api/health` at regular intervals (e.g., every 10 seconds). As long as a `200 OK` response with `status: "ok"` is returned, the container is considered healthy and traffic is routed to it.

---

## 2. Shopify Webhook Endpoint

The Shopify webhook endpoint ingests real-time inventory and order lifecycle events originating from configured Shopify stores.

### Route Details
* **HTTP Method**: `POST`
* **Path**: `/webhooks/shopify`

### Rate Limiting & Body Parsing
* **Rate Limiting**: 100 requests per minute per client IP.
* **Payload Limit**: Raw binary buffer up to 2MB.

### Request Headers
| Header | Type | Required | Description |
|---|---|---|---|
| `x-shopify-hmac-sha256` | `string` | **Required** | Base64-encoded HMAC-SHA256 signature calculated over the raw request body using the shared `SHOPIFY_WEBHOOK_SECRET`. |
| `x-shopify-shop-domain` | `string` | **Required** | The registered myshopify domain (e.g., `store.myshopify.com`). Used to resolve the active `IntegrationConnection` aggregate. |
| `x-shopify-topic` | `string` | **Required** | The event topic name. Supported topics include `orders/create`, `orders/paid`, `products/create`, and `products/update`. |
| `x-shopify-webhook-id` | `string` | Optional | Unique webhook event ID from Shopify. If omitted, a random UUIDv4 is generated. |
| `x-shopify-triggered-at` | `string` | Optional | ISO-8601 timestamp representing when Shopify triggered the webhook. |

### Request Body Schemas

#### A. Order Events (`orders/create`, `orders/paid`)
```json
{
  "id": 1234567890,
  "location_id": "987654321",
  "line_items": [
    {
      "variant_id": 4567890123,
      "quantity": 2
    }
  ]
}
```
* **Parameters**:
  * `id` (`string` | `number`, **Required**): The Shopify order identifier.
  * `location_id` (`string` | `number`, Optional): Shopify inventory location ID (defaults to `'default-shopify-location'`).
  * `line_items` (`array`, **Required**): Line items included in the order.
    * `line_items[].variant_id` (`string` | `number`, **Required**): Shopify product variant ID.
    * `line_items[].quantity` (`number`, **Required**): Number of units ordered.

#### B. Product Events (`products/create`, `products/update`)
```json
{
  "id": 1234567890,
  "title": "Industrial Precision Widget",
  "variants": [
    {
      "id": 4567890123,
      "sku": "WIDGET-001",
      "inventory_item_id": "7890123456",
      "title": "Default Title"
    }
  ]
}
```
* **Parameters**:
  * `id` (`string` | `number`, **Required**): Shopify product ID.
  * `title` (`string`, **Required**): Title of the product.
  * `variants` (`array`, **Required**): List of product variants.
    * `variants[].id` (`string` | `number`, **Required**): Shopify variant ID.
    * `variants[].sku` (`string`, Optional): Stock Keeping Unit string.
    * `variants[].inventory_item_id` (`string` | `number`, Optional): Shopify inventory item identifier.
    * `variants[].title` (`string`, Optional): Title of the specific variant.

### Responses & Status Codes

| Status Code | Scenario | Response Body |
|---|---|---|
| `200 OK` | Webhook successfully verified, staged, or processed. | `OK` |
| `400 Bad Request` | Invalid JSON payload, missing shop connection, or store is inactive. | `Invalid JSON` or `No active connection found for shop: <shopDomain>` |
| `401 Unauthorized` | HMAC verification failed (signature mismatch or invalid secret). | `Unauthorized` |
| `500 Internal Server Error` | Unexpected processing error or failure to persist event record. | `Internal Server Error` |

### Real-World Workflow
1. **Webhook Ingestion**: When an order is placed or a product is updated in Shopify, Shopify sends an HTTP POST request to `/webhooks/shopify`.
2. **HMAC Verification**: The service validates the `x-shopify-hmac-sha256` header against `process.env.SHOPIFY_WEBHOOK_SECRET` using constant-time cryptographic comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
3. **Tenant & Connection Resolution**: The `x-shopify-shop-domain` header is queried against `integrationRepository` to confirm that the store is connected and `isActive`.
4. **Event Staging & Execution**:
   - The event is persisted into the `WebhookEvent` database table.
   - When running in synchronous mode (`SYNC_WEBHOOKS=true` or in test environments), order and product use cases (`ProcessShopifyOrder`, `SyncProductFromShopify`) execute immediately to adjust inventory allocations and update product mappings.
   - When running in production asynchronous mode, events are staged with status `Pending` to be processed reliably by background workers (`WebhookWorker`).
