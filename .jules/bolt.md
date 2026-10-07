## 2024-05-18 - Nested Lookup Bottlenecks in Strategy Generation
**Learning:** `activeCandidates.find` inside deeply nested `generatePlans` combinations scales CPU usage exponentially in `OrderRoutingEngine`, leading to O(N*M) CPU hangs for large orders.
**Action:** Always pre-compute invariant candidate lookups and distances into O(1) `Map`s before invoking looping mechanisms in routing/strategy calculations.

## 2024-05-24 - O(N*M) Lookup Bottlenecks in Fallback Algorithms
**Learning:** Using `Array.find()` inside loops across large datasets (e.g., `stockLevels` mapped against `forecasts` in `RebalanceOptimizationService.basicFallback`) creates O(N*M) performance bottlenecks that hang execution with thousands of SKUs.
**Action:** Always pre-compute composite keys (e.g., `${warehouse_id}\0${sku}`) into an O(1) `Map` before iterating over large datasets to reduce time complexity to O(N+M).

## 2024-05-24 - Prisma TOCTOU in upsert replacements
**Learning:** When refactoring Prisma `upsert` loops into batched operations, using `findMany` followed by `createMany` introduces a TOCTOU (Time-of-Check to Time-of-Use) race condition even inside a `$transaction` (unless explicit row locks are used). Furthermore, `updateMany` cannot be easily used for a list of disparate updates without raw SQL which bypasses Prisma's automatic `@updatedAt` handling and risks type mismatching.
**Action:** When replacing concurrent `upsert` inside a loop for batch operations, use `createMany({ skipDuplicates: true })` for insertions to safely avoid Unique Constraint Violations from race conditions, and iterate the existing records with `Promise.all( ... update() )` to preserve Prisma's type safety and automatic timestamp management while still significantly reducing connection roundtrips.

## 2024-05-31 - Nested Lookup Bottleneck in Demand Forecaster
**Learning:** Using `Array.find()` inside loops across large datasets (e.g., `inventoryItems.map` iterating over thousands of items checking against `forecasts`) creates O(N*M) performance bottlenecks in `DemandForecaster.getDemandPlanningReport` that hang execution for large inventories.
**Action:** Always pre-compute conditions matching active forecasts into an O(1) `Map` keyed by SKU before iterating over the inventory list to reduce time complexity to O(N+M).

## 2024-05-31 - Array.find Bottleneck in Sync Resolvers
**Learning:** Fetching an entire collection from a database repository (e.g., all `JournalEntry` records for a tenant) and then using `Array.prototype.find()` to locate a single item creates a severe O(N) memory and execution bottleneck, particularly dangerous in GraphQL mutations handling external syncs.
**Action:** Always implement a dedicated `findById` Use Case (or equivalent repository lookup) to leverage the database's native O(1) index lookup and avoid loading unnecessary records into application memory.

## 2024-05-31 - Array.find Bottleneck in Nested Loops
**Learning:** Using `Array.find()` inside nested loops across large datasets creates O(N*M*P) performance bottlenecks. In `RebalanceOptimizationService.getRebalanceMatrix`, the rule lookup depended only on the outer loop but was placed inside the inner loop.
**Action:** Always pre-compute map lookups outside loops and hoist invariant variables out of inner loops.

## 2024-05-19 - N+1 Query in ManageReturns
**Learning:** I learned that there was a database fetch (`findManyBySerialsAndVariant`) inside a `for (const item of dto.items)` loop during RMA item receipt. This query was unnecessary because the exact same serial numbers were already being batch-fetched and mapped to an `existingSerialItemsList` immediately before the loop! I only had to correctly index into this existing map.
 **Action:** In future optimizations, always check if the data being fetched inside a loop is already available in the surrounding scope. Reusing O(1) in-memory maps instead of making N duplicate database calls is a huge performance win.

## 2026-08-11 - Batch Aggregate Variant Quantities to Prevent Redundant Processing
**Learning:** In GetStockValuationReportUseCase, looping over inventory locations mapping to the same variant without grouping results in redundant N+1 lookup calls against calculateCostBatch and duplicated memory consumption.
 **Action:** Proactively aggregate shared keys (like variantId) mapped to a numeric quantity before invoking batch APIs, then redistribute the aggregate calculations back to the granular level.

