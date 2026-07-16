# Measured PDF Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pack Executive Summary content according to its actual Chromium-rendered height so pages are well utilized, formally framed, and free of clipping or unnecessary blank space.

**Architecture:** Overview HTML will emit one ordered flow of semantic blocks instead of pre-grouped pages. A self-contained browser-side paginator runs after `page.setContent()`, greedily moves blocks into cloned A4 page shells, measures the footer safety boundary, and splits only genuinely oversized cards or fields.

**Tech Stack:** Node.js ESM, HTML/CSS, Puppeteer DOM measurement, Node test runner, Poppler visual rendering.

## Global Constraints

- Preserve A4 landscape output, in-memory PDF generation, and the 8 MiB response limit.
- Preserve all report text and its document order.
- Keep an 8 mm minimum gap between final body content and the footer.
- Allow Priority projects, Management decisions, and Project Context to share a page when measured space permits.
- Keep ordinary cards whole; explicitly split only a card that cannot fit on an otherwise empty page.
- Retain the shared `week · date range` period in every Overview and Project page header and footer.
- Physical PDF page count must equal the number of explicit `.report-page` shells.

---

### Task 1: Emit a measurable Executive Summary flow

**Files:**
- Modify: `pdf-service/src/overview-report.js:54-170,269-272`
- Modify: `pdf-service/src/report-theme.js:188-222`
- Modify: `pdf-service/test/overview-report.test.mjs`

**Interfaces:**
- Produces: one `reportPage` with `data-measured-flow="executive-summary"` and an ordered `[data-pdf-flow-items]` container.
- Each direct flow child provides `data-page-title`, `data-page-kicker`, and `data-page-section`.
- Splittable cards provide `data-pdf-splittable`; each labelled field provides `data-pdf-field`.

- [ ] **Step 1: Write the failing flow-contract test**

```js
test('emits Executive Summary as one ordered measurable flow', () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = legacyExecutiveSummaryFixture();
  const html = renderOverviewReportHtml(fixture);

  assert.equal((html.match(/data-measured-flow="executive-summary"/g) || []).length, 1);
  assert.equal((html.match(/data-pdf-flow-item/g) || []).length, 13);
  assert.match(html, /data-flow-kind="portfolio-summary"/);
  assert.match(html, /data-flow-kind="priority-project"/);
  assert.match(html, /data-flow-kind="management-decision"/);
  assert.match(html, /data-flow-kind="project-context"/);
  assert.ok(html.indexOf('priority-project') < html.indexOf('management-decision'));
  assert.ok(html.indexOf('management-decision') < html.indexOf('project-context'));
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `node --test test/overview-report.test.mjs`

Expected: FAIL because the current renderer emits character-weighted explicit pages and no measurable-flow markers.

- [ ] **Step 3: Replace character grouping with flow-block rendering**

Add helpers shaped as follows:

```js
function flowItem({ kind, pageTitle, pageKicker, pageSection, body, splittable = false }) {
  return `<div data-pdf-flow-item data-flow-kind="${kind}" data-page-title="${escapeHtml(pageTitle)}" data-page-kicker="${escapeHtml(pageKicker)}" data-page-section="${escapeHtml(pageSection)}"${splittable ? ' data-pdf-splittable' : ''}>${body}</div>`;
}

