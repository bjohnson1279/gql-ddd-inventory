1. Update `ILedgerRepository.ts` to add `hasAnyEntriesBatch` method definition.
2. Update `InMemoryLedgerRepository.ts` to implement `hasAnyEntriesBatch`.
3. Update `PostgresLedgerRepository.ts` to implement `hasAnyEntriesBatch`.
4. Run `pnpm exec tsc --noEmit` to verify type safety across the affected files.
5. Update `OpeningBalanceService` to use `hasAnyEntriesBatch` to avoid N+1 queries.
6. Run the full test suite using `pnpm test` to ensure no regressions.
7. Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
8. Submit the pull request.
