## 2026-07-08 - Fixed N+1 queries in Stock Valuation Report Generation
**Learning:** The stock valuation report iteratively queried the database for layer details per variant (`getActiveLayers`), leading to a severe N+1 query bottleneck.
**Action:** Created `calculateCostBatch` on `CostLayerService` that groups variants by costing methods and hits the database once per method via `getActiveLayersBatch`, drastically reducing database load from N queries to 1.
## 2026-07-10 - Performance Optimization: Stock Valuation Memory Loading
 **Learning:** Loading the entire database into memory via `findAll` and then filtering using application logic can cause severe memory bloat and performance degradation, especially in reporting use cases. Utilizing database-level filtering (e.g., `findByLocation`) significantly reduces memory footprint and processing time.
 **Action:** Updated `GetStockValuationReportUseCase` to leverage database filtering when a `locationId` is provided.
## 2024-03-24 - Batching N+1 queries during inventory iterations
**Learning:** Found an N+1 query vulnerability when iterating over inventory items to calculate their individual stock costs, because it queries cost layers on a per-variant basis inside a loop.
**Action:** Implemented a new batch method `calculateCostBatch` to replace `calculateCost` within the loop of `GetStockValuationReportUseCase` to prevent N+1 queries. Used index tracking during batch grouping to ensure correctly mapped responses.
## 2025-02-24 - [Fix N+1 Journal Entry Creation]
 **Learning:** In the `gql-ddd-inventory` project, sequentially calling `journalService.onStockReturned` or `journalService.onInventoryWriteOff` inside a loop (like processing multiple items in an RMA) causes an N+1 performance bottleneck, as each call opens a separate `$transaction` in the `PostgresJournalRepository`.
 **Action:** Instead of persisting immediately, use the service's builder methods (e.g., `buildStockReturned`) to instantiate the `JournalEntry` objects, accumulate them in an array, and perform a single bulk insert using the batched method `journalService.saveBatch(entries)`. Ensure `IJournalRepository` and its implementers explicitly support `saveBatch`.
## 2024-03-24 - [Cache shipping rates during routing]
**Learning:** Generating all combinations of fulfillment allocations caused O(N!) redundant API calls to the rate calculator because identical allocations were re-evaluated repeatedly.
**Action:** Introduced a rate cache map keyed by locationId and quantity in OrderRoutingEngine to reuse previously calculated rates across different allocation combinations.
## 2025-02-28 - Test Validation for Missing Coverage
**Learning:** Checking coverage metrics ensures you understand exactly what parts of a use case aren’t being tested. Tests should cover happy paths (like correct creation), and invalid/edge cases (like domain validation failures during ID/SKU instantiation or handling quantities properly).
**Action:** Always check coverage and add edge cases like invalid domain primitive inputs (empty IDs, wrong SKU formats) and business logic edge cases (merging duplicate array inputs).
## 2026-07-28 - Replace any with Prisma types in repositories
**Learning:** The task requested fixing a code health issue where an `any` type was used for database records mapping in `PostgresQuarantineRepository.ts`. Since that file had already been fixed, I identified a similar issue in `PostgresRmaRepository.ts` and successfully refactored it. Using strongly typed objects in data layer mapping reduces errors and improves maintainability.
**Action:** Replaced `record: any` with `record: PrismaRma & { items: PrismaRmaItem[] }` for safer and cleaner data transformation, ensuring `mapToDomain` receives exactly what the database provides.
## 2026-07-15 - Wrap verifyPassword in try/catch to handle invalid runtime types
**Learning:** Functions dealing with buffer operations or string splitting on input parameters can crash (HTTP 500) if explicitly typed string parameters are bypassed at runtime with invalid types (e.g., null, undefined, Objects) unless protected by a try/catch.
**Action:** Always consider the real-world boundaries of explicitly typed inputs. Wrap internal parsing or buffer manipulation in a try/catch and fallback gracefully (e.g., returning false) when dealing with security utils that should simply fail on bad input.
## 2026-07-16 - Updating tests when validation changes
**Learning:** When adding or changing validation logic (like throwing Domain Errors for zero/negative quantities), ensure test files across the repository that might hit these code paths are updated to assert the new behaviors.
**Action:** Proactively search for and update corresponding test files to cover the new constraints and catch test regressions.
## 2025-03-09 - Ensure Exception String Assertions Match Source Code
**Learning:** When adding tests that assert an exact error message is thrown, ensure the expected string in `toThrow(...)` matches the *actual* source code exactly, rather than blindly copying an expected string from the prompt or issue description which might be outdated or hallucinated.
**Action:** Before committing a test that uses `toThrow('exact string')`, always `grep` or `cat` the actual source file to verify the exact wording of the thrown `Error` or use a regex `toThrow(/partial string/)` to be more resilient to minor message changes.
## 2025-02-18 - Ensure domain validation methods correctly handle missing inputs
**Learning:** When creating domain logic or Use Cases, input parameters might be bypassed at runtime leading to raw TypeErrors, which bypass graceful exception handling.
**Action:** When updating error messages or validation logic in domain models, proactively add checks for missing, null, or undefined inputs even in strictly-typed codebases, map them to application-specific domain errors (e.g. `InvalidOperationError`), and write explicitly typed runtime bypass tests using `as any`.
## 2024-11-20 - Ensure exact match for issue loop targets
**Learning:** An issue report might contain code snippets describing a bug that were partially optimized or slightly altered in the codebase prior to my run.
**Action:** Always ensure you find and directly optimize the exact vulnerability or inefficiency *if it exists exactly*. If the snippet is not found, verify if it was already fixed or if the issue description is slightly off. In this case, `createMany` for the `roles` array was already implemented, so optimizing the remaining single-role occurrences in the file was the best functional equivalent.
## 2023-10-27 - Encapsulate Dummy Hash Logic
**Learning:** Encapsulating timing attack mitigation logic (verifying dummy hashes) inside security utility functions simplifies resolver code and avoids odd module-level dummy constants.
**Action:** When refactoring auth logic to mitigate timing attacks (e.g., dummy hashes), extract the check into a `verifyPasswordSafe` utility to encapsulate the dummy hash and keep API/Resolver entry points clean.
## 2024-10-31 - Sequential API Bottlenecks in Routing Algorithms
**Learning:** In routing or matching algorithms (like `OrderRoutingEngine`), sequentially awaiting network/I/O responses within nested iterative loops evaluating plan candidates creates massive N+1 style execution delays when scaling to multiple splits.
**Action:** Always pre-calculate or collect unique network dependencies (like rates or geocodes) in a first pass, resolve them concurrently using `Promise.all()`, and then evaluate the candidates using the cached results in a synchronous second pass.
