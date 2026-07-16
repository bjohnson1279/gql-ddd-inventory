1. **Fix N+1 query bottleneck in `AuditProcessorService.ts`**
   - The `runAudit` method in `src/domain/services/AuditProcessorService.ts` contains an N+1 query. Inside a nested loop over `connVariantMappings` and `connLocationMappings`, it calls `await this.prisma.ledgerEntry.aggregate(...)` to get the sum of ledger quantities per variant and location.
   - We will replace this per-iteration aggregation with a single dictionary lookup. The method already aggregates all ledger entries globally just above this loop and stores them in `ledgerSumMap`.
   - I will modify lines ~138-142 to look up `ledgerSumMap.get(`${variant.id}_${locMap.internalId}`) || 0` instead of querying the database for each mapping combination.

2. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
   - Call `pre_commit_instructions` tool and complete verification checks.

3. **Submit the PR**
   - After confirming tests pass, submit a PR titled "⚡ Bolt: [performance improvement]".