## 2024-05-31 - Pre-Filtering Constraints Before Heavy Fetching
**Learning:** In `PutawaySuggester.ts`, fetching the entire inventory system (`findAll()`) into memory just to score a few valid locations caused severe O(N) memory bloat.
**Action:** When scoring or processing candidate locations, pre-filter them based on independent constraints (like zone matching) *before* fetching related data. Use batched repository methods like `findByLocationsBatch` to scope the database fetch to only the eligible candidates, saving massive memory and CPU overhead.

## 2025-01-20 - Optimize ReplenishmentEvaluator
**Learning:** In src/domain/services/ReplenishmentEvaluator.ts, iterating over all products inside the rules loop to find variants caused a severe O(N*M) bottleneck. However, directly iterating the resulting `product.variants` without filtering will process unrequested SKUs.
**Action:** Always pre-compute a `Set` of requested SKUs for O(1) membership checking and use it to filter the direct iteration over variants to preserve both performance and behavioral correctness.

## 2024-08-21 - Filter Unrequested Variants
**Learning:** Iterating over all product variants without filtering processes unrequested SKUs, causing O(N*M) bottlenecks.
**Action:** Filter variant iterations against a pre-computed Set of requested SKUs.

## 2026-08-24 - Optimize PutawaySuggester
**Learning:** In PutawaySuggester, multiple Array.find() calls on attributes and building intermediate arrays for location items caused unnecessary overhead. Aggregating data directly into an O(1) Map instead of intermediate arrays prevents nested loops and memory bloat.
**Action:** Iterate once over collections and aggregate data directly into a Map to avoid O(N*M) nested loops and intermediate array allocations.

## 2024-05-31 - Fallback Heuristic Complexity Optimization
**Learning:** In `SlottingOptimizerService.fallbackLocalHeuristic`, there was a nested loop with O(N^2) complexity to find the latest valid swap item based on distance and velocity. Since the array is sorted by velocity, we can precompute the minimum distance suffix array (O(N) time and space) and use two binary searches (one for velocity, one for distance) to reduce the search complexity to O(N log N).
**Action:** When searching for the rightmost element in a monotonic array that satisfies certain criteria, check if combining sorting with suffix minimum/maximum arrays and binary searches can lower complexity to O(N log N).

## 2026-08-30 - Batch Insert Audit Discrepancies
**Learning:** Inserting records one by one inside a loop in `AuditProcessorService.runAudit` causes N+1 query bottlenecks and slows down auditing.
**Action:** Always collect records in an array during loop execution and perform a single `createMany` database operation outside the loop to drastically improve performance.

## 2024-05-24 - Prevent N+1 queries in Replenishment Evaluation Loops
**Learning:** `ReplenishmentEvaluator.evaluateRulesForTenant` iterates over all active replenishment rules. If dynamic ROP is enabled, it calls `forecaster.forecastReorderPoint()`. Previously, this forecaster fetched all purchase orders for the tenant from the database inside every loop iteration, leading to an N+1 query problem and severe performance degradation when rules scaled up.
**Action:** When a service layer iterates over business rules or items, explicitly pass the batch pre-fetched related entities (e.g. `allPos`) down to the downstream services (e.g. `forecastReorderPoint`) to reuse the single initial database query. Note that variables named `openPos` might misleadingly refer to all POs.

## 2024-05-24 - Avoid O(N*M) with Array Filter/Some
**Learning:** Chaining `Array.filter()` with a nested `Array.some()` lookup inside loops creates expensive O(N*M) scanning bottlenecks, especially across large sets like all Purchase Orders and their Line Items.
**Action:** Refactor these complex chains into a single `for...of` loop with early `continue/break` conditions to significantly reduce execution time and avoid intermediate array allocations.

## 2026-09-02 - Optimize array iteration
**Learning:** Chaining .filter(), .reduce(), and a for-loop over large ledger entry arrays creates O(N) redundant iterations and unnecessary array allocations.
**Action:** Consolidate data filtering, reduction, and indexing into a single for-loop to avoid intermediate array allocations and reduce iteration overhead to O(N).

## 2026-09-04 - Optimize array iteration
**Learning:** Chaining .filter() and .reduce() over arrays creates O(N) redundant iterations and unnecessary array allocations.
**Action:** Consolidate data filtering and reduction into a single for-loop to avoid intermediate array allocations and reduce iteration overhead to O(N).

## 2026-09-05 - Optimize array iteration in OrderRoutingEngine
**Learning:** Chaining .filter() and .reduce() over arrays creates O(N) redundant iterations and unnecessary array allocations.
**Action:** Consolidate data filtering and reduction into a single for-loop to avoid intermediate array allocations and reduce iteration overhead to O(N).

