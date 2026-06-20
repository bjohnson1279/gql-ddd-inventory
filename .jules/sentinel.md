## 2026-06-02 - Fix timing attack vulnerability in HMAC verification\n**Vulnerability:** HMAC verification for Shopify Webhook payload was using strict string equality (`===`), which is vulnerable to timing attacks.\n**Learning:** The time it takes for a string comparison to fail depends on where the difference is. This allows an attacker to guess the HMAC signature byte by byte.\n**Prevention:** Use `crypto.timingSafeEqual` to compare the HMAC signatures in constant time. Make sure buffers are of the same length to prevent  from throwing an error and verify securely.

## 2026-06-02 - Fix timing attack vulnerability in HMAC verification\n**Vulnerability:** HMAC verification for Shopify Webhook payload was using strict string equality (`===`), which is vulnerable to timing attacks.\n**Learning:** The time it takes for a string comparison to fail depends on where the difference is. This allows an attacker to guess the HMAC signature byte by byte.\n**Prevention:** Use `crypto.timingSafeEqual` to compare the HMAC signatures in constant time. Make sure buffers are of the same length to prevent timingSafeEqual from throwing an error and verify securely.

## 2026-06-04 - Overly Permissive CORS Configuration

**Vulnerability:** A custom callback function was used in the `cors` middleware, which bypassed actual safety checks and inadvertently permitted all requests where the Origin was missing (`!origin`), alongside leaving whitespace vulnerabilities in the ALLOWED_ORIGINS splitting logic.
**Learning:** Security features like CORS should rely on robust, built-in options of libraries (`{ origin: allowedOrigins }`) rather than complex custom callback functions.
**Prevention:** Always sanitize array mappings (e.g., `trim()`) when parsing lists from environment variables, and strictly pass the sanitized array into the `cors` middleware rather than manually implementing wildcard/empty-origin logic.

## 2026-06-04 - Fix permissive CORS configuration

**Vulnerability:** The CORS configuration used a custom callback that allowed requests with an empty origin if the 'ALLOWED_ORIGINS' environment variable wasn't carefully handled. It was splitting an environment variable that might contain extra spaces, which could result in bypassing security controls or creating subtly flawed allowed origin lists. Also, the callback didn't properly follow best practices for explicitly trusted origins from environment variables without custom callbacks.
**Learning:** Overly permissive CORS settings with manual callbacks can introduce subtle vulnerabilities, such as allowing unauthorized cross-origin requests.
**Prevention:** Securely parse explicit trusted origins from environment variables by trimming whitespace, and pass the resulting array directly to the 'origin' configuration option instead of using a custom callback.

## 2026-06-05 - Insecure Randomness for ID Generation

**Vulnerability:** Found `Math.random().toString(36).substring(2, 15)` used across the codebase for generating IDs.
**Learning:** `Math.random()` is not cryptographically secure and can lead to predictable IDs and collisions, which may compromise entity uniqueness and potentially expose them to enumeration or prediction attacks.
**Prevention:** Always use a cryptographically secure pseudorandom number generator (CSPRNG) such as Node's native `crypto.randomUUID()` when generating unique identifiers for security-sensitive values or domain entities. Make sure to explicitly `import crypto from 'crypto';` to satisfy TypeScript and runtime environments.

## 2026-06-05 - Fix missing SHOPIFY_WEBHOOK_SECRET startup validation

**Vulnerability:** The application failed to securely validate the presence of `SHOPIFY_WEBHOOK_SECRET` at startup, allowing it to start silently misconfigured in production.
**Learning:** Critical secrets must be validated at startup to fail securely and loudly rather than degrading silently or securely failing per-request.
**Prevention:** Always implement a fail-fast startup check that throws an error when critical environment variables are missing in the production environment.

## 2026-06-05 - Fix Hardcoded JWT Secret Vulnerability

**Vulnerability:** A fallback JWT secret (`fallback-secret-key-999`) was hardcoded directly in the codebase using a logical OR fallback (`process.env.JWT_SECRET || 'fallback-secret-key-999'`).
**Learning:** Hardcoding fallback secrets as string literals, even behind environment variables, exposes the secret to SAST tools and malicious actors who might gain access to the source code, allowing them to forge JWTs and bypass authentication.
**Prevention:** Rely entirely on environment variables without string literal fallbacks for cryptographic secrets. In local or testing environments, configure a mock secret via environment configuration files or test setups rather than allowing the variable to evaluate to undefined in the runtime, which can cause unexpected runtime errors during verification. Explicitly fail or throw exceptions during startup in production environments if the required variable is missing.

