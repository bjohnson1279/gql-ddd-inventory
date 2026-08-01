## 2024-05-18 - Nested Lookup Bottlenecks in Strategy Generation
**Learning:** `activeCandidates.find` inside deeply nested `generatePlans` combinations scales CPU usage exponentially in `OrderRoutingEngine`, leading to O(N*M) CPU hangs for large orders.
**Action:** Always pre-compute invariant candidate lookups and distances into O(1) `Map`s before invoking looping mechanisms in routing/strategy calculations.
## 2024-05-24 - O(N*M) Lookup Bottlenecks in Fallback Algorithms
**Learning:** Using `Array.find()` inside loops across large datasets (e.g., `stockLevels` mapped against `forecasts` in `RebalanceOptimizationService.basicFallback`) creates O(N*M) performance bottlenecks that hang execution with thousands of SKUs.
**Action:** Always pre-compute composite keys (e.g., `${warehouse_id}\0${sku}`) into an O(1) `Map` before iterating over large datasets to reduce time complexity to O(N+M).
