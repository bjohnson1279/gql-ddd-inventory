1. **Understand the current state**: The `ManageSerializedItems.test.ts` file already contains tests for `ReceiveSerializedItemUseCase`, but `GetSerializedItemBySerialUseCase` is currently uncovered.
2. **Add tests for `GetSerializedItemBySerialUseCase`**:
   - I will append `describe('GetSerializedItemBySerialUseCase', ...)` to `ManageSerializedItems.test.ts`.
   - The test will mock `findBySerial` on `mockSerialsRepo`.
   - It will verify the repository method is called with correctly instantiated `SerialNumber` and `TenantId`.
   - It will assert the returned item matches the mocked item.
3. **Run tests to verify coverage**: Ensure that 100% test coverage is achieved for `src/application/useCases/ManageSerializedItems.ts`.
4. **Pre-commit and Submit**: Run pre-commit checks and submit the PR.
