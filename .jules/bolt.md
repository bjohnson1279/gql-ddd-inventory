## 2026-06-04 - Improve code health by extracting DomainEvent interface

 **Learning:** Extracting inline interfaces or interfaces mixed with classes (like `DomainEvent` from `OnboardingEvents.ts`) to their own dedicated files improves code health, avoids circular dependencies, and increases maintainability. The original prompt stated the file had an `any` type on the event dispatcher in `InventoryService.ts`, which might have been a confusion in the prompt as the actual issue was that `DomainEvent` was poorly located and should be cleanly refactored. The issue was solved by cleanly extracting the interface and updating all imports.

 **Action:** Extract commonly shared interfaces (like event interfaces, shared value objects) into their own files early on to prevent tightly coupling unrelated modules or causing bloated imports.
## 2026-06-05 - Avoid N+1 queries by batching domain services
 **Learning:** Calling database-backed service methods (like `decrementForSale`) inside loops (e.g. iterating over order items) leads to severe N+1 performance bottlenecks because each iteration performs an isolated lookup and save.
 **Action:** Identify loops making individual domain service calls and replace them with a unified "batch" method (e.g. `decrementForSaleBatch`) that aggregates the inputs, performs batched repository lookups (`currentQuantities`), and saves the results collectively (`appendBatch`).

## 2026-06-06 - Avoid N+1 queries when performing WMS capacity validation
 **Learning:** Iterating over SKU adjustments and calling `findBySku` for each item to compute weight and volume is a hidden N+1 query problem that hurts performance during bulk operations like submitting inventory counts.
 **Action:** Aggregate the active SKUs beforehand and use a batched repository operation (`findBySkus`) to load the product variants once into memory, creating a fast map lookup to avoid redundant database calls.

## 2024-06-07 - Avoid Hallucinated Repository Methods
**Learning:** When attempting to optimize batch operations (e.g., using a non-existent `appendBatch` method on an interface like `ILedgerRepository`), always verify that the method is defined in the interface, implemented in the concrete classes, and correctly mocked in the test files. Assuming methods exist based on patterns elsewhere can lead to unmergeable code that breaks the TypeScript build.
**Action:** Always verify the actual interface definition using \`cat\` or \`read_file\` before calling any batch methods, and ensure test mocks are updated if a new method is added.

## 2024-05-13 - N+1 Query Optimization in OutboxWorker
 **Learning:** When processing a batch of records (e.g., in a background worker), updating each record individually in a loop causes an N+1 query problem. This can be resolved by collecting the IDs of the processed records and executing a single bulk update.
 **Action:** Always use batch operations like Prisma's `updateMany` for updating multiple records with the same status or simple atomic operations (like `increment`), rather than iterating and updating each one individually. Ensure test mocks reflect the change from `update` to `updateMany`.

## 2024-06-09 - N+1 Catalog Hydration via Helper Methods
**Learning:** Helper methods in domain use cases (like `findSkuForVariant` in `ManageStockTransfers`) that resolve relationships by calling `.findAll()` on repositories will cause severe N+1 memory and database bottlenecks when called within loops over items (e.g., iterating through transfer line items). The entire catalog is hydrated into memory for every item processed.
**Action:** Always extend repository interfaces (e.g., `IProductRepository`) with targeted, index-backed lookup methods (like `findSkuByVariantId` mapped to `prisma.productVariant.findUnique( { select: { sku: true } } )`) instead of fetching entire collections for in-memory resolution. Ensure all mocked instances in test suites are updated to support the new targeted methods.

## 2026-06-10 - Optimize O(N) Array Allocations on Getters
**Learning:** Calling `.find()` on dynamically generated array getters (like `Array.from(map.values())` inside `Product.variants`) causes continuous memory allocation and O(N) traversal overhead inside domain loop logic.
**Action:** Maintain dedicated internal `Map` indexes (e.g., `_variantsBySku`) to provide native O(1) entity lookups instead of querying dynamic arrays.

## 2026-06-11 - Avoid N+1 Queries in Putaway Suggestion Service
**Learning:** Iterating over warehouse locations and performing isolated repository lookups (like `inventoryRepo.findByLocation` and `productRepo.findBySkus`) inside the loop creates an O(N) database bottleneck that scales linearly with the number of locations. This drastically slows down warehouse recommendation engines.
**Action:** Hoist the data loading outside the loop using bulk repository lookups (`inventoryRepo.findAll()`) and map the records by location (`Map<LocationId, Item[]>`). Then compute the capacities in memory using O(1) lookups, completely eliminating the N+1 query overhead.

## 2026-06-14 - Optimize dynamic array allocations on getters
**Learning:** Returning dynamically generated arrays from getters (like ) causes a new array to be allocated on every access, creating O(N) memory allocation overhead which impacts performance when iterated over repeatedly.
**Action:** Implement lazy-evaluated caching for these arrays. Calculate the array once on first access and store it. Invalidate the cache (set to null) whenever the underlying map is mutated. Return the cached array as `ReadonlyArray<T>` to prevent accidental mutations by callers.
## 2026-06-14 - Optimize dynamic array allocations on getters
**Learning:** Returning dynamically generated arrays from getters (like `Array.from(map.values())`) causes a new array to be allocated on every access, creating O(N) memory allocation overhead which impacts performance when iterated over repeatedly.
**Action:** Implement lazy-evaluated caching for these arrays. Calculate the array once on first access and store it. Invalidate the cache (set to null) whenever the underlying map is mutated. Return the cached array as `ReadonlyArray<T>` to prevent accidental mutations by callers.
## 2026-06-14 - Avoid N+1 Queries inside Replenishment Rule Evaluator Loops
**Learning:** Calling `poRepo.findAllByTenant`, `transferRepo.findAllByTenant`, `productRepo.findBySku`, and `inventoryRepo.findBySkuAndLocation` inside the `for (const rule of rules)` loop in `ReplenishmentEvaluator.ts` results in O(N) isolated database queries and redundant collections fetches, severely degrading performance when analyzing numerous active rules.
**Action:** Extract database operations outside the rule loop by pre-fetching `openPos` and `openTransfers` upfront, and use batch repository methods (`productRepo.findBySkus`, `inventoryRepo.findBySkuAndLocationBatch`) mapped by `sku` or `sku_locationId` to allow fast O(1) in-memory resolution for every evaluated rule. Ensure test mocks reflect and support these batch operations properly.

## 2026-06-20 - Cache spread array copies in getters
**Learning:** Using the spread operator (e.g., `[...this._items]`) inside getters causes a new array to be allocated on every access, introducing unnecessary O(N) memory allocation overhead, similar to `Array.from()`.
**Action:** Implement lazy-evaluated caching for these arrays as well. Calculate the array once on first access and store it in a private field (e.g., `_itemsArray`). Invalidate the cache by setting it to `null` whenever the underlying collection is modified. Return the cached array typed as `ReadonlyArray<T>`.