## 2026-06-04 - Overly Permissive CORS Configuration

**Vulnerability:** The CORS configuration in `src/index.ts` parsed the `ALLOWED_ORIGINS` environment variable and split it by commas but did not filter out empty strings. This meant that if the environment variable had a trailing comma, empty space, or was just an empty string, the allowed origins array would include `''`. Express CORS interprets an array containing an empty string as a wildcard or overly permissive, potentially allowing requests with any or no origin.
 **Learning:** Simple string splitting and mapping for environment variables is prone to injecting empty values.
 **Prevention:** Always use `.filter(Boolean)` (or a strict length check) when splitting configuration strings into arrays to prevent accidentally passing empty values to sensitive configurations like CORS origins.

## 2026-06-05 - Hardcoded JWT Secret Vulnerability

**Vulnerability:** The `JWT_SECRET` environment variable had a hardcoded fallback value (`fallback-secret-key-999`) in the `src/index.ts` and `src/infrastructure/graphql/resolvers.ts` files, and it was documented in `README.md`. If the environment variable was not set in production, the application would silently use this well-known secret, allowing attackers to forge valid JWT tokens and bypass authentication/authorization controls.
 **Learning:** Providing fallback values for cryptographic secrets in application code is a critical anti-pattern because it masks misconfiguration in production and introduces a backdoor if the environment isn't properly provisioned.
 **Prevention:** Cryptographic secrets like `JWT_SECRET` should never have fallback values in the source code. Instead, the application must throw a fatal error during startup if a required secret is missing in a production environment.

## 2026-06-05 - Prevent Information Leakage in Error Responses

**Vulnerability:** The Shopify webhook handler in `src/infrastructure/webhooks/shopifyWebhookHandler.ts` was catching exceptions and sending the raw `err.message` back to the external caller in a 500 response (e.g., `res.status(500).send(\`Error processing webhook: ${err.message}\`)`).
**Learning:** Exposing internal error messages, stack traces, or exception details directly to API clients or third-party webhooks can unintentionally leak sensitive system architecture, database query structures, or internal state.
**Prevention:** Catch blocks in public-facing endpoints (REST APIs, Webhooks, GraphQL resolvers) should log the full error details internally for debugging (e.g., via `console.error`) but must return a generic, sanitized error message (like 'Internal Server Error') to the external consumer.

## 2026-06-05 - Fix Hardcoded Shopify Webhook Secret Vulnerability

**Vulnerability:** A fallback Shopify Webhook secret (`shopify-fallback-secret-key-123`) was hardcoded directly in the codebase using a logical OR fallback.
**Learning:** Hardcoding fallback secrets as string literals exposes the secret to SAST tools and malicious actors who might gain access to the source code, allowing them to bypass payload HMAC verifications.
**Prevention:** Rely entirely on environment variables without string literal fallbacks for cryptographic secrets. Explicitly fail during execution or throw an exception if the required variable is missing.

## 2026-06-07 - Webhook Endpoint Rate Limiting Danger

**Vulnerability:** Implementing overly strict IP-based rate limiting on third-party webhook endpoints (like Shopify `/webhooks/shopify`).
**Learning:** Third-party providers often use a limited pool of shared IPs and can send traffic in massive bursts. Strict global API limiters applied to these endpoints cause legitimate webhooks to be dropped with `429 Too Many Requests`. This causes data inconsistency and can result in the provider disabling the webhook subscription entirely. Additionally, global limiters like `express-rate-limit` on endpoints like `/graphql` must have sufficiently high thresholds (e.g. 1000 requests / 15min) to not lock out legitimate users performing normal application interactions.
**Prevention:** Exclude webhook endpoints from global strict rate limiters, or apply distinct limiters specifically calibrated for known third-party IP behavior.

## 2026-06-08 - [Authentication Bypass in Mock Login Mutation]

**Vulnerability:** The GraphQL `login` mutation accepted `tenantId` and `actorId` and returned a valid, signed JWT for those credentials without requiring any password or secret. It was not restricted by environment.
**Learning:** Development utilities or mock endpoints built for easier testing are sometimes deployed to production if not explicitly guarded, acting as complete authorization bypass backdoors.
**Prevention:** Ensure mock authentication endpoints or developer convenience tools are explicitly wrapped with environment checks (e.g., `if (process.env.NODE_ENV === 'production') { throw new Error('Forbidden') }`) so they fail securely if accidentally exposed in production.

