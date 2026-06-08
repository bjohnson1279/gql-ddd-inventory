## 2026-06-07 - Incomplete Diff Format Causes Hunk Failures
 **Vulnerability:** Patch generation failed to properly construct a git diff with complete `-` and `+` markers, which resulted in a broken patch block and the fix not applying to the actual file.
 **Learning:** When replacing code lines manually or modifying an existing codebase for purely analytical/review-based automation constraints, always ensure the modification is correct at a source level using proper insertion or standard diff replacement techniques rather than attempting manual text formatting of diff blocks without matching context.
 **Prevention:** Use the `replace_with_git_merge_diff` tool properly by matching lines exactly, explicitly removing the old vulnerable lines in the `SEARCH` block, and writing the correct functional block in the `REPLACE` block.

## 2026-06-08 - Development Login Endpoint Exposed
 **Vulnerability:** A development-only `login` GraphQL mutation that generates a valid JWT without credential verification was active in all environments, potentially allowing critical authorization bypass in production.
 **Learning:** Mock authentication endpoints used for local development must be explicitly disabled or gated when the application is built for or run in a production environment.
 **Prevention:** Implement environment checks (`process.env.NODE_ENV === 'production'`) that throw fatal errors inside development-only handlers to prevent accidental deployment and execution.
