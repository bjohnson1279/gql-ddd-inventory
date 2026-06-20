1. **Apply Strict Rate Limiting to the Login Resolver:**
   - Modify `src/infrastructure/graphql/resolvers.ts` to add brute-force protection to the `login` mutation. We'll use a simple in-memory structure or map to track login attempts by email/tenant, implementing a strict limit (e.g., max 5 failed attempts per 15 minutes) to prevent credential stuffing attacks. Wait, actually, since rate-limiting per resolver in an Apollo Server can be tricky without dependencies, I'll add a rate limiting Map to track failed attempts locally. If attempts exceed the threshold, throw a specific "Too many login attempts" error.

2. **Complete Pre Commit Steps:**
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.

3. **Submit the Change:**
   - Once all tests pass, submit the change.
