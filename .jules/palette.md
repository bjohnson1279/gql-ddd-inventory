## 2024-05-24 - Form Input Accessibility
**Learning:** React form elements must have explicit `id` attributes that match the `htmlFor` attribute of their associated `<label>` elements to ensure screen readers can accurately associate them and to enable click-to-focus behavior.
**Action:** Always verify that `<label>` elements have `htmlFor` attributes matching the `id` of the form controls they describe.

## 2024-05-25 - Single-Purpose Tool Focus
**Learning:** Single-purpose "tool" tabs (like a Barcode Scanner or Serial Trace) should inherently grab focus on mount to save the user from redundant clicks and streamline physical workflows.
**Action:** Use `autoFocus` on the primary input field for tool-oriented views to improve operational efficiency.
