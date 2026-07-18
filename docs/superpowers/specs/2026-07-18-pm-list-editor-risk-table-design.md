# PM List Editor and Risk Pair Preview Design

## Context

The production v2.1 dashboard at commit `6c7868d` treats each newline in the Project Editor narrative fields as a separate bullet, but the editor does not show that structure or support nested items. The Risk / Blocker and Required Action textareas can also be resized horizontally, which can break the two-column row layout. In Single Project preview, risks and actions render as two independent lists, so users cannot reliably see which action belongs to which risk.

This change improves those three behaviors without changing Firestore field names, project permissions, release locking, or the existing Risk/Action pair identity model.

## Scope

The list editor applies to every visible multiline field inside the Project Editor:

- Highlight
- Weekly Key Actions
- Each Risk / Blocker field
- Each Required Action field

Readonly Copilot fields, Weekly Summary fields, Executive milestone reason fields, and other dialogs are outside this scope.

The Single Project preview change applies to the narrative section currently rendered through `pd_risk` and `pd_next`. Overview tables, One-page Status, and PDF layout redesigns are outside this scope, except for compatibility changes needed to prevent duplicate list markers in generated PDFs.

## Chosen Approach

Use an enhanced textarea list editor instead of `contenteditable` or one-input-per-item rows. Each textarea keeps plain-text storage while a compact toolbar and keyboard handlers provide Word/Outlook-like list behavior. This approach preserves browser-native selection, paste, undo, vertical resizing, and existing Firestore strings while making the list structure visible.

Create a focused ES module for parsing, normalizing, editing, and rendering list text. The dashboard binds that module to the four Project Editor field types and continues collecting string values through the existing save flow.

## List Text Format

Store list structure in the existing string fields with explicit line prefixes:

```text
• First item
  • Child item
  1. Numbered child
• Second item
```

Rules:

- Two leading spaces represent one indentation level.
- Unordered items use `• ` as their stored prefix.
- Ordered items use an integer followed by `. `.
- A normalized document has no blank trailing items, no indentation jump greater than one level, and ordered items numbered sequentially within each adjacent level-specific ordered block.
- Existing nonempty lines without a recognized marker load as level-zero unordered items.
- Existing empty content remains empty and does not gain a synthetic item until the user starts a list or enters text.
- Saving normalizes markers, indentation, numbering, and trailing whitespace while preserving item text.

No Firestore migration is required. Existing project fields remain `highlight`, `weeklyActions`, `risk`, `next`, and `riskActions[].risk` / `riskActions[].action`.

## Editor Controls and Keyboard Behavior

Every in-scope textarea receives a visible compact toolbar containing:

1. Bulleted list
2. Numbered list
3. Decrease indent
4. Increase indent

The controls act on every line touched by the current selection. Buttons include visible active state where the selection has one list type, `title` text, and accessible names. A concise hint below each editor reads `Enter: new item · Tab: sub-item · Shift+Tab: move up`.

Keyboard behavior:

- Enter after a nonempty list item creates the next item with the same type and indentation.
- Enter in the middle of an item splits it and applies the same marker to the new item.
- Enter on an empty list item removes that marker and promotes the cursor one level. At level zero it exits the list and leaves an unmarked blank line.
- Tab indents the current line or selected lines by one level, limited to one level deeper than the nearest preceding nonempty item.
- Shift+Tab outdents the current line or selected lines by one level and never produces negative indentation.
- Bulleted list converts selected lines to unordered items without changing their indentation or text.
- Numbered list converts selected lines to ordered items and renumbers the affected ordered blocks.
- Clicking an already-active list type removes the list marker from the selected lines while retaining their text.
- Pasting multiline plain text inside an existing item gives each additional nonempty line the current item type and indentation, then normalizes numbering.
- All edits preserve the textarea selection as closely as possible and dispatch an `input` event so existing dirty-state and preview listeners continue to work.

## Risk / Action Editor Layout

Both Risk / Blocker and Required Action textareas use `width: 100%`, `min-width: 0`, and `resize: vertical`. Horizontal resizing is disabled. Each textarea can be vertically resized independently.

