## 2026-07-08 - Fixed N+1 queries in Stock Valuation Report Generation
**Learning:** The stock valuation report iteratively queried the database for layer details per variant (`getActiveLayers`), leading to a severe N+1 query bottleneck.
**Action:** Created `calculateCostBatch` on `CostLayerService` that groups variants by costing methods and hits the database once per method via `getActiveLayersBatch`, drastically reducing database load from N queries to 1.

## 2026-07-10 - Performance Optimization: Stock Valuation Memory Loading
**Learning:** Loading the entire database into memory via `findAll` and then filtering using application logic can cause severe memory bloat and performance degradation, especially in reporting use cases. Utilizing database-level filtering (e.g., `findByLocation`) significantly reduces memory footprint and processing time.
**Action:** Updated `GetStockValuationReportUseCase` to leverage database filtering when a `locationId` is provided.
