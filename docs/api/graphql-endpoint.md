# GraphQL API & WebSocket Reference

This document provides a comprehensive specification for the GraphQL HTTP and WebSocket subscription endpoints exposed by the inventory service in `src/index.ts` (and federated gateway in `src/gateway/index.ts`).

---

## 1. HTTP GraphQL Execution Endpoint

The primary interface for executing queries and mutations against the multi-tenant inventory control system.

### Route Details
* **HTTP Method**: `POST`
* **Path**: `/graphql`

### Rate Limiting & Limits
* **Rate Limiting**: 1,000 requests per 15-minute window per client IP (enforced via `express-rate-limit` draft-7 headers).
* **Payload Limit**: JSON payload up to 2MB.
* **CORS**: Restricted according to configured `ALLOWED_ORIGINS` (defaults to `http://localhost:3000,http://localhost:4000` in non-production).

### Request Headers
| Header | Type | Required | Description |
|---|---|---|---|
| `Content-Type` | `string` | **Required** | Must be `application/json`. |
| `Authorization` | `string` | **Conditional** | Bearer token formatted as `Bearer <jwt_token>`. Optional for public setup/login mutations, but required for tenant-scoped queries and mutations. |
| `x-trace-id` / `traceparent` | `string` | Optional | W3C distributed tracing context header, propagated automatically via `traceMiddleware`. |

### Request Body Schema
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "GraphQL query, mutation, or document string."
    },
    "variables": {
      "type": "object",
      "description": "Key-value mapping of GraphQL variable arguments."
    },
    "operationName": {
      "type": "string",
      "description": "Name of the target operation if multiple operations are present."
    }
  },
  "required": ["query"]
}
```

### Query Guardrails
To prevent Denial of Service (DoS) attacks and expensive queries, Apollo Server enforces AST validation rules:
1. **Query Depth Limit**: Maximum AST depth of **5 levels** (`depthLimitRule(5)`).
2. **Query Complexity Limit**: Maximum total query complexity of **100 points** (`complexityLimitRule(100)`). Leaf scalar fields cost 1 point, while nested selection sets and collections cost 5 points.

### Response Payloads & Status Codes

| Status Code | Scenario | Response Payload Format |
|---|---|---|
| `200 OK` | Query or mutation successfully executed (or resolved with field-level GraphQL errors). | `{"data": { ... }}` or `{"data": { ... }, "errors": [ ... ]}` |
| `400 Bad Request` | Syntax error, invalid JSON body, or guardrail violation (e.g. depth limit or complexity limit exceeded). | `{"errors": [{"message": "Maximum query depth of 5 exceeded."}]}` |
| `429 Too Many Requests` | Exceeded 1,000 requests per 15-minute window. | Text error: `"Too many requests from this IP, please try again after 15 minutes"` |
| `500 Internal Server Error` | Uncaught server processing exception. | `{"errors": [{"message": "Internal server error"}]}` (stack traces stripped in production). |

---

## 2. WebSocket Subscriptions Endpoint

The real-time streaming endpoint for event subscriptions (such as barcode scans and stock reconciliations).

### Connection Details
* **Protocol**: `ws://` (or `wss://` in production)
* **Path**: `/graphql`
* **Subprotocol**: `graphql-ws`

### Connection Parameters (`connectionParams`)
| Parameter | Type | Required | Description |
|---|---|---|---|
| `Authorization` / `authorization` | `string` | **Required for tenant events** | Bearer token formatted as `Bearer <jwt_token>`. Decoded on initial connection to populate the subscriber's tenant and role context. |

### Subscription Protocol Flow
1. **Connection Initialization**: Client connects and transmits `connection_init` containing `connectionParams`.
2. **Authentication & Isolation**: The server verifies the JWT signature (HS256) and binds the active tenant context (`getTenantPrisma`).
3. **Subscription Start**: Client transmits `subscribe` message with GraphQL subscription query and variables.
4. **Event Streaming**: As domain events are published to Redis / PubSub, events are pushed to active client sockets.
5. **Termination**: Client sends `complete` or terminates the WebSocket connection.

---

## 3. Real-World Workflows & Examples

### Workflow A: Authentication & JWT Acquisition
Before performing protected inventory queries, clients execute the `login` mutation:

**Request**:
```http
POST /graphql HTTP/1.1
Host: localhost:4000
Content-Type: application/json

{
  "query": "mutation Login($tenantId: String!, $actorId: String!, $role: String!) { login(tenantId: $tenantId, actorId: $actorId, role: $role) }",
  "variables": {
    "tenantId": "tenant-1",
    "actorId": "operator-01",
    "role": "warehouse_operator"
  }
}
```

**Response (`200 OK`)**:
```json
{
  "data": {
    "login": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Workflow B: Authenticated Query for Inventory Levels
Using the received token, operators query current stock items:

**Request**:
```http
POST /graphql HTTP/1.1
Host: localhost:4000
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "query": "query GetInventory { inventoryItems { id sku availableQuantity allocatedQuantity } }"
}
```

**Response (`200 OK`)**:
```json
{
  "data": {
    "inventoryItems": [
      {
        "id": "item-101",
        "sku": "WIDGET-01",
        "availableQuantity": 150,
        "allocatedQuantity": 20
      }
    ]
  }
}
```

### Workflow C: Real-Time Barcode Scanning Subscription
Warehouse operators connect via WebSocket to stream barcode scanning events:

**WebSocket Message (`subscribe`)**:
```json
{
  "id": "1",
  "type": "subscribe",
  "payload": {
    "query": "subscription OnBarcodeScanned($tenantId: ID!) { barcodeScanned(tenantId: $tenantId) { barcode sku locationId scannedAt } }",
    "variables": {
      "tenantId": "tenant-1"
    }
  }
}
```

**Server Stream Event (`next`)**:
```json
{
  "id": "1",
  "type": "next",
  "payload": {
    "data": {
      "barcodeScanned": {
        "barcode": "BAR-98765432",
        "sku": "WIDGET-01",
        "locationId": "BIN-A-12",
        "scannedAt": "2026-11-08T10:15:30.000Z"
      }
    }
  }
}
```
