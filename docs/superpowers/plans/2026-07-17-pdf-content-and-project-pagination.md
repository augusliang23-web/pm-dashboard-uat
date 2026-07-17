# PDF Content and Project Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add permission-aware Executive milestones to Overview PDFs, render complete risk and Gantt content for every Overview project, and paginate every variable-length single-project section with repeated continuation context.

**Architecture:** The browser sends only section identifiers and an authorized Executive milestone view. The PDF service reads all report content from Firestore, normalizes audience-filtered timeline rows and complete project detail, emits semantic measured flows, and lets the existing Chromium paginator create explicit A4 continuation pages. The paginator is generalized from Executive Summary fields to list and table split units without allowing content truncation.

**Tech Stack:** Browser ES modules, Node.js ESM, Firebase Admin, Puppeteer, HTML/CSS, Node test runner, Poppler PNG rendering.

## Global Constraints

- Preserve A4 landscape output, selectable text, in-memory generation, and the 8 MiB response limit.
- Preserve the 8 mm minimum footer safety gap on every measured page.
- The browser must never send report HTML or Firestore report content.
- Backend authorization must prevent Executive milestone audience elevation.
- Every Overview and Project page must repeat the reporting week and date range in its header and footer.
- Preserve all highlights, risk/action pairs, milestones, Gantt rows, resource rows, and their stored order.
- Use TDD for every behavior: write the focused test, verify RED, implement, and verify GREEN before continuing.
- Preserve untracked `.superpowers/`, `output/`, `pdf-service/node_modules/`, and `tmp/` directories.

---

### Task 1: Add the Executive milestone request and authorization contract

**Files:**
- Modify: `index.html:1864-1895,7686-7710,7810-7845`
- Modify: `pdf-service/src/report-request.js:1-68`
- Modify: `pdf-service/src/report-access.js:1-27`
- Modify: `pdf-service/src/report-data.js:24-58`
- Modify: `pdf-service/test/report-request.test.mjs`
- Modify: `pdf-service/test/report-access.test.mjs`
- Modify: `pdf-service/test/report-data.test.mjs`
- Modify: `tests/deployment-wiring.test.mjs`

**Interfaces:**
- Produces: `executiveAudienceView` with values `leadership`, `all-working-team`, `pm-engineering`, `business-product`, or `everyone`.
- Produces: `authorizeExecutiveAudienceView(role, requestedView) => string`.
- Adds Overview section identifier: `executive-milestones`.

- [ ] **Step 1: Write failing request parsing tests**

Add to `pdf-service/test/report-request.test.mjs`:

```js
test('accepts an Executive milestone audience view only with that section', () => {
  assert.deepEqual(parseReportRequest({
    mode: 'overview', weekId: 'W28',
    sections: ['executive-milestones', 'quarterly-roadmap'],
    executiveAudienceView: 'business-product'
  }), {
    mode: 'overview', weekId: 'W28',
    sections: ['executive-milestones', 'quarterly-roadmap'],
    executiveAudienceView: 'business-product'
  });
  assert.throws(() => parseReportRequest({
    mode: 'overview', weekId: 'W28', sections: ['quarterly-roadmap'],
    executiveAudienceView: 'leadership'
  }), /requires the Executive milestones section/);
  assert.throws(() => parseReportRequest({
    mode: 'overview', weekId: 'W28', sections: ['executive-milestones'],
    executiveAudienceView: 'unrestricted'
  }), /Unsupported executiveAudienceView/);
});
```

- [ ] **Step 2: Run the request test and verify RED**

Run: `node --test test/report-request.test.mjs`

Expected: FAIL because `executive-milestones` and `executiveAudienceView` are not allow-listed.

- [ ] **Step 3: Implement request parsing**

In `report-request.js`, add `executive-milestones` to `OVERVIEW_SECTIONS`, add `executiveAudienceView` to the Overview allowed fields, validate it against:

```js
const EXECUTIVE_AUDIENCE_VIEWS = new Set([
  'leadership', 'all-working-team', 'pm-engineering', 'business-product', 'everyone'
]);
```

Reject a supplied view when the section is absent, and copy a valid view to the parsed request.

- [ ] **Step 4: Write failing role authorization tests**

Add to `pdf-service/test/report-access.test.mjs`:

