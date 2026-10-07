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

## Prevention Directives for Automated Refactoring
- **Never Overwrite Complete Files**: Always use range-scoped replacement chunks (`StartLine`/`EndLine`) for edits to `schema.prisma`, `index.ts`, `public/index.php`, or DDL SQL scripts.
- **Do Not Remove Core Declarations**: Do not delete existing route registrations or database DDL tables.
- **Environment Isolation Compatibility**: When replacing fallback secrets, preserve test environment execution via `!getenv('APP_ENV')` or `getenv('APP_ENV') === 'testing'`.
- **No Scratch Files**: Never stage or commit `test_*.ts`, `test_*.js`, `test.cjs`, `fix_*.php`, or `test.js` files to git.
- **No Unresolved Conflict Markers**: Never stage or commit files containing Git merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`, `|||||||`). Always resolve conflicts cleanly before committing.

## Hallucinatory Task & Empty PR Directives
- **Zero-Diff Task Termination**: If the requested optimization, refactor, or fix is ALREADY natively present in the target branch, DO NOT create an empty pull request or commit an acknowledgment PR. Exit the task cleanly without opening a PR.
- **Stale Suggestion Guard**: Always verify the current code on `main`/`master` before planning changes. If no actionable diff is required, cancel task execution immediately.


## Prevention Directives for Automated Refactoring
- **Never Overwrite Complete Files**: Always use range-scoped replacement chunks for edits to `schema.prisma`, `index.ts`, `public/index.php`, `db/schema.rb`, or DDL SQL scripts.
- **Do Not Remove Core Declarations**: Do not delete existing route registrations or database DDL tables.
- **Environment Isolation Compatibility**: When replacing fallback secrets, preserve test environment execution via `!getenv('APP_ENV')` or `getenv('APP_ENV') === 'testing'`.
- **No Scratch Files**: Never stage or commit `test_*.ts`, `test_*.js`, `test.cjs`, `fix_*.php`, or `test.js` files to git.
- **No Unresolved Conflict Markers**: Never stage or commit files containing Git merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`, `|||||||`). Always resolve conflicts cleanly before committing.

## Completeness & Verification Directives
- **Explicit Parameter & Contract Validation**: When creating or modifying API endpoints (Express, Fastify, Rails, Laravel), always implement explicit parameter and request body validation schemas (e.g. `z.string().uuid()`) to prevent unhandled 404/500 fallthroughs.
- **Database Indexing for Queries**: When addressing query bottlenecks or adding query lookup filters, always implement native database index migrations rather than loading collections into memory and performing array filtering (`.filter()`, `.select`).
- **Co-Occurring Dependency Auditing**: When bumping any dependency version, verify that other transitive dependencies do not carry high/critical security advisories (e.g. run `bundler-audit`, `npm audit`). Never introduce a version bump that breaks underlying framework APIs.
- **Self-Verification Before Commit**: Always run syntax checks (`bash -n` for shell scripts, `tsc --noEmit` for TypeScript, linter checks) and targeted test runners locally before opening or updating a PR.

## Hallucinatory Task & Empty PR Directives
- **Zero-Diff Task Termination**: If the requested optimization, refactor, or fix is ALREADY natively present in the target branch, DO NOT create an empty pull request or commit an acknowledgment PR. Exit the task cleanly without opening a PR.
- **Stale Suggestion Guard**: Always verify the current code on `main`/`master` before planning changes. If no actionable diff is required, cancel task execution immediately.
## 2024-05-24 - [Fix CORS missing on rate limited responses]
**Vulnerability:** Rate limiter middleware (`apiLimiter`) was applied before `cors` middleware in `src/index.ts` for Express.
**Learning:** If rate limiting is placed before CORS, 429 Too Many Requests responses will lack CORS headers, causing opaque errors on web clients.
**Prevention:** Ensure `cors` middleware is applied *before* rate limiting middleware when configuring Express.
## 2024-09-17 - SSRF Bypass via IP Encoding
**Vulnerability:** Found an SSRF vulnerability where attackers could evade IP blocking by using octal, hex, or integer encodings (e.g., `0177.0.0.1`).
**Learning:** Relying purely on string matching (like `.startsWith('127.')`) for SSRF prevention fails because URL parsers resolve octal/hex/integer formats to standard IPs.
**Prevention:** Ensure validation logic also explicitly checks for pure integers and numeric segments containing octal or hex prefixes before proceeding.

