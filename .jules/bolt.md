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
**Learning:** In src/domain/services/ReplenishmentEvaluator.ts, iterating over all products inside the rules loop to find variants caused a severe O(N*M) bottleneck.
**Action:** Always pre-compute a mapped lookup from keys to variants directly (O(1)) instead of mapping to parent entities (Products) and doing nested linear scans.
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
## $(date +%Y-%m-%d) - [Optimize PutawaySuggester multi-pass iteration]
**Learning:** In TypeScript/Node.js, chaining `.map()` and `.filter()` over large arrays allocates intermediate arrays and adds unnecessary CPU overhead.
**Action:** Consolidate data transformations and filtering into a single `for` loop to avoid intermediate allocations and reduce iteration overhead to O(N) when performance is critical.
origin/main

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

## Prevention Directives for Automated Refactoring
- **Never Overwrite Complete Files**: Always use range-scoped replacement chunks (`StartLine`/`EndLine`) for edits to `schema.prisma`, `index.ts`, `public/index.php`, or DDL SQL scripts.
- **Do Not Remove Core Declarations**: Do not delete existing route registrations or database DDL tables.
- **Environment Isolation Compatibility**: When replacing fallback secrets, preserve test environment execution via `!getenv('APP_ENV')` or `getenv('APP_ENV') === 'testing'`.
- **No Scratch Files**: Never stage or commit `test_*.ts`, `test_*.js`, `test.cjs`, `fix_*.php`, or `test.js` files to git.
- **No Unresolved Conflict Markers**: Never stage or commit files containing Git merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`, `|||||||`). Always resolve conflicts cleanly before committing.

## Hallucinatory Task & Empty PR Directives
- **Zero-Diff Task Termination**: If the requested optimization, refactor, or fix is ALREADY natively present in the target branch, DO NOT create an empty pull request or commit an acknowledgment PR. Exit the task cleanly without opening a PR.
- **Stale Suggestion Guard**: Always verify the current code on `main`/`master` before planning changes. If no actionable diff is required, cancel task execution immediately.

## 2024-09-06 - Performance Optimization: Replacing .split().map().filter().map() chains with a single loop
**Learning:** Chaining `.map()` and `.filter()` over arrays (like CORS origins parsing) allocates intermediate arrays and adds unnecessary CPU overhead.
**Action:** Consolidate data transformations and filtering into a single `for` loop to avoid intermediate allocations and reduce iteration overhead to O(N).
## 2024-05-31 - Optimize PutawaySuggester multi-pass iteration
**Learning:** In TypeScript/Node.js, chaining `.filter()` and `.map()` over large arrays allocates intermediate arrays and adds unnecessary CPU overhead.
**Action:** Consolidate data filtering and transformation into a single `for` loop to avoid intermediate allocations and reduce iteration overhead to O(N).

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
