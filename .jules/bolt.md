## 2026-07-08 - Fixed N+1 queries in Stock Valuation Report Generation
**Learning:** The stock valuation report iteratively queried the database for layer details per variant (`getActiveLayers`), leading to a severe N+1 query bottleneck.
**Action:** Created `calculateCostBatch` on `CostLayerService` that groups variants by costing methods and hits the database once per method via `getActiveLayersBatch`, drastically reducing database load from N queries to 1.

## 2026-07-09 - Optimize stock valuation report item fetching
**Learning:** The stock valuation report fetched the entire inventory into memory when generating location-specific reports.
**Action:** Replaced in-memory filtering with direct database queries to fetch only the necessary inventory items.