## 2024-09-06 - Performance Optimization: Replacing .filter().map() chains with a single loop
**Learning:** Chaining `.map()` and `.filter()` over arrays allocates intermediate arrays and adds unnecessary CPU overhead.
**Action:** Consolidate data transformations and filtering into a single `for` loop to avoid intermediate allocations and reduce iteration overhead to O(N).

## 2024-09-06 - Performance Optimization: Replacing .split().map().filter().map() chains with a single loop
**Learning:** Chaining `.map()` and `.filter()` over arrays (like CORS origins parsing) allocates intermediate arrays and adds unnecessary CPU overhead.
**Action:** Consolidate data transformations and filtering into a single `for` loop to avoid intermediate allocations and reduce iteration overhead to O(N).

## 2024-05-31 - Optimize PutawaySuggester multi-pass iteration
**Learning:** In TypeScript/Node.js, chaining `.filter()` and `.map()` over large arrays allocates intermediate arrays and adds unnecessary CPU overhead.
**Action:** Consolidate data filtering and transformation into a single `for` loop to avoid intermediate allocations and reduce iteration overhead to O(N).

## 2024-05-31 - Optimize AuditProcessorService multi-pass iteration
**Learning:** In TypeScript/Node.js, chaining `.filter()` and `.map()` over large arrays allocates intermediate arrays and adds unnecessary CPU overhead.
**Action:** Consolidate data filtering and transformation into a single `for` loop to avoid intermediate allocations and reduce iteration overhead to O(N).

## $(date +%Y-%m-%d) - [Optimize PutawaySuggester multi-pass iteration]
**Learning:** In TypeScript/Node.js, chaining `.map()` and `.filter()` over large arrays allocates intermediate arrays and adds unnecessary CPU overhead.
**Action:** Consolidate data transformations and filtering into a single `for` loop to avoid intermediate allocations and reduce iteration overhead to O(N) when performance is critical.
origin/main

