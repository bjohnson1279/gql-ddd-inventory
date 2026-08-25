## 2025-02-24 - [SSRF Protection]
**Vulnerability:** User-provided webhook URLs were not validated for SSRF when creating or updating webhook subscriptions in `src/infrastructure/graphql/resolvers.ts`.
**Learning:** While the delivery worker (`WebhookDeliveryWorker.ts`) protected against SSRF by validating the URL at delivery time, the GraphQL resolvers lacked this validation, allowing users to configure malicious/invalid internal URLs (e.g. localhost) which could lead to SSRF vulnerabilities.
**Prevention:** Implement input validation for URLs directly in the GraphQL resolvers using the `validateOutboundUrl` utility to prevent malicious/invalid URLs from being stored in the database.
## 2024-06-25 - [Insecure Randomness for Identifiers]
**Vulnerability:** The application used `Math.random()` to generate identifiers for Bill of Lading numbers, shipping tracking numbers, mock ERP journal IDs, and IoT bulk scan batch IDs. `Math.random()` generates pseudo-random values that are predictable, allowing potential attackers to guess these identifiers.
**Learning:** `Math.random()` should not be used in contexts where predictability could lead to security issues, such as guessing tracking or batch numbers to bypass business logic or spoof data. This applies even to mock IDs if they leak into persistent storage or external systems.
**Prevention:** Always use Node's native `crypto` module (e.g., `crypto.randomInt()`, `crypto.randomUUID()`) for generating secure random values and identifiers. Ensure to import it via `import * as crypto from 'crypto'` in TypeScript files to avoid Web Crypto API conflicts.
## 2024-08-15 - [Rate Limiter Memory DoS]
**Vulnerability:** Unbounded Map used for failed login attempt rate limiting (`loginAttempts`) in `resolvers.ts`.
**Learning:** In-memory Maps tracking user activity based on unbounded input (like email addresses) can be exploited to cause a memory exhaustion Denial of Service by sending thousands of requests with unique keys.
**Prevention:** Always bound the size of in-memory maps or caches. When the limit is reached, use an eviction strategy (like deleting the oldest key `map.keys().next().value`) rather than `clear()`, which would bypass the rate limit for all users.
## 2024-05-18 - Add Timeouts to External Fetch Calls
**Vulnerability:** External fetch calls in WebhookDeliveryWorker, ERP integrations, and Shopify sync handlers were missing timeouts.
**Learning:** An attacker controlling a webhook destination (or a misconfigured/unresponsive external service) could hold connections open indefinitely, potentially exhausting server resources and causing Denial of Service (DoS) (a tarpit attack).
**Prevention:** Always configure an `AbortSignal.timeout()` when making outbound `fetch` calls.
## 2024-10-14 - [Express Request Body Size Limits]
**Vulnerability:** Missing request body size limit on the `express.raw` middleware used in the Shopify webhook endpoint.
**Learning:** Express middleware like `body-parser.json()` or `express.raw()` must explicitly define size limits. Without constraints, attackers can send excessively large payloads, leading to memory exhaustion and Denial of Service (DoS).
**Prevention:** Always set an explicit `limit` option (e.g., `{ limit: '2mb' }`) on all input parsing middleware.
