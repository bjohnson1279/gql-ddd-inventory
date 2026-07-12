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

## 2024-06-21 - Fix timing attack vulnerability in password verification

**Vulnerability:** The `verifyPassword` function in `src/infrastructure/utils/security.ts` used a standard string equality operator (`===`) to compare the generated hash with the stored hash. This makes the comparison susceptible to timing attacks, where an attacker can measure the time taken to evaluate the comparison and potentially deduce the correct hash byte-by-byte.
**Learning:** Comparing cryptographic hashes or secure tokens using non-constant time operations exposes a timing side-channel.
**Prevention:** Always use `crypto.timingSafeEqual` (or a similar constant-time comparison utility) when comparing password hashes, API keys, HMAC signatures, or any other sensitive cryptographic values to prevent timing attacks. Ensure inputs to `timingSafeEqual` are buffers of the same length to prevent runtime errors.

## 2026-06-11 - Brute-force Vulnerability on Login Endpoint

**Vulnerability:** The `login` GraphQL mutation lacked brute-force protection and rate-limiting. A malicious actor could repeatedly test credentials against the endpoint without restriction, attempting to guess valid passwords (credential stuffing or dictionary attacks).
**Learning:** Exposed authentication endpoints without rate limiting allow unchecked password guessing, posing a severe security risk even if passwords are computationally secure.
**Prevention:** Implement endpoint-specific rate limiting (such as an in-memory or Redis-backed sliding window counter) specifically for authentication endpoints to block rapid, successive failed login attempts. Include periodic cleanup logic for in-memory limiters to prevent DoS via memory exhaustion.
## 2024-06-21 - [Fix cross-tenant authorization bypass in enforceRole]
**Vulnerability:** The `enforceRole` helper function, used universally for GraphQL authorization, allowed callers to arbitrarily bypass tenant boundaries by injecting a spoofed `tenantId` into the query variables, which overrode or ignored the `tenantId` securely verified from the JWT token.
**Learning:** Even when a secure context exists (e.g., JWT `tenantId`), if downstream logic falls back to user-provided input without explicitly asserting a match, it creates a severe IDOR/Authorization bypass.
**Prevention:** Always explicitly validate that user-provided scope variables (like target tenant IDs) strictly match the authorized scope derived from the authenticated context.
## 2026-06-22 - Fix IDOR in enforceRole Authorization Check
 **Vulnerability:** The `enforceRole` helper validated that the requested `tenantId` matched the `context.auth.tenantId` from the JWT token, but it failed to validate the `actorId`. This omission allowed an authenticated user within a valid tenant to arbitrarily spoof their `actorId` and perform unauthorized actions on behalf of other actors (like `admin-user`), leading to an IDOR (Insecure Direct Object Reference).
 **Learning:** Authorization helpers must exhaustively validate *all* requested identity scopes against the authenticated context. A correct tenant boundary check does not guarantee a secure actor identity boundary.
 **Prevention:** Ensure that multi-dimensional authorization contexts (e.g., Tenant + Actor) perform explicit parity checks for all dimensions (e.g., `if (actorId && context.auth.actorId !== actorId) throw new Error(...)`).
## 2026-06-24 - Timing Attack User Enumeration Fix
**Vulnerability:** The login mutation exhibited a timing attack vulnerability that allowed user enumeration because it bypassed `verifyPassword` entirely when an account didn't exist, returning much faster than for a valid username. It also leaked account existence directly by throwing "Account deactivated." for inactive accounts.
**Learning:** Returning early on "user not found" checks allows an attacker to measure the timing difference between invalid usernames (fast) and valid ones (slow due to PBKDF2). In addition, informative error messages for different failure states (like "Account deactivated.") help attackers narrow down active vs. inactive users.
**Prevention:** To prevent user enumeration via timing attacks, ensure the response time is consistent regardless of user existence by performing a dummy hash verification (`verifyPassword` against a predefined dummy hash) when the account is not found. Similarly, avoid leaking exact account states by throwing generic "Invalid credentials." errors for all failure modes, including deactivated accounts.

