## 2026-07-08 - Fixed N+1 queries in Stock Valuation Report Generation
**Learning:** The stock valuation report iteratively queried the database for layer details per variant (`getActiveLayers`), leading to a severe N+1 query bottleneck.
**Action:** Created `calculateCostBatch` on `CostLayerService` that groups variants by costing methods and hits the database once per method via `getActiveLayersBatch`, drastically reducing database load from N queries to 1.