function renderExecutiveSummaryFlow(model, brief) {
  const blocks = [];
  blocks.push(flowItem({
    kind: 'portfolio-summary', pageTitle: 'Decision Brief',
    pageKicker: 'Executive Summary - Management-ready update',
    pageSection: 'executive-summary-brief',
    body: decisionOverviewMarkup(model, brief)
  }));
  brief.priorityProjects.forEach((project, index) => blocks.push(flowItem({
    kind: 'priority-project', pageTitle: 'Decision Brief',
    pageKicker: 'Executive Summary - Management-ready update',
    pageSection: 'executive-summary-brief', splittable: true,
    body: `${index ? '' : '<h2 class="executive-brief-section-title">Priority projects</h2>'}${renderPriorityCard(project)}`
  })));
  brief.managementAsks.forEach((ask, index) => blocks.push(flowItem({
    kind: 'management-decision', pageTitle: 'Decision Brief',
    pageKicker: 'Executive Summary - Management-ready update',
    pageSection: 'executive-summary-brief', splittable: true,
    body: `${index ? '' : '<h2 class="executive-brief-section-title">Management decisions</h2>'}${renderAskCard(ask)}`
  })));
  const context = brief.projects.length ? brief.projects : [null];
  context.forEach((project, index) => blocks.push(flowItem({
    kind: 'project-context', pageTitle: 'Project Context',
    pageKicker: 'Executive Summary - Supporting detail',
    pageSection: 'executive-summary-context', splittable: Boolean(project),
    body: `${index ? '' : '<h2 class="executive-brief-section-title">Project Context</h2><p class="executive-context-intro">Supporting movement, blocker, and next-step detail for the current reporting period.</p>'}${project ? renderContextCard(project) : emptyState(brief.fallbackText || 'No project context is available.')}`
  })));
  return `<div data-pdf-flow-items>${blocks.join('')}</div>`;
}
```

Mark each `.executive-brief-field` with `data-pdf-field`, and replace `renderExecutiveSummaryPages()` with one `reportPage` carrying `data-measured-flow="executive-summary"`. Remove `contentWeight` and `chunkByWeight`.

- [ ] **Step 4: Add flow CSS and run the focused test**

```css
[data-pdf-flow-items] { display:grid; gap:3mm; }
[data-pdf-flow-item] { min-width:0; }
[data-pdf-flow-item] > :last-child { margin-bottom:0; }
[data-pdf-splittable], [data-pdf-field] { overflow-wrap:anywhere; }
```

Run: `node --test test/overview-report.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add pdf-service/src/overview-report.js pdf-service/src/report-theme.js pdf-service/test/overview-report.test.mjs
git commit -m "refactor: emit measurable summary flow"
```

### Task 2: Greedily pack measured blocks into A4 page shells

**Files:**
- Create: `pdf-service/src/measured-paginator.js`
- Modify: `pdf-service/src/pdf-renderer.js:21-32`
- Create: `pdf-service/test/measured-paginator.test.mjs`
- Modify: `pdf-service/test/pdf-layout.test.mjs`

**Interfaces:**
- Produces: `paginateMeasuredFlows({ safetyGapMm = 8, maxIterations = 1000 } = {}) => { flows: number, pages: number }`.
- Consumes: `[data-measured-flow]`, `[data-pdf-flow-items]`, and direct `[data-pdf-flow-item]` children.
- `pdf-renderer.js` calls `await page.evaluate(paginateMeasuredFlows)` after `setContent` and before `page.pdf`.

- [ ] **Step 1: Write failing real-browser packing tests**

```js
import puppeteer from 'puppeteer';

async function browserPage(html) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  return { page, browser };
}

async function measuredPages(page) {
  return page.evaluate(() => [...document.querySelectorAll('.report-page')].map(pageNode => ({
    blocks: pageNode.querySelectorAll('[data-pdf-flow-item]').length,
    bodyBottom: pageNode.querySelector('[data-pdf-flow-items]').getBoundingClientRect().bottom,
    footerTop: pageNode.querySelector('.report-footer').getBoundingClientRect().top
  })));
}

test('fills remaining page space before creating a continuation page', async () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = legacyExecutiveSummaryFixture();
  const { page, browser } = await browserPage(renderOverviewReportHtml(fixture));
  try {
    const before = await page.$$eval('.report-page', nodes => nodes.length);
    assert.equal(before, 1);
    await page.evaluate(paginateMeasuredFlows);
    const result = await measuredPages(page);
    assert.ok(result.length < 23);
    assert.ok(result.some(pageResult => pageResult.blocks >= 3));
    result.forEach(pageResult => assert.ok(pageResult.bodyBottom <= pageResult.footerTop - 30));
  } finally { await browser.close(); }
});
```

Add an exact-boundary fixture and a just-over-boundary fixture. The former remains on one page; the latter moves only its final block.

- [ ] **Step 2: Run the paginator test to verify RED**

Run: `node --test test/measured-paginator.test.mjs`

Expected: FAIL because `measured-paginator.js` does not exist.

- [ ] **Step 3: Implement the self-contained browser paginator**

```js
export function paginateMeasuredFlows({ safetyGapMm = 8, maxIterations = 1000 } = {}) {
  const pxPerMm = 96 / 25.4;
  const safetyGap = safetyGapMm * pxPerMm;
  const sources = [...document.querySelectorAll('[data-measured-flow]')];
  let pageCount = 0;

  function configurePage(page, item, continued) {
    page.dataset.reportSection = item.dataset.pageSection || 'executive-summary';
    page.querySelector('.report-kicker').textContent = item.dataset.pageKicker || 'Executive Summary';
    page.querySelector('.report-title').textContent = `${item.dataset.pageTitle || 'Executive Summary'}${continued ? ' · Continued' : ''}`;
  }

  function fits(page) {
    const items = page.querySelector('[data-pdf-flow-items]');
    const footer = page.querySelector('.report-footer');
    return items.getBoundingClientRect().bottom <= footer.getBoundingClientRect().top - safetyGap + 0.5;
  }

  sources.forEach(source => {
    const container = source.querySelector('[data-pdf-flow-items]');
    const items = [...container.children];
    const cleanShell = source.cloneNode(true);
    cleanShell.querySelector('[data-pdf-flow-items]').replaceChildren();
    container.replaceChildren();
    let current = source;
    let iterations = 0;
    const seenTitles = new Set();

    items.forEach(item => {
      if (++iterations > maxIterations) throw new Error('Measured pagination exceeded its iteration limit.');
      const target = current.querySelector('[data-pdf-flow-items]');
      if (!target.children.length) {
        const title = item.dataset.pageTitle || '';
        configurePage(current, item, seenTitles.has(title));
        seenTitles.add(title);
      }
      target.append(item);
      if (fits(current)) return;
      item.remove();
      if (!target.children.length) throw new Error('Oversized PDF flow item requires splitting.');
      current = cleanShell.cloneNode(true);
      source.parentNode.insertBefore(current, source.nextSibling);
      configurePage(current, item, seenTitles.has(item.dataset.pageTitle || ''));
      seenTitles.add(item.dataset.pageTitle || '');
      current.querySelector('[data-pdf-flow-items]').append(item);
      if (!fits(current)) throw new Error('Oversized PDF flow item requires splitting.');
    });
    pageCount += source.parentNode.querySelectorAll('.report-page').length;
  });
  return { flows: sources.length, pages: pageCount };
}
```

When inserting a new page, place it after the latest generated page, not always after the source. Preserve pages that follow the measured-flow section.

- [ ] **Step 4: Invoke the paginator from the PDF renderer**

```js
import { paginateMeasuredFlows } from './measured-paginator.js';