The Risk/Action row remains a CSS grid. Its items align to the start and the row height is determined by its tallest content. Increasing either textarea height therefore increases the parent row height and moves every following row downward without overlap. Toolbar and hint elements live within each grid cell so they participate in the same layout calculation.

At narrow viewport widths, the row may use the dashboard's existing responsive column treatment, but controls and delete actions must not overlap editable content.

## Single Project Risk / Action Preview

Replace the independent `Risk / Blocker` and `Risk Required Actions` blocks with one semantic table:

| Risk / Blocker | Required Action |
| --- | --- |
| Paired risk content | Its paired action content |

Rendering rules:

- Use normalized `riskActions` / `riskPairs` when available.
- Preserve the existing fallback that pairs legacy `risk` and `next` lines by index.
- Sort the Primary pair first without mutating the saved project.
- Display a compact `Primary` badge in the Risk cell of the Primary row.
- Render list markers and indentation as nested semantic `<ul>` and `<ol>` elements inside each cell.
- Escape all item text before adding it to generated HTML.
- Preserve an empty side of an asymmetric pair with an em dash rather than shifting later content into that cell.
- If no pair exists, render one full-width empty-state row: `No active risk/action reported.`
- Keep the two-column relationship on narrow screens. The table wrapper may scroll horizontally instead of separating risks from actions.

## PDF and Legacy Consumer Compatibility

PDF report normalization currently splits narrative strings on newlines. Update its line cleanup to recognize the stored unordered, ordered, and indentation prefixes before it creates PDF list items. The report therefore continues to render one bullet per logical item without showing duplicate `•` or `1.` markers.

PDF hierarchy redesign is not part of this change. Nested items may be flattened in generated PDFs, but their text and order must remain intact. Existing unmarked strings and arrays must continue to normalize exactly as before.

## Code Boundaries

- `js/list-editor.mjs`: pure list parsing, normalization, selection transforms, numbering, and safe nested-list HTML generation.
- `index.html`: editor toolbar markup/styles, field binding, save integration, Risk/Action resize rules, and Single Project table container/rendering.
- `pdf-service/src/report-model.js`: marker-aware plain line normalization for PDF consumers.
- `tests/list-editor.test.mjs`: behavioral tests for parsing, normalization, keyboard transforms, selected-line transforms, and escaped nested HTML.
- `tests/project-list-editor-ui.test.mjs`: source-level wiring, accessibility, resize, and Single Project table contracts.
- `pdf-service/test/report-model.test.mjs`: regression coverage that list prefixes do not leak into PDF model list items.

The `team-2` dashboard is not changed because the requested online v2.1 entry point is the root dashboard at `6c7868d`.

## Validation and Error Handling

- Empty and whitespace-only editor values save as empty strings.
- Malformed or excessive indentation is clamped during normalization rather than rejected.
- Unknown line prefixes are treated as item text, preventing data loss.
- List rendering escapes `<`, `>`, `&`, and quotes in user content.
- Missing or partially populated Risk/Action rows retain their pairing and display an em dash for the missing side.
- Existing project authorization, released-week mutation guards, stable row IDs, and transactional save logic remain unchanged.

## Test and Browser Verification

Automated verification covers:

- Legacy plain lines loading as level-zero bullets.
- Empty content remaining empty.
- Enter continuation, split, empty-item exit, Tab, and Shift+Tab.
- Multiline selection conversion, indentation, outdent, and ordered-list renumbering.
- Multiline paste normalization.
- Safe nested `<ul>` / `<ol>` rendering and hostile text escaping.
- All four Project Editor field types receiving toolbar behavior.
- Both Risk and Action textareas using vertical-only resize and width containment.
- Single Project rendering one row per pair, sorting and labelling Primary, preserving asymmetric pairs, and showing the empty state.
- PDF model output removing stored list markers without dropping item text.

Browser verification covers desktop and narrow viewport Project Editor behavior, mouse vertical resizing, row reflow, keyboard interaction, paste, save/reopen compatibility, and the Single Project paired table.

The accepted baseline exception is the pre-existing `team-2/trend-summary.test.cjs` failure. Completion requires every new and directly related test to pass, the root dashboard suite to pass, the PDF service suite to pass, and no new failures beyond that recorded baseline exception.
