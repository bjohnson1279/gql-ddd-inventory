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
## 2026-08-26 - Fix Exception Leakage in Gateway
**Vulnerability:** Apollo Server in the API gateway leaked sensitive `exception` object details from `extensions` in production, although it stripped the `stacktrace` property.
**Learning:** Only deleting `stacktrace` is insufficient because the `exception` object itself can contain sensitive internal errors, database details, or file paths.
**Prevention:** Ensure `formatError` explicitly deletes the entire `extensions.exception` object in production environments.
## 2025-03-01 - [Missing DoS Guardrails on Gateway]
**Vulnerability:** The federated GraphQL gateway (`src/gateway/index.ts`) was missing depth and complexity limits (`depthLimitRule`, `complexityLimitRule`), unlike the main monolith ApolloServer.
**Learning:** In a federated GraphQL architecture, it's crucial to enforce query depth and complexity limits at the outermost edge (the gateway) to prevent Denial of Service (DoS) attacks via heavily nested queries before they reach internal subgraphs.
**Prevention:** Always attach AST validation rules (`depthLimitRule` and `complexityLimitRule`) to the `ApolloServer` instance configuring the `ApolloGateway`.
## 2025-03-01 - [Missing DoS Guardrails on Subgraphs]
**Vulnerability:** The federated GraphQL subgraphs (`src/subgraphs/*/*.ts`) were missing depth and complexity limits (`depthLimitRule`, `complexityLimitRule`), unlike the main monolith ApolloServer.
**Learning:** In a federated GraphQL architecture, it is crucial to enforce query depth and complexity limits on both the gateway and all subgraph servers to prevent Denial of Service (DoS) attacks.
**Prevention:** Always attach AST validation rules (`depthLimitRule` and `complexityLimitRule`) to the `ApolloServer` instance configuring the subgraphs.
## 2024-05-23 - [Refactored Fetch Timeout to Native AbortSignal]
**Vulnerability:** Legacy HTTP timeout handling using `AbortController` and `setTimeout` without clearing timers properly can lead to memory leaks and resource exhaustion (tarpit attacks) when fetch operations hang in high-throughput node applications.
**Learning:** Native `AbortSignal.timeout(ms)` resolves this entirely by relying on Node's internal unrefed timers. Manual timer clearing is error-prone.
**Prevention:** Always use `AbortSignal.timeout(ms)` for native fetch requests rather than instantiating manual `AbortController` and `setTimeout` timers.
## 2024-03-05 - [Strict CORS Origin Validation]
**Vulnerability:** Allowed CORS origins parsed from environment variables used simple string manipulation (`split` and `trim`), which could allow malformed or unexpected URLs to bypass validation.
**Learning:** When parsing allowed CORS origins from environment variables, relying on string manipulation is insufficient and can lead to overly permissive CORS configurations if an attacker provides a malformed URL that happens to contain the expected substring or bypasses simple matching logic.
**Prevention:** Strictly validate and normalize each origin using the `new URL(origin).origin` constructor. Explicitly throw an error if the URL is malformed or invalid to enforce a fail-closed posture and prevent bypasses.
origin/main
