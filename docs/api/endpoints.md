# REST & HTTP Endpoints Reference

This document provides a detailed specification for the HTTP endpoints exposed by the service outside the GraphQL schema (`/graphql`).

---

## 1. Healthcheck Endpoints

Container orchestration probes (e.g., Kubernetes liveness/readiness probes, Docker healthchecks) and monitoring tools use these endpoints to evaluate service availability.

### `GET /api/health` and `GET /health`

Returns service health status and current server timestamp.

- **HTTP Method:** `GET`
- **Route Paths:** `/api/health`, `/health`
- **Authentication:** None (Public)
- **Parameters:** None (no query, path, header, or body parameters)
- **Responses:**
  - **Status Code:** `200 OK`
  - **Content-Type:** `application/json`
  - **Response Payload Schema:**
    ```json
    {
      "status": "ok",
      "timestamp": "2026-03-30T12:00:00.000Z"
    }
    ```
- **Real-World Workflow:**
  Used by load balancers, container runtimes (e.g., Docker compose healthchecks), and uptime pingers to verify the Node.js Express process is up and able to respond to HTTP requests.

---

## 2. Shopify Integration Webhook

### `POST /webhooks/shopify`

Processes incoming webhook notifications from Shopify stores (e.g. order creation, product sync) and dispatches domain use cases.

- **HTTP Method:** `POST`
- **Route Path:** `/webhooks/shopify`
- **Authentication:** HMAC SHA-256 signature verification via secret `SHOPIFY_WEBHOOK_SECRET`.
- **Rate Limit:** 100 requests per 1 minute per IP.
- **Payload Limit:** 2MB raw JSON (`application/json`).

#### Request Headers

| Header | Type | Required / Optional | Description |
|---|---|---|---|
| `x-shopify-hmac-sha256` | String | **Required** | Base64-encoded HMAC-SHA256 signature of the raw request body computed using `SHOPIFY_WEBHOOK_SECRET`. |
| `x-shopify-shop-domain` | String | **Required** | Store domain identifying the sending Shopify store (e.g. `example-store.myshopify.com`). Must match an active tenant integration connection. |
| `x-shopify-topic` | String | **Required** | The Shopify event topic. Supported topics: `orders/create`, `orders/paid`, `products/create`, `products/update`. |
| `x-shopify-webhook-id` | String | Optional | Unique ID for the webhook event. If omitted, a random UUID is generated. |
| `x-shopify-triggered-at` | String (ISO 8601) | Optional | Timestamp when Shopify generated the webhook event. Defaults to current timestamp if omitted. |

#### Request Body Schema

JSON object representing the Shopify entity payload corresponding to `x-shopify-topic`.

##### 1. Orders (`orders/create`, `orders/paid`)
```json
{
  "id": 1234567890,
  "location_id": "loc-123",
  "line_items": [
    {
      "variant_id": 987654321,
      "quantity": 2
    }
  ]
}
```

##### 2. Products (`products/create`, `products/update`)
```json
{
  "id": 1234567890,
  "title": "Sample Product",
  "variants": [
    {
      "id": 987654321,
      "sku": "SAMPLE-SKU-1",
      "inventory_item_id": "inv-999",
      "title": "Default Title"
    }
  ]
}
```

#### Responses

| Status Code | Content-Type | Description |
|---|---|---|
| `200 OK` | `text/plain` | Body: `OK`. Webhook was successfully validated and processed (or staged in `webhookEvent` if asynchronous). |
| `400 Bad Request` | `text/plain` | Returned if the request body is not valid JSON, or if no active integration connection exists for `x-shopify-shop-domain`. |
| `401 Unauthorized` | `text/plain` | Returned if `x-shopify-hmac-sha256` is missing, invalid, or if `SHOPIFY_WEBHOOK_SECRET` is unset on the server. |
| `429 Too Many Requests` | `text/plain` | Returned when rate limit of 100 requests per minute is exceeded. |
| `500 Internal Server Error` | `text/plain` | Returned on unhandled processing exceptions. |

#### Real-World Workflow

1. A merchant completes a sale or updates product catalog details in Shopify.
2. Shopify dispatches an HTTP POST webhook with `x-shopify-hmac-sha256`, `x-shopify-shop-domain`, and `x-shopify-topic` to `/webhooks/shopify`.
3. The server validates HMAC signature in constant time (`crypto.timingSafeEqual`) against `SHOPIFY_WEBHOOK_SECRET`.
4. The server looks up the active `IntegrationConnection` associated with the store domain.
5. The webhook payload and metadata are staged in the `webhookEvent` database table.
6. Depending on sync configuration (`SYNC_WEBHOOKS=true` or worker queue), the order lines are dispatched to `ProcessShopifyOrder` or `SyncProductFromShopify` use cases to update inventory and catalog records.