## 2024-05-25 - Prevent DoS via Buffer.from() TypeError
**Vulnerability:** Unvalidated input passed to Buffer.from() could trigger an ERR_INVALID_ARG_TYPE crash, causing Denial of Service.
**Learning:** Even within a try-catch block, Node.js type errors for Buffer.from() with invalid objects can bypass basic expectations.
**Prevention:** Explicitly validate that untrusted inputs are strings (or Buffers) using `typeof` checks before calling Buffer.from().

## 2026-09-22 - Prevent DoS via Unhandled Type Errors in URL Parsing
**Vulnerability:** The `validateOutboundUrl` function accepted a string type in TypeScript but didn't validate it at runtime. Passing non-strings (e.g. objects from parsed JSON) to `new URL()` throws an unhandled `TypeError`, potentially leading to Denial of Service.
**Learning:** TypeScript types don't exist at runtime. Functions validating untrusted input must perform explicit runtime type checks before passing input to built-in functions like `new URL()` or `Buffer.from()`, which can crash on unexpected types.
**Prevention:** Always add `if (typeof input !== 'string')` guards before parsing URLs or buffers from external sources.
## 2024-05-24 - Fix False Positives in SSRF URL Validation
**Vulnerability:** The SSRF validation logic in `urlValidator.ts` used strict prefix matching (e.g., `hostname.startsWith("127.")`) on all incoming URLs. This caused a functional regression by overzealously blocking valid, external domains that merely happened to share a prefix with a reserved IP range (e.g., `127.0.0.1.some-domain.com`).
**Learning:** Naively applying string prefix checks (like `.startsWith()`) to full domain names for IP blocklists is dangerous and leads to false positives. The native Node.js `URL` class leaves hostnames with alphanumeric segments or unexpected TLDs intact. Thus, an IP blocklist must only be evaluated against hostnames that are strictly structured as IP addresses.
**Prevention:** Before applying reserved IP prefix checks, explicitly verify that the hostname acts as an IP representation. For IPv4, verify that every segment of the hostname is entirely numeric. For IPv6, check for the presence of a colon (`:`). This ensures domain names bypass the IP filter safely.

## Assertiveness, Decisive PR Execution & Comparative Recommendations
- **Proactive & Decisive PR Submission**: Do NOT repeatedly pause to ask permission to open a pull request (e.g., avoid "Would you like me to open a PR for this?", "Can I submit the PR?", "Should I go ahead and create the PR?"). When an optimization, fix, or feature satisfies requirements, passes local test runners/linters, and preserves architectural invariants, proceed decisively to create and submit the Pull Request with a clear, structured summary and rationale.
- **Explicit Recommendations on Options**: When presenting multiple implementation strategies or architecture options (e.g., Option A vs. Option B), NEVER leave the choice open-ended or passive. Always make an explicit, reasoned recommendation (prefixed with `(Recommended)`) based on **overall technical effectiveness**:
  1. *Algorithmic & Complexity Gains*: Time and space complexity impact (O(N*M) -> O(N+M), reduction of nested scans).
  2. *Resource Overhead*: Heap allocations, memory pressure, and GC pause reduction.
  3. *Domain & Architecture Invariants*: Strict backward compatibility, contract stability, and prevention of regression risks.
  4. *Security & Reliability*: Input validation, cryptographic safety, and concurrency safety.
- **Lead with Recommended Path**: State clearly why the recommended solution delivers the highest net value and immediately execute or propose it as the primary course of action rather than asking open-ended questions.