## 2026-06-07 - Incomplete Diff Format Causes Hunk Failures

 **Vulnerability:** Patch generation failed to properly construct a git diff with complete `-` and `+` markers, which resulted in a broken patch block and the fix not applying to the actual file.
 **Learning:** When replacing code lines manually or modifying an existing codebase for purely analytical/review-based automation constraints, always ensure the modification is correct at a source level using proper insertion or standard diff replacement techniques rather than attempting manual text formatting of diff blocks without matching context.
 **Prevention:** Use the `replace_with_git_merge_diff` tool properly by matching lines exactly, explicitly removing the old vulnerable lines in the `SEARCH` block, and writing the correct functional block in the `REPLACE` block.

## 2026-06-08 - Development Login Endpoint Exposed

 **Vulnerability:** A development-only `login` GraphQL mutation that generates a valid JWT without credential verification was active in all environments, potentially allowing critical authorization bypass in production.
 **Learning:** Mock authentication endpoints used for local development must be explicitly disabled or gated when the application is built for or run in a production environment.
 **Prevention:** Implement environment checks (`process.env.NODE_ENV === 'production'`) that throw fatal errors inside development-only handlers to prevent accidental deployment and execution.

## 2025-02-24 - GraphQL Resolver Privilege Escalation Fallback

 **Vulnerability:** The `enforceRole` helper used in GraphQL resolvers fell back to granting `admin` roles and `admin-user` identities if the `context` was empty, even outside of `test` environments. Unauthenticated requests that failed to populate the context or omitted an authorization header could easily exploit this logic to gain full administrative privileges.
 **Learning:** The authorization fallback for automated Jest tests used an OR (`||`) condition spanning `process.env.NODE_ENV === 'test'` and checks for an empty context. This effectively created an unintentional backdoor, allowing any request with an empty context to trigger the fallback regardless of the environment.
 **Prevention:** Ensure fallback authentication contexts intended for testing environments strictly rely solely on `process.env.NODE_ENV === 'test'` checks. Never include lax condition groups (like checking for empty objects or missing context) that could allow unauthenticated production requests to bypass authorization controls.
## 2024-06-11 - Apollo Server Information Leakage
**Vulnerability:** Apollo Server, by default, returns full stacktraces in its error responses under the `extensions.exception.stacktrace` or `extensions.stacktrace` object paths.
**Learning:** This exposes internal file paths and execution context to clients, potentially assisting attackers in footprinting the application infrastructure.
**Prevention:** Implement a custom `formatError` hook in the ApolloServer options that explicitly strips stacktrace attributes from the `extensions` object before the error payload is returned to the client.

## 2024-06-17 - Fix unauthorized access to setup mutation
**Vulnerability:** The `setup` GraphQL mutation allowed any unauthenticated user to create new tenant accounts and administrator users within those tenants. This open access posed a critical risk of DoS attacks (filling the database with bogus tenants) and potential unauthorized access if a tenant could overlap.
**Learning:** Initial application bootstrap processes or setup scripts exposed via standard web/GraphQL APIs are commonly forgotten and left accessible to the public post-deployment.
**Prevention:** Ensure that initial setup processes are either restricted exclusively to known, non-production environments (e.g., by whitelisting `development` and `test`) or properly secured with dedicated authentication tokens/secrets at the application boundary before deployment.
## 2026-06-20 - In-Memory DoS Risk on Manual Rate Limiters
**Vulnerability:** A basic `Map` was initially implemented to track failed login attempts for rate limiting without any cache eviction, size limit, or TTL mechanism.
**Learning:** This is an unbounded memory leak. An attacker could exploit this by sending thousands of failed login requests with random, fake emails. Each request creates a permanent entry in the `Map`, quickly exhausting the Node.js server's memory and causing an Out of Memory (OOM) crash.
**Prevention:** When implementing manual in-memory state structures like Maps for security tracking, always include a periodic cleanup mechanism (e.g., `setInterval` to prune expired entries) or rely on established libraries like `rate-limiter-flexible` or `express-rate-limit` that handle LRU/TTL correctly.
