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