## 2026-06-25 - TimescaleDB Setup and Database Parity Constraints
**Learning:** In multi-variant backends (GraphQL, Express, Laravel), switching database engines (e.g., reverting the Express backend to SQLite or using mock local SQLite files) breaks TimescaleDB hypertable features and causes database drift. Additionally, database connection configuration must be securely validated.
**Action:** 
- Maintain database engine parity across all service variants by strictly using PostgreSQL for physical datastores.
- Do not run `prisma db push` during automated npm package installation (`postinstall`) in CI or production build environments, as it will fail due to the absence of a running database. Limit postinstall steps to `prisma generate` and execute migrations/pushes in dedicated pipeline steps or deployment startup phases.
- Ensure that any dynamic database connection strings (like `DATABASE_URL` built from separate components) are validated on server startup and fallback safely to trusted local defaults for development environments.
- Protect raw SQL queries used to enable the `timescaledb` extension or initialize hypertables from SQL injection vulnerabilities by using parameterized queries or strict schema names.
## 2026-06-30 - Fix Prototype Pollution Vulnerability in OutboxWorker
**Vulnerability:** The `deserializeEvent` function in `OutboxWorker.ts` dynamically reconstructs objects from parsed JSON payloads using `Object.assign(event, payload)`. This makes the application susceptible to Prototype Pollution, as malicious actors could craft payloads with `__proto__`, `constructor`, or `prototype` keys to override default object properties or methods.
**Learning:** Using `Object.assign` to copy properties from externally provided or parsed JSON payloads onto newly instantiated objects without filtering exposes the application to Prototype Pollution.
**Prevention:** Replace dangerous `Object.assign` calls with explicit iteration over payload keys, blocking known dangerous keys (`__proto__`, `constructor`, `prototype`) from being copied.
## 2026-07-11 - Insecure Prisma Raw SQL Methods
**Vulnerability:** SQL Injection via Prisma's $queryRawUnsafe and $executeRawUnsafe even when using manual positional parameters (e.g. $1).
**Learning:** Prisma's 'Unsafe' raw methods intentionally bypass parameterization, making manual positional parameters insecure. The built-in tagged template literals must be used instead.
**Prevention:** Always use $queryRaw and $executeRaw tagged template literals to automatically and securely parameterize inputs.

## 2026-07-11 - Prevent SSRF in Webhook integrations
**Vulnerability:** External integration domains (like Shopify) were being passed directly to `fetch` and only checked via `includes`, which allowed bypassing the filter (e.g. `169.254.169.254?.myshopify.com`) leading to potential SSRF on internal infrastructure.
**Learning:** Relying on simple string matching (like `includes('.myshopify.com')`) is insufficient for URL safety. Malicious users can embed necessary strings in query parameters, causing unintended external or internal connections.
**Prevention:** To prevent Server-Side Request Forgery (SSRF) vulnerabilities in outbound HTTP requests, always validate user-provided URLs by parsing them (`new URL()`), enforcing allowed protocols, and explicitly blocking internal hostnames, loopback addresses, and private network IPs.
## 2024-05-18 - [SSRF Bypass via Node.js URL Normalization]
**Vulnerability:** Basic string matching for IPv4 loopback (`startsWith("127.")`) on `URL.hostname` fails to block IPv6 equivalents like `::1`, `::`, and IPv4-mapped IPv6 addresses (`::ffff:127.0.0.1`), allowing SSRF.
**Learning:** Node.js `URL` normalizes IPv4-mapped IPv6 addresses into compressed hex (e.g., `[::ffff:7f00:1]`) and wraps all IPv6 addresses in brackets `[]`, bypassing naive string checks. Furthermore, ULA prefixes (`fc00::/7`) span both `fc00:` and `fd00:` hex ranges.
**Prevention:** Explicitly strip brackets from `URL.hostname` and validate normalized IPv6 loopback, unspecified, link-local, and ULA prefixes alongside IPv4.