await page.setContent(html, { waitUntil: 'networkidle0' });
await page.evaluate(paginateMeasuredFlows);
return await page.pdf({ format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true });
```

- [ ] **Step 5: Run focused tests and commit Task 2**

Run: `node --test test/measured-paginator.test.mjs test/pdf-layout.test.mjs`

Expected: PASS; Week 28 pages are below 23 and pages contain multiple cards when measured space allows.

```bash
git add pdf-service/src/measured-paginator.js pdf-service/src/pdf-renderer.js pdf-service/test/measured-paginator.test.mjs pdf-service/test/pdf-layout.test.mjs
git commit -m "feat: pack PDF blocks by measured height"
```

### Task 3: Split genuinely oversized cards and fields

**Files:**
- Modify: `pdf-service/src/measured-paginator.js`
- Modify: `pdf-service/test/measured-paginator.test.mjs`
- Modify: `pdf-service/src/report-theme.js`

**Interfaces:**
- Adds internal `splitOversizedItem(item, shell, fits) => Element[]`.
- Card fragments retain `data-page-title`, `data-page-kicker`, and `data-page-section`.
- Field fragments repeat their label with ` · Continued`.

- [ ] **Step 1: Write failing oversized-card tests**

```js
function oversizedSummaryFixture() {
  const marker = label => `${label} ${'measured pagination content '.repeat(180)}`;
  return `WEEKLY MOVEMENT
Portfolio Summary: Oversized-card verification.
- Project: Oversized Project
  Movement: ${marker('MOVEMENT-MARKER')}
  Blocker: ${marker('BLOCKER-MARKER')}
  Next step: ${marker('NEXT-STEP-MARKER')}
MANAGEMENT ASK
- Project: Oversized Project
  Decision / Support needed: ${marker('DECISION-MARKER')}
  Business impact: ${marker('IMPACT-MARKER')}`;
}

function oversizedFieldSummaryFixture() {
  return `WEEKLY MOVEMENT
Portfolio Summary: Oversized-field verification.
- Project: One Field Project
  Movement: FIELD-START ${'single field continuation text '.repeat(500)} FIELD-END
  Blocker: None
  Next step: Confirm completion.
MANAGEMENT ASK`;
}

test('splits an oversized card between labelled fields without losing text', async () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = oversizedSummaryFixture();
  const { page, browser } = await browserPage(renderOverviewReportHtml(fixture));
  try {
    await page.evaluate(paginateMeasuredFlows);
    const text = await page.$eval('.report-document', node => node.textContent.replace(/\s+/g, ' ').trim());
    ['MOVEMENT-MARKER', 'BLOCKER-MARKER', 'NEXT-STEP-MARKER', 'DECISION-MARKER', 'IMPACT-MARKER']
      .forEach(token => assert.match(text, new RegExp(token)));
    const pages = await measuredPages(page);
    assert.ok(pages.length > 1);
    pages.forEach(result => assert.ok(result.bodyBottom <= result.footerTop - 30));
  } finally { await browser.close(); }
});