```js
test('limits Executive milestone views to the authenticated role', () => {
  assert.equal(authorizeExecutiveAudienceView('vip', 'leadership'), 'leadership');
  assert.equal(authorizeExecutiveAudienceView('pm'), 'pm-engineering');
  assert.equal(authorizeExecutiveAudienceView('business', 'everyone'), 'everyone');
  assert.throws(
    () => authorizeExecutiveAudienceView('engineering', 'business-product'),
    error => error instanceof ReportAccessError && error.statusCode === 403
  );
});
```

- [ ] **Step 5: Run the access test and verify RED**

Run: `node --test test/report-access.test.mjs`

Expected: FAIL because `authorizeExecutiveAudienceView` is not exported.

- [ ] **Step 6: Implement backend audience authorization**

Export this role contract from `report-access.js`:

```js
const EXECUTIVE_VIEWS_BY_ROLE = {
  admin: ['leadership', 'all-working-team', 'pm-engineering', 'business-product', 'everyone'],
  vip: ['leadership', 'all-working-team', 'pm-engineering', 'business-product', 'everyone'],
  pm: ['pm-engineering', 'all-working-team', 'everyone'],
  engineering: ['pm-engineering', 'all-working-team', 'everyone'],
  business: ['business-product', 'all-working-team', 'everyone'],
  product: ['business-product', 'all-working-team', 'everyone']
};
```

Default to the first allowed view. Throw `ReportAccessError` with status 403 when `requestedView` is not allowed.

- [ ] **Step 7: Write and run a failing report-data propagation test**

Add an Overview request using `business@example.com`, return role `business` from the adapter, and assert:

```js
assert.equal(report.executiveAudienceView, 'business-product');
```

Run: `node --test test/report-data.test.mjs`

Expected: FAIL because the loaded report does not contain the authorized view.

- [ ] **Step 8: Propagate the authorized view from `loadAuthorizedReport`**

When `executive-milestones` is selected, call `authorizeExecutiveAudienceView(access.role, request.executiveAudienceView)` and include the returned value in the Overview report object. Do not add the field to Project reports.

- [ ] **Step 9: Write the failing picker wiring test**

Extend `tests/deployment-wiring.test.mjs` to assert:

```js
assert.ok(production.indexOf('value="executive-milestones"') < production.indexOf('value="quarterly-roadmap"'));
assert.match(production, /id="executiveMilestoneAudienceView"/);
assert.match(production, /executiveAudienceView/);
```

Run from repository root: `node --test tests/deployment-wiring.test.mjs`

Expected: FAIL because the option, selector, and request field are absent.

- [ ] **Step 10: Add the Overview picker controls**

Insert the default-checked Executive milestones checkbox immediately before Quarterly Roadmap. Add a labelled `<select id="executiveMilestoneAudienceView">` with the five agreed options. In `openOverviewPrintDialog`, populate and disable options that exceed `currentRole`. Hide the selector wrapper when the checkbox is unchecked. In `confirmOverviewPrint`, add `executiveAudienceView` only when the section is selected.

Update `OVERVIEW_PRINT_PRESETS.all`, `.roadmap`, and `OVERVIEW_REPORT_TITLES` so the new section is before Quarterly Roadmap.

- [ ] **Step 11: Run focused tests and commit**

Run:

```powershell
node --test pdf-service/test/report-request.test.mjs pdf-service/test/report-access.test.mjs pdf-service/test/report-data.test.mjs
node --test tests/deployment-wiring.test.mjs
```

Expected: all focused tests PASS.

Commit:

```powershell
git add index.html pdf-service/src/report-request.js pdf-service/src/report-access.js pdf-service/src/report-data.js pdf-service/test/report-request.test.mjs pdf-service/test/report-access.test.mjs pdf-service/test/report-data.test.mjs tests/deployment-wiring.test.mjs
git commit -m "feat: authorize Executive milestone PDF views"
```

---

### Task 2: Normalize and render Executive milestones before Quarterly Roadmap

**Files:**
- Modify: `pdf-service/src/report-model.js:303-329`
- Modify: `pdf-service/src/overview-report.js:160-179,253-260`
- Modify: `pdf-service/src/report-theme.js:188-260`
- Modify: `pdf-service/test/report-model.test.mjs`
- Modify: `pdf-service/test/overview-report.test.mjs`
- Modify: `pdf-service/test/report-fixtures.mjs`

