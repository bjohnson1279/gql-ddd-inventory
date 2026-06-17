1. **Optimize O(N^2) loops in `ManageReplenishment.ts` and `ManageStockTransfers.ts`**
   - Replace the array `itemsToSave: InventoryItem[] = []` with a `Map<string, InventoryItem>` (or `Set<InventoryItem>`) to track unique items to save.
   - Specifically, replace `itemsToSave.includes` and `itemsToSave.push` with `itemsToSave.set(item.id, item)` or `itemsToSave.add(item)`.
   - Update `this.inventoryRepo.saveBatch(itemsToSave)` to `this.inventoryRepo.saveBatch(Array.from(itemsToSave.values()))`.
   - Add comments explaining the optimization.

2. **Add pagination to `GetProductsUseCase`**
   - Update `GetProductsUseCase.execute()` to accept `limit` and `offset` arguments.
   - Update `this.productRepo.findAll()` in `GetProductsUseCase` to use the pagination arguments (e.g., `findAll({ limit, offset })` if supported, or limit it manually).
   - *Wait, checking if `productRepo.findAll` supports pagination or if I should just fix `itemsToSave.includes` which seems more straightforward without changing too many interfaces.* Let's focus on `itemsToSave` and `includes` fix which is a direct N+1 fix.

Wait, I should confirm the plan for just the `itemsToSave.includes` fix as it fits the "ONE small performance improvement" perfectly.