test('splits one oversized field at a word boundary', async () => {
  const fixture = completeOverviewReportFixture();
  fixture.sections = ['executive-summary'];
  fixture.week.executiveSummary = oversizedFieldSummaryFixture();
  const { page, browser } = await browserPage(renderOverviewReportHtml(fixture));
  try {
    await page.evaluate(paginateMeasuredFlows);
    assert.ok(await page.$$eval('[data-pdf-field]', nodes => nodes.length > 1));
    const text = await page.$eval('body', node => node.textContent);
    assert.match(text, /Movement · Continued/);
    assert.match(text, /FIELD-START/);
    assert.match(text, /FIELD-END/);
  } finally { await browser.close(); }
});
```

- [ ] **Step 2: Run the focused tests to verify RED**

Run: `node --test test/measured-paginator.test.mjs --test-name-pattern="oversized"`

Expected: FAIL with `Oversized PDF flow item requires splitting.`

- [ ] **Step 3: Implement field-first splitting**

```js
function fieldFragments(item) {
  const fields = [...item.querySelectorAll(':scope [data-pdf-field]')];
  if (fields.length < 2) return [];
  return fields.map((field, index) => {
    const fragment = item.cloneNode(true);
    fragment.querySelectorAll('[data-pdf-field]').forEach((node, nodeIndex) => {
      if (nodeIndex !== index) node.remove();
    });
    if (index) {
      const title = fragment.querySelector('.executive-project-title');
      if (title) title.textContent += ' · Continued';
      fragment.querySelectorAll('.executive-brief-section-title,.executive-context-intro').forEach(node => node.remove());
    }
    return fragment;
  });
}
```

Try packing consecutive fields on the same fragment before creating another fragment. If one field remains oversized, split its `<p>` text with binary search: clone the field, test the first `n` words, and retain the largest `n` for which `fits(page)` is true. The remainder becomes a new cloned field whose `<strong>` label ends in ` · Continued`.

- [ ] **Step 4: Add unbroken-token protection**

```css
[data-pdf-flow-item], [data-pdf-field] p { min-width:0; overflow-wrap:anywhere; word-break:break-word; }
```

- [ ] **Step 5: Run focused tests and commit Task 3**

Run: `node --test test/measured-paginator.test.mjs test/pdf-layout.test.mjs`

Expected: PASS with all source tokens preserved and every fragment inside the footer boundary.

```bash
git add pdf-service/src/measured-paginator.js pdf-service/src/report-theme.js pdf-service/test/measured-paginator.test.mjs
git commit -m "fix: split oversized PDF cards safely"
```

### Task 4: Scenario matrix, visual QA, and deployment

**Files:**
- Modify: `pdf-service/test/pdf-layout.test.mjs`
- Modify: `pdf-service/test/report-fixtures.mjs`
- Modify: `pdf-service/scripts/render-samples.mjs`

**Interfaces:**
- Adds `week28DenseExecutiveSummaryFixture()` and stable `executive-summary-dense.pdf` sample output.

- [ ] **Step 1: Add the full scenario matrix**

Cover compact, Week 28 legacy, mixed lengths, section transitions, empty sections, exact boundary, just-over boundary, oversized card, oversized field, long token, missing period components, full Overview, and full Project output. For every measured page assert A4 height, boundary alignment, 8 mm footer clearance, at least one flow block, and physical-page parity.

```js
assert.ok(densePages.length < 23);
assert.ok(densePages.some(page => page.blocks >= 3));
assert.equal(physicalPages, explicitPages);
assert.ok(densePages.every(page => page.footerGap >= 8 * 96 / 25.4 - 1));
```

- [ ] **Step 2: Run all PDF tests**

Run: `npm.cmd test`

Expected: all tests PASS.

- [ ] **Step 3: Render stable samples**

Update `render-samples.mjs` to write `executive-summary-dense.pdf`, then run:

`node scripts/render-samples.mjs`

Expected: each sample remains below 1.5 MiB.

- [ ] **Step 4: Render every dense-summary page to PNG and inspect**

```powershell
$pdftoppm = 'C:\Users\65881\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin\pdftoppm.exe'
& $pdftoppm -png -r 120 '..\tmp\pdf-samples\executive-summary-dense.pdf' '..\tmp\pdf-renders\executive-summary-dense'
```

Confirm no clipped text, no orphaned heading, no empty page, consistent header/footer, and visibly improved page utilization.

- [ ] **Step 5: Run frontend tests, deploy, and verify**

Run from repository root: `node --test *.test.mjs *.test.cjs`

Expected: PASS.

After explicit deployment authorization, deploy `pdf-service`, verify the new Cloud Run revision receives 100% traffic, confirm preflight 204 and unauthenticated POST 401, then push the verified commit to `v21/main`.