**Interfaces:**
- Produces: `model.executiveMilestones = { title, quarters, phases, rows }`.
- Consumes: `week.strategyLayer.executiveMilestoneTimeline` and `executiveAudienceView`.
- Produces one measured flow named `executive-milestones`.

- [ ] **Step 1: Add a saved timeline fixture**

Add this shape to `completeOverviewReportFixture().week.strategyLayer`:

```js
executiveMilestoneTimeline: {
  title: '2026 Executive Timeline',
  quarters: ['Q1', 'Q2', 'Q3', 'Q4'],
  phases: ['Foundation', 'Validation', 'Scale', 'Commercialization'],
  rows: [
    { label: 'Shared delivery', audience: 'all-working-team', cells: [[{ text:'Shared Q1' }], [], [], []] },
    { label: 'Engineering', audience: 'pm-engineering', cells: [[], [{ text:'Engineering Q2' }], [], []] },
    { label: 'Commercial', audience: 'business-product', cells: [[], [], [{ text:'Commercial Q3' }], []] },
    { label: 'Leadership', audience: 'leadership-only', cells: [[], [], [], [{ text:'Leadership Q4' }]] },
    { label: 'Public', audience: 'everyone', cells: [[{ text:'Everyone Q1' }], [], [], []] }
  ]
}
```

- [ ] **Step 2: Write failing audience-filter model tests**

Build Overview models for `leadership`, `pm-engineering`, `business-product`, `all-working-team`, and `everyone`. Assert exact row labels for each view and assert outcome objects normalize to their `.text` value without exposing evidence metadata.

Run: `node --test test/report-model.test.mjs`

Expected: FAIL because `executiveMilestones` is absent.

- [ ] **Step 3: Implement Executive milestone normalization**

Add a pure normalizer that:

- Accepts only four quarter columns.
- Converts string outcomes and `{ text }` outcomes to escaped-at-render text values.
- Filters empty outcomes and empty rows.
- Applies the exact audience-view mapping from the approved design.
- Returns an empty `rows` array when no saved timeline exists.

Pass `executiveAudienceView` through `buildOverviewReportModel` and expose the normalized timeline.

- [ ] **Step 4: Write the failing Overview ordering test**

Update the full Overview section order expectation to include `executive-milestones` immediately before `quarterly-roadmap`. Assert the HTML contains `2026 Executive Timeline`, the permitted row labels, `data-measured-flow="executive-milestones"`, and no disallowed row label for a PM/Engineering view.

Run: `node --test test/overview-report.test.mjs`

Expected: FAIL because the renderer has no Executive milestone section.

- [ ] **Step 5: Render a measured Executive milestone flow**

Create `renderExecutiveMilestones(model)` in `overview-report.js`. Render each permitted category as a complete four-quarter card with its own quarter labels and phase captions so a continuation page never loses column meaning. Each category is a direct `[data-pdf-flow-item]` with:

```html
data-flow-kind="executive-milestone-category"
data-page-title="Executive Milestones"
data-page-kicker="Overview report · Leadership roadmap"
data-page-section="executive-milestones"
```

Each outcome becomes a safe split unit for Task 4. Omit the entire section when `rows` is empty. Insert the page before Quarterly Roadmap.

- [ ] **Step 6: Add matrix CSS and verify GREEN**

Add readable four-column category-grid CSS at 9.5 pt minimum body size, with distinct row label, quarter label, outcome list, and phase caption styles. Use `overflow-wrap:anywhere` and avoid fixed content heights.

Run:

```powershell
node --test test/report-model.test.mjs test/overview-report.test.mjs test/measured-paginator.test.mjs
```

Expected: all focused tests PASS.

- [ ] **Step 7: Commit Task 2**

```powershell
git add pdf-service/src/report-model.js pdf-service/src/overview-report.js pdf-service/src/report-theme.js pdf-service/test/report-model.test.mjs pdf-service/test/overview-report.test.mjs pdf-service/test/report-fixtures.mjs
git commit -m "feat: add Executive milestones to Overview PDF"
```

---

### Task 3: Expand Overview Project Portfolio with complete risks and Gantt

**Files:**
- Create: `pdf-service/src/project-visuals.js`
- Modify: `pdf-service/src/project-report.js:70-112`
- Modify: `pdf-service/src/overview-report.js:180-187,261-267`
- Modify: `pdf-service/src/report-theme.js:143-155,240-270`
- Modify: `pdf-service/test/overview-report.test.mjs`
- Modify: `pdf-service/test/project-report.test.mjs`
- Modify: `pdf-service/test/pdf-layout.test.mjs`

