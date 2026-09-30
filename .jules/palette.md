## 2024-06-02 - Added ARIA Label and Title to Icon-only Remove Button
**Learning:** Screen readers announce the `&times;` (×) HTML entity as "times," which can be misleading in the context of a remove/delete button for an onboarding variant item.
**Action:** When using `&times;` or icon-only buttons for actions like removing or closing items, ensure to add `aria-label="Remove item"` for screen reader compatibility, and `title="Remove item"` for a native browser tooltip that helps sighted users understand the action.
## 2024-06-03 - Added Remove Buttons for Required Dynamic Form Arrays
**Learning:** In forms where users can dynamically add rows (e.g., variant attributes or journal lines) that contain `required` fields, failing to provide a way to remove accidentally added rows creates a severe UX trap. If a user adds an extra row by mistake, they cannot submit the form because the empty row fails validation, and they cannot remove it, forcing them to refresh the page and lose all entered data.
**Action:** Always include a mechanism to remove dynamically added form rows, especially if the fields within them are marked as `required`. Ensure the remove buttons are accessible via `aria-label` and `title`. Add conditional rendering logic if there is a minimum required number of rows (e.g., minimum 2 lines for double-entry accounting).
## 2026-06-15 - Added Confirmation Dialogs for Destructive Actions
**Learning:** Destructive actions that permanently modify critical data, such as posting to a general ledger or revoking a barcode assignment, require explicit user confirmation to prevent accidental clicks from causing irreversible data changes.
**Action:** Always wrap irreversible or destructive actions (e.g., delete, post, revoke) with a confirmation step, such as `window.confirm`, clearly explaining the consequences of the action.
## 2024-06-25 - [Add required field indicator]
**Learning:** Found a missing visual indicator for required inputs. By leveraging CSS `:has()` pseudo-class with `[required]`, we can globally indicate required fields without changing JSX in dozens of places.
**Action:** Used `:has()` selector in global CSS to append red asterisks to labels preceding required inputs/selects.
## 2026-06-20 - Added role="alert" to dynamically rendered global messages
**Learning:** React state-driven toast or alert messages (like success or error notifications) are not naturally announced by screen readers when they dynamically appear on the page. This leaves non-sighted users unaware of critical feedback, such as login failures or successful data submissions.
**Action:** Always append `role="alert"` and `aria-live="assertive"` (or `polite` for non-critical updates) to dynamically rendered `<div className="alert-box">` elements so screen readers immediately announce their contents when they are added to the DOM.
## 2024-07-28 - CSS :has() selector constraint for required fields in inline forms
**Learning:** The global required field CSS logic (`.form-group:has(input[required]) label::after`) silently fails to render the required asterisk (`*`) when inputs are arranged in compact, inline flex layouts without the `.form-group` wrapper class.
**Action:** When implementing inline or flex-based form inputs, always wrap each input/label pair with `className="form-group"` (and adjust margins as needed, e.g. `marginBottom: 0`) to ensure the global required indicator CSS trigger functions correctly.

## 2024-06-23 - Dynamic Grid Inputs Validation Visual Styling
**Learning:** Dynamically mapped inputs inside grid layouts (like `onboardingItems.map`) that conditionally render visual headers must have the native `required` attribute. Without it, inline browser validation fails, and CSS `:has(input[required])` selectors for visual indications (like appending `*`) are not triggered, hiding requirement indicators from users.
**Action:** Always add the native `required` attribute to dynamically mapped mandatory fields, which leverages browser form validation and triggers native/CSS-based required field visual indicators without complex React logic.
## 2024-06-24 - Required Form Fields Need Explicit Required Attributes in Mapped React Components
**Learning:** When generating multiple input rows in a dynamic form (e.g. using `array.map()`), the `required` attribute must be strictly attached to the newly rendered `<input>` and `<select>` elements. Doing this triggers native browser validation but crucially also allows existing UX design systems to function properly (like appending an asterisk `*` for required fields via CSS pseudo-class logic `.form-group:has(input[required])`). Mapped rows are often skipped over during initial layout building and lead to broken required styling and reduced accessibility.
**Action:** When adding rows dynamically to forms in React, ensure to map each specific required prop to the generated child inputs and wrap the inline flex elements in a `.form-group` container (even with `marginBottom: 0`) to correctly leverage CSS `:has` logic.