## Scope Verification, Minimal Churn & CI Protection Directives
- **Scope Verification Before Variable Binding**: When adding interactive states or accessibility attributes (e.g. `disabled={loading}`, `aria-busy={loading}`, `isSubmitting`), NEVER assume a variable identifier exists. Always inspect component props, local state hooks (`useState`), or declaration scope first. If not defined, declare the state hook or reuse an existing scope variable. Never introduce TS2304 / TS2552 ("Cannot find name") compile errors.
- **Surgical Edits Only (No Whole-File Formatting)**: Never run whole-file code formatters (Prettier, Black, Pint, rustfmt) across unmodified lines. Changes must be strictly range-scoped and limited to the minimal AST block needed. Avoid noisy quote/whitespace churn that masks real logic changes and causes merge conflicts. Verify with `git diff -w` that non-functional churn is zero.
- **Zero Scratch File Commits**: Never stage or commit ad-hoc verification, patch, or debug scripts (`test.cjs`, `fix_*.cjs`, `fix_*.php`, `patch_*.py`, `patch_*.sh`, `scratch_*`). Execute checks via the project's native test commands (`npm test`, `pytest`, `phpunit`, etc.) and delete temporary scripts before creating git commits.
- **Never Weaken CI Workflows**: Do not modify `.github/workflows/**` to bypass failures (e.g. adding `|| true`, setting `continue-on-error: true`, or commenting out assertions). Always resolve the defect in the source code or test fixture.
- **Explicit Parameter & Variable Types**: In TypeScript files, avoid implicit `any` by always providing explicit types on functions, parameters, and arrow callbacks (e.g. `(id: string) => ...`). Verify zero type errors with `tsc --noEmit` before committing.

## 2026-09-29 - Non-Destructive Security Patching & CI Protection
**Learning:** Security patches must never weaken CI workflow files (`.github/workflows/**`) by appending `|| true` or `continue-on-error: true` to suppress test/build failures. Furthermore, when adding defensive type assertions or input validators in TypeScript, omitting explicit types can introduce `TS7006: Parameter implicitly has an 'any' type`.
**Action:** Never modify CI workflow definitions to bypass test failures; resolve the underlying issue in source code or test fixtures. Always provide explicit types on newly introduced parameters and helper functions. Ensure zero scratch scripts (`fix_*.php`, `test_*.js`) are committed.

## Additive Documentation & Scratch Cleanliness Directives
- **Strictly Additive Journal Updates**: When updating `.jules/*.md`, strictly append new dated entries (`## YYYY-MM-DD - Title`). NEVER delete, truncate, or overwrite historical learnings or previous entries.
- **Substantive Code Diff Requirement**: Pull requests must include substantive code changes in `src/`, `app/`, `lib/`, or `tests/`. Never open PRs that modify only `.jules/*.md` journals or root scratch scripts.
- **Zero Scratch File Commits**: Never commit `*.diff`, `*.patch`, `test_*.ts`, `test_*.js`, `test.cjs`, `fix_*.php`, or `patch_*.py` files. Always remove temporary debugging or verification scripts prior to committing.

## Scope Quarantine, Journaling & Security Test Invariants
- **Strictly Append-Only Journaling**: When adding learnings to `.jules/*.md`, append strictly at the end of the file. Do not rewrite, deduplicate, or remove lines beginning with `## YYYY-MM-DD`.
- **Surgical Scope Quarantine**: Modify only the files directly involved in the issue and their corresponding test fixtures. Do not delete, rename, or perform drive-by cleanups of unrelated root-level scripts or legacy files.
- **Coupled Test Fixture Awareness for Security Invariants**: When changing fail-open fallback behavior (such as hardening decryption to fail closed), always update upstream test mocks that rely on plaintext credentials or mock values.

## 2026-03-30 - Fix Overly Permissive CORS Policy in Non-Production
**Vulnerability:** In non-production environments, wildcard CORS (`*`) or unconfigured `ALLOWED_ORIGINS` allowed unrestricted cross-origin requests.
**Learning:** Defaulting CORS allowed origins to `'*'` in non-production environments exposes applications to unauthorized cross-origin access and potential data leakage.
**Prevention:** Enforce restrictive fallback origins (e.g., specific localhost ports) instead of wildcard `'*'` when `ALLOWED_ORIGINS` is unset or set to `'*'` in non-production.
