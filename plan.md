# Implementation Plans

## Receive Serialized Item Use Case & E2E Testing
1. **Understand the current state**: The `ManageSerializedItems.test.ts` file already contains tests for `ReceiveSerializedItemUseCase`, but `GetSerializedItemBySerialUseCase` is currently uncovered.
2. **Add tests for `GetSerializedItemBySerialUseCase`**:
   - I will append `describe('GetSerializedItemBySerialUseCase', ...)` to `ManageSerializedItems.test.ts`.
   - The test will mock `findBySerial` on `mockSerialsRepo`.
   - It will verify the repository method is called with correctly instantiated `SerialNumber` and `TenantId`.
   - It will assert the returned item matches the mocked item.
3. **Run tests to verify coverage**: Ensure that 100% test coverage is achieved for `src/application/useCases/ManageSerializedItems.ts`.
4. **Pre-commit and Submit**: Run pre-commit checks and submit the PR.

## Kit Assembly N+1 Query Optimization
1. Add `getActiveLayersBatch` to `IInventoryCostLayerRepository.ts`. It will take a list of `variantIds` instead of a single `variantId`.
2. Implement `getActiveLayersBatch` in `PostgresInventoryCostLayerRepository.ts`. This will use a `variantId: { in: variantIds.map(id => id.value) }` Prisma query.
3. Add `saveMany` to `IInventoryCostLayerRepository.ts`.
4. Implement `saveMany` in `PostgresInventoryCostLayerRepository.ts`. This will iterate over layers or ideally do a bulk upsert but we'll stick to a transaction or loops with `Promise.all` but within Prisma transaction to batch. Prisma does not have a bulk upsert, so a transaction mapping multiple upserts or raw query is needed.
5. Add `consumeFifoLayersBatch` to `CostLayerService.ts` that takes an array of `{ variantId: ProductVariantId; quantity: number }`. It will use `getActiveLayersBatch` to fetch all layers for all components at once, calculate consumed cost per component, save layers that changed via `saveMany`, and return an object holding the breakdown for each variant.
6. Modify `AssembleKitUseCase` in `ManageKits.ts` (the specific area for the issue) to batch process all components in one go. We collect all `{ variantId: component.variantId, quantity: component.quantity * input.quantity }` into an array, call `consumeFifoLayersBatch`, and then process the ledger entries from the result. This will get rid of the N+1 problem inside the `for (const component of kit.components)` loop.

Wait, I should check `DisassembleKitUseCase` as well, but it only consumes for a single kit variant, not the components. The components get their layers *added*, so they use `save`. So the N+1 issue described in the task "N+1 query in kit component FIFO layers consumption" is strictly in `AssembleKitUseCase`.

We need to update tests and interfaces, and run full test suite.
