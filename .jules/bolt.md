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
## 2026-08-11 - Batch Operations replacing N+1 Query correctly implemented
 **Learning:** In Prisma and TypeScript DDD environments, N+1 lookups inside mapped array loops (e.g. `items.map(async i => await repo.findById(i))`) can be effectively resolved by performing a `findMany` with an `IN` clause (e.g., `findBySkuAndLocationBatch`), creating a `Map` of the results, and then performing O(1) lookups inside the loop (`map.get(key)`). The implementation in `ManageReplenishment.ts` was perfectly executed prior to this task evaluation.
 **Action:** Apply this identical batching and `Map`-caching pattern whenever encountering N+1 sequential `await`s inside loops in future application Use Cases.
