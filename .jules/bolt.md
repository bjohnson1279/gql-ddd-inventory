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
