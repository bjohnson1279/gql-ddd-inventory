## 2026-06-07 - Incomplete Diff Format Causes Hunk Failures
 **Vulnerability:** Patch generation failed to properly construct a git diff with complete `-` and `+` markers, which resulted in a broken patch block and the fix not applying to the actual file.
 **Learning:** When replacing code lines manually or modifying an existing codebase for purely analytical/review-based automation constraints, always ensure the modification is correct at a source level using proper insertion or standard diff replacement techniques rather than attempting manual text formatting of diff blocks without matching context.
 **Prevention:** Use the `replace_with_git_merge_diff` tool properly by matching lines exactly, explicitly removing the old vulnerable lines in the `SEARCH` block, and writing the correct functional block in the `REPLACE` block.

## 2026-06-08 - Development Login Endpoint Exposed
 **Vulnerability:** A development-only `login` GraphQL mutation that generates a valid JWT without credential verification was active in all environments, potentially allowing critical authorization bypass in production.
 **Learning:** Mock authentication endpoints used for local development must be explicitly disabled or gated when the application is built for or run in a production environment.
 **Prevention:** Implement environment checks (`process.env.NODE_ENV === 'production'`) that throw fatal errors inside development-only handlers to prevent accidental deployment and execution.
## 2025-02-24 - GraphQL Resolver Privilege Escalation Fallback
 **Vulnerability:** The `enforceRole` helper used in GraphQL resolvers fell back to granting `admin` roles and `admin-user` identities if the `context` was empty, even outside of `test` environments. Unauthenticated requests that failed to populate the context or omitted an authorization header could easily exploit this logic to gain full administrative privileges.
 **Learning:** The authorization fallback for automated Jest tests used an OR (`||`) condition spanning `process.env.NODE_ENV === 'test'` and checks for an empty context. This effectively created an unintentional backdoor, allowing any request with an empty context to trigger the fallback regardless of the environment.
 **Prevention:** Ensure fallback authentication contexts intended for testing environments strictly rely solely on `process.env.NODE_ENV === 'test'` checks. Never include lax condition groups (like checking for empty objects or missing context) that could allow unauthenticated production requests to bypass authorization controls.