**Interfaces:**
- Produces: `renderGanttAxis(project)` and `renderGanttRow(workstream, range)` shared by both reports.
- Produces: one measured flow per project: `project-portfolio-${project.code}`.
- Consumes all `project.highlights`, `project.riskActions`, and `project.workstreams`.

- [ ] **Step 1: Write a failing complete-project-content test**

Give one project three highlights, three structured risk/action pairs, and twelve Gantt workstreams with unique markers. Render only `project-portfolio` and assert every marker occurs exactly once. Assert the HTML no longer describes the risk table as Primary-only and contains one measured flow for that project.

Run: `node --test test/overview-report.test.mjs --test-name-pattern="complete project"`

Expected: FAIL because the current card renders only index zero and no Gantt.

- [ ] **Step 2: Extract shared Gantt calculations and rendering**

Move ISO-date parsing, range calculation, axis markup, and row markup from `project-report.js` to `project-visuals.js`. Export a pure API:

```js
const DAY_MS = 86400000;

function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildGanttRange(workstreams) {
  const rows = workstreams.map(item => ({
    ...item,
    start: parseIsoDate(item.startDate),
    end: parseIsoDate(item.endDate)
  }));
  const scheduled = rows.filter(item => item.start && item.end && item.start <= item.end);
  const min = scheduled.length ? new Date(Math.min(...scheduled.map(item => item.start.getTime()))) : null;
  const max = scheduled.length ? new Date(Math.max(...scheduled.map(item => item.end.getTime()))) : null;
  return { rows, min, max, span: min && max ? Math.max(1, Math.round((max - min) / DAY_MS) + 1) : 1 };
}

export function renderGanttAxis({ min, max }) {
  return min && max
    ? `<div class="gantt-axis"><span>${escapeHtml(min.toISOString().slice(0, 10))}</span><span>${escapeHtml(max.toISOString().slice(0, 10))}</span></div>`
    : '';
}

export function renderGanttRow(item, range) {
  const [tone, label] = statusPresentation(item.status);
  if (!item.start || !item.end || item.start > item.end || !range.min) {
    return `<article class="gantt-row keep-together" data-pdf-split-unit><div class="gantt-label"><strong>${escapeHtml(item.name)}</strong><small>Dates not scheduled</small></div><div class="gantt-track unscheduled">${statusBadge('neutral', 'Unscheduled')}</div></article>`;
  }
  const left = Math.max(0, ((item.start - range.min) / DAY_MS / range.span) * 100);
  const width = Math.max(1.5, ((item.end - item.start) / DAY_MS + 1) / range.span * 100);
  return `<article class="gantt-row keep-together" data-pdf-split-unit><div class="gantt-label"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.startDate)} – ${escapeHtml(item.endDate)}</small></div><div class="gantt-track"><div class="gantt-bar ${tone}" style="left:${left.toFixed(2)}%;width:${Math.min(width, 100 - left).toFixed(2)}%"><span class="gantt-completed" style="width:${item.progress}%"></span><b>${escapeHtml(item.progress)}%</b></div></div><div class="gantt-state">${statusBadge(tone, label)}</div></article>`;
}
```

Keep the existing Project Gantt output test green before changing Overview behavior.

- [ ] **Step 3: Emit semantic Project Portfolio blocks**

Replace the single fixed card with direct measured-flow items in this order:

1. Identity, status, progress, and all highlights.
2. Complete ordered risk/action pairs with Primary marker retained.
3. Next milestone, resource, and budget summaries.
4. Gantt axis plus every workstream row.

Use `data-page-title="Project Portfolio"`, `data-page-context="<project name>"`, and the same per-project measured-flow name on every block. Start every project with a new source page so different projects never share a page.

- [ ] **Step 4: Add continuation context support to page headers**

Extend `reportPage` with an optional context string and render `.report-page-context` beneath the title. Extend `configurePage` in `measured-paginator.js` to copy `data-page-context` from the first item on every generated page. Keep the main title `Project Portfolio` and add `· Continued` only on continuation pages.

Write the component test before implementing this optional context parameter.

- [ ] **Step 5: Write and run the dense project pagination test**

