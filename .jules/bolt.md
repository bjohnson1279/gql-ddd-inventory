## 2026-06-04 - Improve code health by extracting DomainEvent interface

 **Learning:** Extracting inline interfaces or interfaces mixed with classes (like `DomainEvent` from `OnboardingEvents.ts`) to their own dedicated files improves code health, avoids circular dependencies, and increases maintainability. The original prompt stated the file had an `any` type on the event dispatcher in `InventoryService.ts`, which might have been a confusion in the prompt as the actual issue was that `DomainEvent` was poorly located and should be cleanly refactored. The issue was solved by cleanly extracting the interface and updating all imports.

 **Action:** Extract commonly shared interfaces (like event interfaces, shared value objects) into their own files early on to prevent tightly coupling unrelated modules or causing bloated imports.
## 2026-06-05 - Avoid N+1 queries by batching domain services
 **Learning:** Calling database-backed service methods (like `decrementForSale`) inside loops (e.g. iterating over order items) leads to severe N+1 performance bottlenecks because each iteration performs an isolated lookup and save.
 **Action:** Identify loops making individual domain service calls and replace them with a unified "batch" method (e.g. `decrementForSaleBatch`) that aggregates the inputs, performs batched repository lookups (`currentQuantities`), and saves the results collectively (`appendBatch`).
## 2026-06-06 - Avoid N+1 queries when performing WMS capacity validation
 **Learning:** Iterating over SKU adjustments and calling `findBySku` for each item to compute weight and volume is a hidden N+1 query problem that hurts performance during bulk operations like submitting inventory counts.
 **Action:** Aggregate the active SKUs beforehand and use a batched repository operation (`findBySkus`) to load the product variants once into memory, creating a fast map lookup to avoid redundant database calls.