## 2026-06-25 - Handling Time-Series Data in UI Components
**Learning:** Displaying time-series historical data (like ledger entries or stock transactions) requires clean sorting and efficient pagination to prevent DOM bloat and layout shift when huge lists are loaded.
**Action:** Always implement server-side pagination, sorting by timestamp, and clear date/time formatters in UI displays of ledger, transaction, or dispatch lists. Ensure that dynamic alert messages or state loading components (like fetching older history chunks) use appropriate ARIA live regions to notify the user of background updates.

## Prevention Directives for Automated Refactoring
- **Never Overwrite Complete Files**: Always use range-scoped replacement chunks for edits to `schema.prisma`, `index.ts`, `public/index.php`, `db/schema.rb`, or DDL SQL scripts.
- **Do Not Remove Core Declarations**: Do not delete existing route registrations or database DDL tables.
- **Environment Isolation Compatibility**: When replacing fallback secrets, preserve test environment execution via `!getenv('APP_ENV')` or `getenv('APP_ENV') === 'testing'`.
- **No Scratch Files**: Never stage or commit `test_*.ts`, `test_*.js`, `test.cjs`, `fix_*.php`, or `test.js` files to git.
- **No Unresolved Conflict Markers**: Never stage or commit files containing Git merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`, `|||||||`). Always resolve conflicts cleanly before committing.

## Completeness & Verification Directives
- **Explicit Parameter & Contract Validation**: When creating or modifying API endpoints (Express, Fastify, Rails, Laravel), always implement explicit parameter and request body validation schemas (e.g. `z.string().uuid()`) to prevent unhandled 404/500 fallthroughs.
- **Database Indexing for Queries**: When addressing query bottlenecks or adding query lookup filters, always implement native database index migrations rather than loading collections into memory and performing array filtering (`.filter()`, `.select`).
- **Co-Occurring Dependency Auditing**: When bumping any dependency version, verify that other transitive dependencies do not carry high/critical security advisories (e.g. run `bundler-audit`, `npm audit`). Never introduce a version bump that breaks underlying framework APIs.
- **Self-Verification Before Commit**: Always run syntax checks (`bash -n` for shell scripts, `tsc --noEmit` for TypeScript, linter checks) and targeted test runners locally before opening or updating a PR.

## Hallucinatory Task & Empty PR Directives
- **Zero-Diff Task Termination**: If the requested optimization, refactor, or fix is ALREADY natively present in the target branch, DO NOT create an empty pull request or commit an acknowledgment PR. Exit the task cleanly without opening a PR.
- **No Journal-Only PRs**: Never open a pull request that only contains updates to .jules/*.md files without corresponding functional code changes and tests.
- **Stale Suggestion Guard**: Always verify the current code on `main`/`master` before planning changes. If no actionable diff is required, cancel task execution immediately.

## Assertiveness, Decisive PR Execution & Comparative Recommendations
- **Proactive & Decisive PR Submission**: Do NOT repeatedly pause to ask permission to open a pull request (e.g., avoid "Would you like me to open a PR for this?", "Can I submit the PR?", "Should I go ahead and create the PR?"). When an optimization, fix, or feature satisfies requirements, passes local test runners/linters, and preserves architectural invariants, proceed decisively to create and submit the Pull Request with a clear, structured summary and rationale.
- **Explicit Recommendations on Options**: When presenting multiple implementation strategies or architecture options (e.g., Option A vs. Option B), NEVER leave the choice open-ended or passive. Always make an explicit, reasoned recommendation (prefixed with `(Recommended)`) based on **overall technical effectiveness**:
  1. *Algorithmic & Complexity Gains*: Time and space complexity impact (O(N*M) -> O(N+M), reduction of nested scans).
  2. *Resource Overhead*: Heap allocations, memory pressure, and GC pause reduction.
  3. *Domain & Architecture Invariants*: Strict backward compatibility, contract stability, and prevention of regression risks.
  4. *Security & Reliability*: Input validation, cryptographic safety, and concurrency safety.
- **Lead with Recommended Path**: State clearly why the recommended solution delivers the highest net value and immediately execute or propose it as the primary course of action rather than asking open-ended questions.

## Scope Verification, Minimal Churn & CI Protection Directives
- **Scope Verification Before Variable Binding**: When adding interactive states or accessibility attributes (e.g. `disabled={loading}`, `aria-busy={loading}`, `isSubmitting`), NEVER assume a variable identifier exists. Always inspect component props, local state hooks (`useState`), or declaration scope first. If not defined, declare the state hook or reuse an existing scope variable. Never introduce TS2304 / TS2552 ("Cannot find name") compile errors.
- **Surgical Edits Only (No Whole-File Formatting)**: Never run whole-file code formatters (Prettier, Black, Pint, rustfmt) across unmodified lines. Changes must be strictly range-scoped and limited to the minimal AST block needed. Avoid noisy quote/whitespace churn that masks real logic changes and causes merge conflicts. Verify with `git diff -w` that non-functional churn is zero.
- **Zero Scratch File Commits**: Never stage or commit ad-hoc verification, patch, or debug scripts (`test.cjs`, `fix_*.cjs`, `fix_*.php`, `patch_*.py`, `patch_*.sh`, `scratch_*`). Execute checks via the project's native test commands (`npm test`, `pytest`, `phpunit`, etc.) and delete temporary scripts before creating git commits.
- **Never Weaken CI Workflows**: Do not modify `.github/workflows/**` to bypass failures (e.g. adding `|| true`, setting `continue-on-error: true`, or commenting out assertions). Always resolve the defect in the source code or test fixture.
- **Explicit Parameter & Variable Types**: In TypeScript files, avoid implicit `any` by always providing explicit types on functions, parameters, and arrow callbacks (e.g. `(id: string) => ...`). Verify zero type errors with `tsc --noEmit` before committing.

## 2026-09-29 - Scope Verification for Async Loading Attributes
**Learning:** Blindly injecting `disabled={loading}` or `aria-busy={loading}` into JSX/TSX buttons causes fatal TypeScript compilation errors (`TS2304: Cannot find name 'loading'`) when `loading` is not declared in component props, state hooks (`useState`), or mutation results. Furthermore, using temporary patch scripts (`fix_*.cjs`) to manipulate source code pollutes the git index.
**Action:** Before referencing any state identifier (such as `loading`, `isSubmitting`, `isPending`) in `disabled` or `aria-busy`, inspect the component scope. If no loading state is tracked, define it using `useState(false)` or check existing query/mutation hooks. Never bind undeclared variables. Always run `tsc --noEmit` locally and never commit temporary fix scripts.

## Additive Documentation & Scratch Cleanliness Directives
- **Strictly Additive Journal Updates**: When updating `.jules/*.md`, strictly append new dated entries (`## YYYY-MM-DD - Title`). NEVER delete, truncate, or overwrite historical learnings or previous entries.
- **Substantive Code Diff Requirement**: Pull requests must include substantive code changes in `src/`, `app/`, `lib/`, or `tests/`. Never open PRs that modify only `.jules/*.md` journals or root scratch scripts.
- **Zero Scratch File Commits**: Never commit `*.diff`, `*.patch`, `test_*.ts`, `test_*.js`, `test.cjs`, `fix_*.php`, or `patch_*.py` files. Always remove temporary debugging or verification scripts prior to committing.