Use Puppeteer to paginate the twelve-workstream fixture. Assert:

```js
assert.ok(pages.length > 1);
assert.ok(pages.every(page => page.context === 'Dense Project'));
assert.ok(pages.slice(1).every(page => /Continued$/.test(page.title)));
assert.ok(pages.every(page => page.footerGap >= 8 * 96 / 25.4 - 1));
```

Expected before the measured-flow implementation: FAIL because there is one overflowing fixed page.

- [ ] **Step 6: Add Portfolio layouts and verify GREEN**

Use full-width risk rows and Gantt rows with readable 9–10 pt text. Remove the fixed `min-height:147mm` dependency. Keep complete rows together and add `data-pdf-split-unit` to individual risk/action and Gantt rows.

Run:

```powershell
node --test test/overview-report.test.mjs test/project-report.test.mjs test/pdf-layout.test.mjs
```

Expected: all focused tests PASS and the dense project has correctly titled continuation pages.

- [ ] **Step 7: Commit Task 3**

```powershell
git add pdf-service/src/project-visuals.js pdf-service/src/project-report.js pdf-service/src/overview-report.js pdf-service/src/report-components.js pdf-service/src/measured-paginator.js pdf-service/src/report-theme.js pdf-service/test/overview-report.test.mjs pdf-service/test/project-report.test.mjs pdf-service/test/pdf-layout.test.mjs
git commit -m "feat: expand Overview project portfolio pages"
```

---

### Task 4: Generalize measured pagination for single-project reports

**Files:**
- Modify: `pdf-service/src/measured-paginator.js`
- Modify: `pdf-service/src/project-report.js:24-177`
- Modify: `pdf-service/src/report-theme.js:120-170`
- Modify: `pdf-service/test/measured-paginator.test.mjs`
- Modify: `pdf-service/test/project-report.test.mjs`
- Modify: `pdf-service/test/pdf-layout.test.mjs`

**Interfaces:**
- Adds: `[data-pdf-split-unit]` and `[data-pdf-repeat-on-page]` contracts.
- Produces measured flows for `project-summary`, `milestone`, `gantt`, and `resource`.
- Keeps existing `[data-pdf-field]` Executive Summary behavior compatible.

- [ ] **Step 1: Write failing generic split-unit tests**

Create a synthetic measured item containing six `<li data-pdf-split-unit>` nodes whose combined height exceeds one page. Assert the paginator creates continuation pages, preserves marker order, repeats the item heading with `· Continued`, and leaves every page above the footer boundary. Add a single oversized list item and an unbroken token case.

Run: `node --test test/measured-paginator.test.mjs --test-name-pattern="split unit"`

Expected: FAIL because only `[data-pdf-field]` is splittable.

- [ ] **Step 2: Implement generic unit fragmentation**

Refactor `splitOversizedItem` so it first finds `[data-pdf-field]`, otherwise `[data-pdf-split-unit]`. For split units:

- Clone the containing item shell.
- Pack the largest consecutive group of units that fits an empty page.
- Remove section headings from later fragments only when the page header already supplies the context.
- Append `· Continued` to `.pdf-continuation-label` on later fragments.
- Fall back to the existing word/character boundary logic only when one unit cannot fit.

Do not alter source order or discard empty-text structural units.

- [ ] **Step 3: Write failing long Project Update tests**

Create a project with 18 highlights, 14 risk entries, and 16 weekly actions. Render `project-brief` plus `project-update`, paginate it in Puppeteer, and assert:

- More than one page is created.
- Every page title contains the project name; later pages end in `· Continued`.
- Every page body begins below its header with at least 3 mm visual space.
- Every list marker appears exactly once.
- No card starts outside the page bounds.

Run: `node --test test/pdf-layout.test.mjs --test-name-pattern="Project Update continuation"`

Expected: FAIL because Project summary is not a measured flow.

- [ ] **Step 4: Convert Project summary to measured blocks**

Render the project brief as a full-width flow item. Render Highlight, Risk / Blocker, and Weekly actions as individual flow items in the existing three-column grid. Mark every list item as a split unit and every card title as `.pdf-continuation-label`. Split fragments span the full grid width for readable continuation text.

Use page title `model.name`, kicker `Project report · Executive summary`, page section `project-summary`, and the existing period in every item.

- [ ] **Step 5: Convert milestone, Gantt, and resource sections**

