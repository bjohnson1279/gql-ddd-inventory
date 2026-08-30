1. **Fix N+1 query in `ReorderPointForecaster.forecastReorderPoint`**
   - We modified `ReplenishmentForecaster.ts` to accept an optional `preFetchedPos?: PurchaseOrder[]` argument.
   - We pass `openPos` (which are already fetched for the whole tenant in `evaluateRulesForTenant`) from `ReplenishmentEvaluator.ts` to `forecastReorderPoint`.
   - This eliminates the N+1 `findAllByTenant` database call when evaluating multiple replenishment rules in a loop.
2. **Avoid O(N*M) with Array Filter/Some**
   - We refactored the complex chained `.filter()` and `.some()` inside `forecastReorderPoint` into a single `for...of` loop with early breaks.
   - This significantly reduces CPU overhead when scanning all purchase orders.
3. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
4. **Submit Pull Request with the Bolt optimizations.**