## Prevention Directives for Automated Refactoring
- **Never Overwrite Complete Files**: Always use range-scoped replacement chunks (`StartLine`/`EndLine`) for edits to `schema.prisma`, `index.ts`, `public/index.php`, or DDL SQL scripts.
- **Do Not Remove Core Declarations**: Do not delete existing route registrations or database DDL tables.
- **Environment Isolation Compatibility**: When replacing fallback secrets, preserve test environment execution via `!getenv('APP_ENV')` or `getenv('APP_ENV') === 'testing'`.
- **No Scratch Files**: Never stage or commit `test_*.ts`, `test_*.js`, `test.cjs`, `fix_*.php`, or `test.js` files to git.
- **No Unresolved Conflict Markers**: Never stage or commit files containing Git merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`, `|||||||`). Always resolve conflicts cleanly before committing.
- **Never Overwrite Complete Files**: Always use range-scoped replacement chunks for edits to `schema.prisma`, `index.ts`, `public/index.php`, `db/schema.rb`, or DDL SQL scripts.

## Hallucinatory Task & Empty PR Directives
- **Zero-Diff Task Termination**: If the requested optimization, refactor, or fix is ALREADY natively present in the target branch, DO NOT create an empty pull request or commit an acknowledgment PR. Exit the task cleanly without opening a PR.
- **Stale Suggestion Guard**: Always verify the current code on `main`/`master` before planning changes. If no actionable diff is required, cancel task execution immediately.

## Completeness & Verification Directives
- **Explicit Parameter & Contract Validation**: When creating or modifying API endpoints (Express, Fastify, Rails, Laravel), always implement explicit parameter and request body validation schemas (e.g. `z.string().uuid()`) to prevent unhandled 404/500 fallthroughs.
- **Database Indexing for Queries**: When addressing query bottlenecks or adding query lookup filters, always implement native database index migrations rather than loading collections into memory and performing array filtering (`.filter()`, `.select`).
- **Co-Occurring Dependency Auditing**: When bumping any dependency version, verify that other transitive dependencies do not carry high/critical security advisories (e.g. run `bundler-audit`, `npm audit`). Never introduce a version bump that breaks underlying framework APIs.
- **Self-Verification Before Commit**: Always run syntax checks (`bash -n` for shell scripts, `tsc --noEmit` for TypeScript, linter checks) and targeted test runners locally before opening or updating a PR.
## 2024-05-31 - Optimize AnomalyDetectionService iteration overhead
**Learning:** In TypeScript/Node.js, chaining `.filter()` and `.map()` over large arrays allocates intermediate arrays and adds unnecessary CPU overhead.
**Action:** Consolidate data filtering and transformation into a single `for` loop to avoid intermediate allocations and reduce iteration overhead to O(N).

## 2024-09-06 - Performance Optimization: Replacing .map() passes with single loops
**Learning:** In TypeScript/Node.js, executing multiple `.map()` passes sequentially over the same large arrays (e.g. mapping `items` to `variantIds`, then mapping again to `sourcePairs`) allocates intermediate arrays and causes O(N) redundant iteration overhead.
**Action:** Consolidate data transformation into a single `for...of` loop to avoid intermediate array allocations and reduce the iteration passes when iterating over large item collections.

## 2024-05-31 - Optimize lead time variance calculation
**Learning:** Chaining `.map()` and multiple `.reduce()` operations creates intermediate arrays and adds unnecessary CPU overhead.
**Action:** Consolidate data transformations and reduction into a single `for` loop. When calculating variance in a single pass using the sum of squares formula ($Var(X) = E[X^2] - (E[X])^2$), use `Math.max(0, variance)` before passing the value to `Math.sqrt()` to prevent `NaN` errors caused by floating-point inaccuracies.
## 2026-09-16 - Optimize AnomalyDetectionService iteration overhead
**Learning:** In TypeScript/Node.js, chaining `.filter()` and `.reduce()` over large arrays allocates intermediate arrays and adds unnecessary CPU overhead.
**Action:** Consolidate data filtering and transformation into a single `for` loop to avoid intermediate allocations and reduce iteration overhead to O(N).

## 2024-05-18 - Avoiding Large Intermediate Array Allocations
**Learning:** Using chained array methods like `.map()` within constructors like `new Set()` or after `Array.from()` creates huge temporary arrays on large datasets like full inventory tables, causing unnecessary memory allocation and garbage collection pressure.
**Action:** Replace these patterns with single-pass `for...of` loops to push or add directly to the destination data structure.

## 2026-09-18 - Optimize Map and Set initializations
**Learning:** Initializing Maps and Sets by mapping over an array first (e.g., `new Map(arr.map(x => [x.id, x]))`) creates unnecessary intermediate array allocations, reducing performance during large iterations.
**Action:** Consolidate `.map()` and Map/Set instantiation into a single `for` loop to avoid intermediate allocations and improve iteration performance.
## 2026-09-20 - Optimize Map and Set initializations\n**Learning:** Initializing Maps and Sets by mapping over an array first (e.g., `new Map(arr.map(x => [x.id, x]))`) creates unnecessary intermediate array allocations, reducing performance during large iterations.\n**Action:** Consolidate `.map()` and Map/Set instantiation into a single `for` loop to avoid intermediate allocations and improve iteration performance.

## 2024-05-31 - Optimize RebalanceOptimizationService iteration overhead
**Learning:** Chaining \`.map()\` and iterating over entries with \`Array.from()\` creates intermediate arrays and slows down large data aggregations.
**Action:** Consolidate data transformation into single \`for...of\` loops.

## 2024-10-17 - Avoid intermediate arrays when instantiating Maps
**Learning:** Using `new Map(items.map(...))` or `items.flatMap(i => i.history.map(...))` creates hidden intermediate arrays (e.g. tuples) before constructing the target data structure. In batch processes like `saveBatch`, this causes O(N) unnecessary memory allocations, increasing CPU time spent on garbage collection.
**Action:** Consolidate array extraction into a single `for...of` loop when building maps, sets, or flattened arrays.

## 2026-09-29 - Optimize Map and Set initializations
**Learning:** Initializing Maps and Sets by mapping over an array first (e.g., `new Map(arr.map(x => [x.id, x]))`) creates unnecessary intermediate array allocations, reducing performance during large iterations.
**Action:** Consolidate `.map()` and Map/Set instantiation into a single `for` loop to avoid intermediate allocations and improve iteration performance.

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

## 2026-09-29 - Surgical Optimization Edits and No Scratch Script Commits
**Learning:** Running whole-file formatters or regenerating entire components while performing performance optimizations introduces massive whitespace/formatting diffs (1,000+ lines), masking the real optimization, invalidating git blame, and causing painful merge conflicts with concurrent PRs. Additionally, committing scratch benchmark or patch scripts (`patch_*.py`, `test.cjs`) pollutes production repositories and triggers CI guardrail failures.
**Action:** Restrict all algorithmic and performance optimizations to strictly scoped replacement chunks. Diff size must reflect only the functional optimization. Always clean up temporary benchmark or patch scripts with `git rm -f` before committing.

## 2024-10-18 - Avoid Array allocations when initializing Sets
**Learning:** Using `Array.from(new Set(array.map(...)))` creates an intermediate array from `.map()`, which degrades performance and increases memory usage for large arrays.
**Action:** Populate `Set`s using a `for...of` loop directly to avoid the intermediate array allocation, maintaining O(N) complexity with lower memory overhead.

## Additive Documentation & Scratch Cleanliness Directives
- **Strictly Additive Journal Updates**: When updating `.jules/*.md`, strictly append new dated entries (`## YYYY-MM-DD - Title`). NEVER delete, truncate, or overwrite historical learnings or previous entries.
- **Substantive Code Diff Requirement**: Pull requests must include substantive code changes in `src/`, `app/`, `lib/`, or `tests/`. Never open PRs that modify only `.jules/*.md` journals or root scratch scripts.
- **Zero Scratch File Commits**: Never commit `*.diff`, `*.patch`, `test_*.ts`, `test_*.js`, `test.cjs`, `fix_*.php`, or `patch_*.py` files. Always remove temporary debugging or verification scripts prior to committing.

## 2024-10-24 - Avoid Array allocations when using Object methods and Sets
**Learning:** Using `Object.keys()` or `Object.values()` combined with `.reduce()` or spread operators (`...`) to initialize `Set`s allocates intermediate arrays and causes unnecessary memory overhead. This is especially taxing in CRDT conflict resolution which might execute very frequently.
**Action:** Consolidate property extraction into a single `for...in` loop to avoid intermediate array allocations, improving iteration performance and reducing GC pressure.

## Scope Quarantine, Journaling & Security Test Invariants
- **Strictly Append-Only Journaling**: When adding learnings to `.jules/*.md`, append strictly at the end of the file. Do not rewrite, deduplicate, or remove lines beginning with `## YYYY-MM-DD`.
- **Surgical Scope Quarantine**: Modify only the files directly involved in the issue and their corresponding test fixtures. Do not delete, rename, or perform drive-by cleanups of unrelated root-level scripts or legacy files.
- **Coupled Test Fixture Awareness for Security Invariants**: When changing fail-open fallback behavior (such as hardening decryption to fail closed), always update upstream test mocks that rely on plaintext credentials or mock values.

## 2024-11-20 - Avoid intermediate array allocations when populating Sets
**Learning:** Chaining \`.map()\` within \`new Set()\` (e.g., \`new Set(existingItems.map(i => i.id))\`) creates hidden intermediate arrays before constructing the target data structure. In batch persistence operations like \`saveBatch\`, this causes O(N) unnecessary memory allocations, increasing CPU time spent on garbage collection.
**Action:** Replace \`new Set(array.map(...))\` with single-pass \`for...of\` loops to directly populate the \`Set\` and eliminate O(N) intermediate array allocations during batch operations.
## 2024-11-20 - Avoid intermediate array allocations when populating Maps
**Learning:** Chaining `.map()` within `new Map()` (e.g., `new Map(submittedCounts.map(s => [s.sku, s.countedQuantity]))`) creates hidden intermediate array tuples before constructing the target Map structure. This causes O(N) unnecessary memory allocations, increasing CPU time spent on garbage collection, especially during large batch operations like cycle counting or bulk auditing.
**Action:** Replace `new Map(array.map(...))` with single-pass `for...of` loops to directly populate the `Map` using `.set()` to eliminate O(N) intermediate array allocations during large processing operations.

## 2026-03-30 - Batch update variant rows and attributes in PostgresProductRepository to eliminate N+1 queries
**Learning:** Using `Promise.all` with individual `upsert` and attribute `deleteMany`/`createMany` queries in `PostgresProductRepository.save` creates $3N$ database queries for a product with $N$ variants, risking connection pool exhaustion and causing high query latency.
**Action:** Split variant persistence into a single `createMany` for new variants, raw SQL batch `UPDATE` for existing variants, and bulk `deleteMany`/`createMany` queries for attributes to reduce total database queries from $3N+3$ to $7$.
## 2025-05-10 - Optimize TenantConnectionPool LRU eviction to O(1) using Map insertion-order
**Learning:** Native JavaScript `Map` maintains key insertion order. Re-inserting existing keys (`delete` then `set`) on access turns `Map` into an $O(1)$ LRU cache without external dependencies or linear $O(N)$ loops over entries.
**Action:** Replace $O(N)$ scanning loops over `Map` entries for LRU eviction with Map key re-insertion and head key eviction via `map.keys().next().value`.