- Milestone: each milestone row is a direct flow item; compact three-item timelines remain one block.
- Gantt: keep `data-pdf-repeat-on-page` axis markup outside the row container so the cloned page shell repeats it; each workstream row is a split unit.
- Resources: each resource card is splittable between `<tr data-pdf-split-unit>` rows and retains `<thead>` in each fragment.
- Budget: keep the fixed block, but wrap it in a measured source so an unexpected oversize receives a continuation header instead of a browser hard break.

- [ ] **Step 6: Verify every single-project continuation**

Run:

```powershell
node --test test/measured-paginator.test.mjs test/project-report.test.mjs test/pdf-layout.test.mjs
```

Expected: all focused tests PASS; no native hard split appears in the long Project Update reproduction.

- [ ] **Step 7: Commit Task 4**

```powershell
git add pdf-service/src/measured-paginator.js pdf-service/src/project-report.js pdf-service/src/report-theme.js pdf-service/test/measured-paginator.test.mjs pdf-service/test/project-report.test.mjs pdf-service/test/pdf-layout.test.mjs
git commit -m "fix: paginate variable project PDF sections"
```

---

### Task 5: Scenario matrix, visual QA, and deployment

**Files:**
- Modify: `pdf-service/test/report-fixtures.mjs`
- Modify: `pdf-service/test/pdf-layout.test.mjs`
- Modify: `pdf-service/scripts/render-samples.mjs`

**Interfaces:**
- Adds stable samples: `overview-executive-milestones.pdf`, `overview-dense-project.pdf`, and `project-update-dense.pdf`.

- [ ] **Step 1: Complete the scenario matrix**

Cover:

- All five Executive milestone views and unauthorized elevation.
- Missing saved timeline.
- One and many Executive milestone category rows.
- Short and dense Overview projects.
- No risks, fallback unstructured risks, and multiple structured pairs.
- Scheduled, unscheduled, invalid-date, and long-name Gantt rows.
- Short and dense Project Update cards.
- Compact and long milestone collections.
- Long resource tables.
- Exact boundary, just-over boundary, oversized item, and long unbroken token.
- Full Overview and full Project physical-page parity.

For every measured page assert A4 height, at least one content block, 8 mm footer clearance, period metadata, and no ineffective blank page.

- [ ] **Step 2: Run all automated tests**

From `pdf-service`:

```powershell
npm.cmd test
```

From repository root:

```powershell
node --test *.test.mjs *.test.cjs tests/*.test.mjs
git diff --check
```

Expected: all tests PASS and `git diff --check` produces no errors.

- [ ] **Step 3: Render stable PDF samples**

Update `scripts/render-samples.mjs`, then run:

```powershell
node scripts/render-samples.mjs
```

Assert each sample is below 1.5 MiB.

- [ ] **Step 4: Render all sample pages to PNG**

Use:

```powershell
$pdftoppm = 'C:\Users\65881\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin\pdftoppm.exe'
& $pdftoppm -png -r 120 '..\tmp\pdf-samples\overview-executive-milestones.pdf' '..\tmp\pdf-renders\overview-executive-milestones'
& $pdftoppm -png -r 120 '..\tmp\pdf-samples\overview-dense-project.pdf' '..\tmp\pdf-renders\overview-dense-project'
& $pdftoppm -png -r 120 '..\tmp\pdf-samples\project-update-dense.pdf' '..\tmp\pdf-renders\project-update-dense'
```

Inspect every PNG for readable type, complete risks/Gantt rows, repeated titles and axes, header-to-card spacing, consistent footer clearance, no overlap, no clipping, and no blank page.

- [ ] **Step 5: Commit verified scenario coverage**

```powershell
git add pdf-service/test/report-fixtures.mjs pdf-service/test/pdf-layout.test.mjs pdf-service/scripts/render-samples.mjs
git commit -m "test: cover expanded PDF report scenarios"
```

- [ ] **Step 6: Deploy only after explicit authorization**

After the user approves deployment:

1. Push the verified HEAD to `v21/main`.
2. Deploy one Cloud Build image to `pm-dashboard-pdf` in `asia-southeast1`.
3. Confirm the new revision is Ready and receives 100% traffic.
4. Verify Overview preflight returns 204 and unauthenticated POST returns 401.
5. Verify the GitHub Pages URL returns 200 and report the deployed commit and revision.
