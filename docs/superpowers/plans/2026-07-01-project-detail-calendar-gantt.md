# Project Detail Calendar Gantt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebalance the Single Project page, move all post-milestone content below the Gantt, and replace the ambiguous fixed Gantt grid with an aligned weekly/monthly calendar axis.

**Architecture:** Add a pure UTC calendar-axis builder to `portfolio-core.mjs` and keep page composition/rendering in `team-2/index.html`. The Gantt header and every workstream row consume the same axis positions, so labels, lines, bars, milestones, and Today share one coordinate system.

**Tech Stack:** Static HTML/CSS/JavaScript, ES modules, Node.js built-in test runner.

---

### Task 1: Build the pure calendar-axis model

**Files:**
- Modify: `team-2/js/portfolio-core.mjs`
- Modify: `tests/portfolio-core.test.mjs`

- [ ] **Step 1: Write failing weekly and monthly axis tests**

Add `buildGanttCalendarAxis` to the import list in `tests/portfolio-core.test.mjs`, then append:

```js
test('weekly Gantt axis aligns to Mondays and groups labelled ISO weeks by month', () => {
  const axis = buildGanttCalendarAxis(
    new Date(Date.UTC(2026, 5, 30)),
    new Date(Date.UTC(2026, 6, 15)),
    'week',
  );

  assert.equal(axis.axisStart.toISOString(), '2026-06-29T00:00:00.000Z');
  assert.equal(axis.axisEnd.toISOString(), '2026-07-20T00:00:00.000Z');
  assert.deepEqual(axis.ticks.map(tick => tick.label), [
    'W27 · Jun 29',
    'W28 · Jul 6',
    'W29 · Jul 13',
  ]);
  assert.deepEqual(axis.groups.map(group => ({
    label: group.label,
    span: group.span,
  })), [
    { label: 'Jun 2026', span: 1 },
    { label: 'Jul 2026', span: 2 },
  ]);
  assert.equal(axis.guidance, 'Each grid column represents one calendar week.');
  assert.equal(axis.rangeLabel, 'Jun 30, 2026 – Jul 15, 2026');
});

test('weekly Gantt axis uses the correct ISO week across a year boundary', () => {
  const axis = buildGanttCalendarAxis(
    new Date(Date.UTC(2025, 11, 29)),
    new Date(Date.UTC(2026, 0, 4)),
    'week',
  );

  assert.equal(axis.ticks[0].label, 'W01 · Dec 29');
});

test('monthly Gantt axis aligns to month boundaries and groups months by year', () => {
  const axis = buildGanttCalendarAxis(
    new Date(Date.UTC(2026, 10, 18)),
    new Date(Date.UTC(2027, 1, 3)),
    'month',
  );

  assert.equal(axis.axisStart.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(axis.axisEnd.toISOString(), '2027-03-01T00:00:00.000Z');
  assert.deepEqual(axis.ticks.map(tick => tick.label), ['Nov', 'Dec', 'Jan', 'Feb']);
  assert.deepEqual(axis.groups.map(group => ({
    label: group.label,
    span: group.span,
  })), [
    { label: '2026', span: 2 },
    { label: '2027', span: 2 },
  ]);
  assert.equal(axis.guidance, 'Each grid column represents one calendar month.');
});

test('Gantt calendar axis rejects invalid or reversed ranges', () => {
  assert.equal(buildGanttCalendarAxis(new Date('invalid'), new Date(), 'week'), null);
  assert.equal(buildGanttCalendarAxis(
    new Date(Date.UTC(2026, 1, 1)),
    new Date(Date.UTC(2026, 0, 1)),
    'month',
  ), null);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
$node = 'C:\Users\65881\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $node --test tests/portfolio-core.test.mjs
```

Expected: FAIL because `buildGanttCalendarAxis` is not exported.

- [ ] **Step 3: Implement UTC calendar boundaries, labels, and groups**

Add to `team-2/js/portfolio-core.mjs`:

```js
const CALENDAR_DAY_MS = 86400000;
const CALENDAR_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function utcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function utcWeekStart(date) {
  const value = utcDay(date);
  const mondayOffset = (value.getUTCDay() + 6) % 7;
  value.setUTCDate(value.getUTCDate() - mondayOffset);
  return value;
}

function utcMonthStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addUtcDays(date, days) {
  return new Date(date.getTime() + days * CALENDAR_DAY_MS);
}

function addUtcMonths(date, months) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function isoWeekNumber(date) {
  const thursday = utcDay(date);
  thursday.setUTCDate(thursday.getUTCDate() + 3 - ((thursday.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7),
  );
  return 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * CALENDAR_DAY_MS));
}

function calendarDateLabel(date, includeYear = false) {
  const month = CALENDAR_MONTHS[date.getUTCMonth()];
  return includeYear
    ? `${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
    : `${month} ${date.getUTCDate()}`;
}

function groupCalendarTicks(ticks, axisEnd, keyForTick, labelForTick) {
  const groups = [];
  ticks.forEach((tick, index) => {
    const key = keyForTick(tick.date);
    const end = ticks[index + 1]?.date || axisEnd;
    const current = groups.at(-1);
    if (current?.key === key) {
      current.end = end;
      current.span += 1;
      return;
    }
    groups.push({
      key,
      label: labelForTick(tick.date),
      start: tick.date,
      end,
      span: 1,
    });
  });
  return groups;
}

export function buildGanttCalendarAxis(start, end, scale = 'month') {
  if (!(start instanceof Date) || !(end instanceof Date)
    || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())
    || start > end) return null;

  const actualStart = utcDay(start);
  const actualEnd = utcDay(end);
  const normalizedScale = scale === 'week' ? 'week' : 'month';
  const axisStart = normalizedScale === 'week'
    ? utcWeekStart(actualStart)
    : utcMonthStart(actualStart);
  const finalIntervalStart = normalizedScale === 'week'
    ? utcWeekStart(actualEnd)
    : utcMonthStart(actualEnd);
  const axisEnd = normalizedScale === 'week'
    ? addUtcDays(finalIntervalStart, 7)
    : addUtcMonths(finalIntervalStart, 1);
  const ticks = [];

  for (
    let cursor = new Date(axisStart);
    cursor < axisEnd;
    cursor = normalizedScale === 'week' ? addUtcDays(cursor, 7) : addUtcMonths(cursor, 1)
  ) {
    ticks.push({
      date: cursor,
      label: normalizedScale === 'week'
        ? `W${String(isoWeekNumber(cursor)).padStart(2, '0')} · ${calendarDateLabel(cursor)}`
        : CALENDAR_MONTHS[cursor.getUTCMonth()],
    });
  }

  const groups = normalizedScale === 'week'
    ? groupCalendarTicks(
      ticks,
      axisEnd,
      date => `${date.getUTCFullYear()}-${date.getUTCMonth()}`,
      date => `${CALENDAR_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`,
    )
    : groupCalendarTicks(
      ticks,
      axisEnd,
      date => String(date.getUTCFullYear()),
      date => String(date.getUTCFullYear()),
    );

  return {
    scale: normalizedScale,
    actualStart,
    actualEnd,
    axisStart,
    axisEnd,
    ticks,
    groups,
    guidance: normalizedScale === 'week'
      ? 'Each grid column represents one calendar week.'
      : 'Each grid column represents one calendar month.',
    rangeLabel: `${calendarDateLabel(actualStart, true)} – ${calendarDateLabel(actualEnd, true)}`,
  };
}
```

- [ ] **Step 4: Run the focused test and verify pass**

Run:

```powershell
& $node --test tests/portfolio-core.test.mjs
```

Expected: all `portfolio-core.test.mjs` tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- team-2/js/portfolio-core.mjs tests/portfolio-core.test.mjs
git commit -m "feat: build aligned Gantt calendar axes"
```

### Task 2: Recompose the Single Project detail layout

**Files:**
- Modify: `team-2/index.html`
- Create: `tests/project-detail-calendar-gantt.test.mjs`

- [ ] **Step 1: Write failing source-structure tests**

Create `tests/project-detail-calendar-gantt.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../team-2/index.html', import.meta.url), 'utf8');
const detailStart = html.indexOf('<div class="overlay" id="projDetailOverlay">');
const detailEnd = html.indexOf('<div class="overlay" id="onePageStatusModal"', detailStart);
const detail = html.slice(detailStart, detailEnd);

test('Single Project header removes the One-page Status entry point', () => {
  assert.ok(detailStart >= 0 && detailEnd > detailStart);
  assert.doesNotMatch(detail, /One-page Status/);
  assert.match(detail, /aria-label="Close project detail"/);
});

test('Single Project upper grid gives narrative two-thirds and Milestone one-third', () => {
  assert.match(
    html,
    /\.detail-grid\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*minmax\(0,\s*2fr\)\s+minmax\(280px,\s*1fr\)/,
  );
  assert.match(
    html,
    /@media\s*\(max-width:\s*1100px\)[\s\S]*?\.detail-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  );
});

test('post-milestone sections follow the approved full-width order', () => {
  const milestone = detail.indexOf('id="pd_milestones"');
  const schedule = detail.indexOf('id="pd_schedule"');
  const quarters = detail.indexOf('id="pd_quarterly_milestones"');
  const resources = detail.indexOf('id="pd_resources"');
  const team = detail.indexOf('id="pd_team_effort"');
  const budget = detail.indexOf('id="pd_budget_snapshot"');

  assert.ok(milestone >= 0);
  assert.ok(milestone < schedule);
  assert.ok(schedule < quarters);
  assert.ok(quarters < resources);
  assert.ok(resources < team);
  assert.ok(team < budget);
  assert.match(detail, /detail-full-width detail-resources-section/);
  assert.match(detail, /detail-full-width detail-resource-summary-section/);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
& $node --test tests/project-detail-calendar-gantt.test.mjs
```

Expected: FAIL because the header still has One-page Status, the grid is not 2:1, and Resources is above the Gantt.

- [ ] **Step 3: Remove the One-page Status header button**

Change the detail header controls to:

```html
<div class="modal-hdr">
  <h3 id="pd_title" style="font-size:22px; color:var(--text);">Project Name</h3>
  <button class="modal-x" aria-label="Close project detail" onclick="closeModal('projDetailOverlay')">×</button>
</div>
```

Do not remove the existing One-page modal implementation in this task; only remove its Single Project entry point.

- [ ] **Step 4: Set the upper grid to a 2:1 ratio**

Replace the desktop grid declaration with:

```css
.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 32px;
}
```

Keep the existing `max-width: 1100px` one-column rule.

- [ ] **Step 5: Move Resources and summaries below Quarterly Milestones**

Leave only RAG, Progress, and `pd_milestones` in `.detail-right`. After the existing Quarterly Milestones section add:

```html
<section class="detail-full-width detail-resources-section">
  <div class="info-lbl" style="margin-bottom:12px;">Resources</div>
  <div id="pd_resources"></div>
</section>
<section class="detail-full-width detail-resource-summary-section">
  <div class="detail-rb-grid">
    <div class="detail-rb-box">
      <div class="info-lbl">Team & Effort</div>
      <div class="detail-rb-list" id="pd_team_effort"></div>
    </div>
    <div class="detail-rb-box">
      <div class="info-lbl">Budget Snapshot</div>
      <div class="detail-rb-list" id="pd_budget_snapshot"></div>
    </div>
  </div>
</section>
```

Remove the previous Resources and `.detail-rb-grid` markup from `.detail-right`. Add:

```css
.detail-resource-summary-section .detail-rb-grid { margin-top: 0; }
```

- [ ] **Step 6: Run the layout tests**

Run:

```powershell
& $node --test tests/project-detail-calendar-gantt.test.mjs tests/project-detail-attention-sync.test.mjs tests/project-editor-guidance.test.mjs
```

Expected: all selected tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- team-2/index.html tests/project-detail-calendar-gantt.test.mjs
git commit -m "feat: rebalance Single Project detail layout"
```

### Task 3: Render the aligned two-level calendar Gantt

**Files:**
- Modify: `team-2/index.html`
- Modify: `tests/project-detail-calendar-gantt.test.mjs`

- [ ] **Step 1: Add failing Gantt rendering tests**

Append to `tests/project-detail-calendar-gantt.test.mjs`:

```js
test('Gantt exposes descriptive scale controls and calendar guidance', () => {
  assert.match(html, />Weekly view<\/button>/);
  assert.match(html, />Monthly view<\/button>/);
  assert.match(html, /aria-pressed="\$\{ganttScale === 'week'\}"/);
  assert.match(html, /axis\.rangeLabel/);
  assert.match(html, /axis\.guidance/);
});

test('Gantt header and rows share calendar-axis positions', () => {
  assert.match(html, /buildGanttCalendarAxis\(min,\s*max,\s*ganttScale\)/);
  assert.match(html, /class="gantt-calendar-groups"/);
  assert.match(html, /class="gantt-calendar-ticks"/);
  assert.match(html, /class="gantt-grid-line"/);
  assert.match(html, /const gridLines = axis\.ticks\.map/);
  assert.doesNotMatch(
    html,
    /\.gantt-track\s*\{[^}]*repeating-linear-gradient/,
  );
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
& $node --test tests/project-detail-calendar-gantt.test.mjs
```

Expected: FAIL because the current renderer uses Week/Month labels and a fixed ten-segment background.

- [ ] **Step 3: Import the calendar-axis builder**

Add `buildGanttCalendarAxis` to the existing import from `./js/portfolio-core.mjs` in `team-2/index.html`.

- [ ] **Step 4: Replace the fixed-grid Gantt CSS**

Replace the Gantt axis/tick/track styles with:

```css
.gantt-toolbar { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:12px; }
.gantt-summary { display:grid; gap:3px; }
.gantt-count { font-size:12px; font-weight:800; color:var(--text); }
.gantt-range { font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--muted); }
.gantt-scale-control { display:grid; justify-items:end; gap:5px; }
.gantt-toggle { display:inline-flex; border:1px solid var(--border); border-radius:7px; overflow:hidden; }
.gantt-toggle button { border:0; background:#fff; color:var(--muted); padding:6px 11px; cursor:pointer; }
.gantt-toggle button.active { background:var(--blue); color:#fff; }
.gantt-scale-help { max-width:320px; font-size:10px; color:var(--muted); text-align:right; }
.gantt-chart { overflow-x:auto; border:1px solid var(--border); border-radius:8px; background:#fff; }
.gantt-grid { min-width:var(--gantt-grid-width,680px); }
.gantt-axis,.gantt-row { display:grid; grid-template-columns:150px minmax(500px,1fr); }
.gantt-axis { border-bottom:1px solid var(--border); }
.gantt-axis-label,.gantt-name { padding:8px 10px; font-size:10px; color:var(--muted); }
.gantt-calendar-axis { min-height:54px; position:relative; }
.gantt-calendar-groups { position:absolute; inset:0 0 27px; }
.gantt-calendar-ticks { position:absolute; inset:27px 0 0; }
.gantt-calendar-group,.gantt-calendar-tick {
  position:absolute;
  top:0;
  bottom:0;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
  border-left:1px solid var(--border);
  white-space:nowrap;
}
.gantt-calendar-group { background:var(--s2); font-size:9px; font-weight:800; color:var(--text-light); }
.gantt-calendar-tick { font-family:'IBM Plex Mono',monospace; font-size:9px; color:var(--muted); }
.gantt-row { border-bottom:1px solid var(--border); }
.gantt-row:last-child { border-bottom:0; }
.gantt-name { font-size:11px; font-weight:700; color:var(--text); }
.gantt-track { position:relative; min-height:42px; background:#fff; }
.gantt-grid-line { position:absolute; top:0; bottom:0; width:1px; background:var(--border); pointer-events:none; }
```

Keep the existing bar, status, Today, milestone, and empty-state styles.

- [ ] **Step 5: Replace the Gantt renderer with the shared-axis version**

In `renderProjectGantt`, build controls first:

```js
const scaleGuidance = ganttScale === 'week'
  ? 'Each grid column represents one calendar week.'
  : 'Each grid column represents one calendar month.';
const toggle = `<div class="gantt-scale-control">
  <div class="gantt-toggle" role="group" aria-label="Schedule scale">
    <button type="button" class="${ganttScale === 'week' ? 'active' : ''}"
      aria-pressed="${ganttScale === 'week'}" onclick="setGanttScale('week')">Weekly view</button>
    <button type="button" class="${ganttScale === 'month' ? 'active' : ''}"
      aria-pressed="${ganttScale === 'month'}" onclick="setGanttScale('month')">Monthly view</button>
  </div>
  <div class="gantt-scale-help">${scaleGuidance}</div>
</div>`;
```

For the empty state use:

```js
if (!rows.length) {
  target.innerHTML = `<div class="gantt-toolbar">
    <div class="gantt-summary"><span class="gantt-count">0 workstreams</span></div>
    ${toggle}
  </div><div class="gantt-empty">No dated schedule workstreams yet.</div>`;
  return;
}
```

After calculating `min` and `max`, replace `createTimelineTicks` and the fixed range with:

```js
const axis = buildGanttCalendarAxis(min, max, ganttScale);
if (!axis) {
  target.innerHTML = `<div class="gantt-toolbar">
    <div class="gantt-summary"><span class="gantt-count">0 workstreams</span></div>
    ${toggle}
  </div><div class="gantt-empty">No dated schedule workstreams yet.</div>`;
  return;
}
const total = axis.axisEnd.getTime() - axis.axisStart.getTime();
const pct = date => ((date.getTime() - axis.axisStart.getTime()) / total) * 100;
const cellWidth = ganttScale === 'week' ? 88 : 100;
const gridWidth = 150 + Math.max(500, axis.ticks.length * cellWidth);
const boundaryAfter = (list, index) => list[index + 1]?.date || axis.axisEnd;
const positionedCells = (list, className) => list.map((item, index) => {
  const start = item.start || item.date;
  const end = item.end || boundaryAfter(list, index);
  return `<span class="${className}" style="left:${pct(start)}%;width:${pct(end)-pct(start)}%">
    ${escHtml(item.label)}
  </span>`;
}).join('');
const gridLines = axis.ticks.map(tick =>
  `<span class="gantt-grid-line" style="left:${pct(tick.date)}%"></span>`
).join('') + '<span class="gantt-grid-line" style="left:100%"></span>';
```

Render the toolbar and two-level axis with:

```js
target.innerHTML = `
  <div class="gantt-toolbar">
    <div class="gantt-summary">
      <span class="gantt-count">${rows.length} workstream${rows.length === 1 ? '' : 's'}</span>
      <span class="gantt-range">${escHtml(axis.rangeLabel)}</span>
    </div>
    ${toggle.replace(scaleGuidance, axis.guidance)}
  </div>
  <div class="gantt-chart" role="region" aria-label="Project Gantt schedule" tabindex="0">
    <div class="gantt-grid" style="--gantt-grid-width:${gridWidth}px">
      <div class="gantt-axis">
        <div class="gantt-axis-label">Workstream</div>
        <div class="gantt-calendar-axis">
          <div class="gantt-calendar-groups">${positionedCells(axis.groups, 'gantt-calendar-group')}</div>
          <div class="gantt-calendar-ticks">${positionedCells(axis.ticks, 'gantt-calendar-tick')}</div>
        </div>
      </div>
      ${rows.map(row => {
        const start = ganttDate(row.startDate);
        const end = ganttDate(row.endDate);
        const milestone = milestones.get(row.milestoneId);
        const milestoneDate = ganttDate(milestone?.date);
        const marker = milestoneDate && milestoneDate >= axis.axisStart && milestoneDate < axis.axisEnd
          ? `<span class="gantt-milestone" style="left:${pct(milestoneDate)}%"
              title="${escHtml(milestone.name || 'Linked milestone')}"></span>`
          : '';
        return `<div class="gantt-row">
          <div class="gantt-name">${escHtml(row.name)}<br>
            <span style="font-weight:400;color:var(--muted)">${row.progress}%</span>
          </div>
          <div class="gantt-track">${gridLines}${todayLine}
            <span class="gantt-bar ${row.status}"
              style="left:${Math.max(0,pct(start))}%;width:${Math.max(.7,((end-start+day)/total)*100)}%"
              title="${escHtml(row.name)}: ${row.progress}%">${row.progress}%</span>
            ${marker}
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
```

Update `todayLine` to compare against `axis.axisStart` and `axis.axisEnd`, not `min` and `max`.

- [ ] **Step 6: Run focused Gantt and layout tests**

Run:

```powershell
& $node --test tests/project-detail-calendar-gantt.test.mjs tests/portfolio-core.test.mjs tests/project-detail-attention-sync.test.mjs
```

Expected: all selected tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- team-2/index.html tests/project-detail-calendar-gantt.test.mjs
git commit -m "feat: render aligned calendar Gantt"
```

### Task 4: Full regression, browser verification, and v2.0T deployment

**Files:**
- Modify only if verification finds a regression: files already listed above

- [ ] **Step 1: Run the complete automated suite**

Run:

```powershell
& $node --test tests/*.test.mjs team-2/*.test.mjs team-2/*.test.cjs
git diff --check
```

Expected: every test PASS, zero failures, and `git diff --check` exits successfully.

- [ ] **Step 2: Start or reuse the local static server**

Run:

```powershell
$python = 'C:\Users\65881\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
Start-Process -FilePath $python -ArgumentList '-m','http.server','4173','--bind','127.0.0.1' `
  -WorkingDirectory (Get-Location) -WindowStyle Hidden
```

Open `http://127.0.0.1:4173/team-2/`.

- [ ] **Step 3: Verify the desktop Single Project layout**

In the in-app browser:

1. Open a project with dated workstreams.
2. Confirm the One-page Status button is absent.
3. Confirm narrative occupies approximately two-thirds and Milestone remains on the right at approximately one-third.
4. Confirm the right column ends after Milestone Roadmap.
5. Confirm lower order is Gantt, Quarterly Milestones, Resources, Team & Effort/Budget Snapshot.

- [ ] **Step 4: Verify both Gantt scales**

1. In Weekly view, confirm month groups, `Wnn · Mon d` labels, and weekly guidance.
2. In Monthly view, confirm year groups, month labels, and monthly guidance.
3. Confirm header boundaries and row grid lines share the same horizontal coordinates.
4. Confirm bars, Today, and milestone diamonds stay aligned after switching.
5. Confirm the exact project schedule range is visible.

- [ ] **Step 5: Verify narrow layout and browser console**

1. Use a viewport below 1100 px.
2. Confirm the upper layout stacks with narrative before Milestone.
3. Confirm Gantt and quarterly sections scroll horizontally without expanding the modal.
4. Confirm Team & Effort and Budget Snapshot stack.
5. Confirm the browser console contains no JavaScript errors.

- [ ] **Step 6: Commit any verification correction**

If verification requires a correction, write a failing regression test first, apply the minimal fix, rerun focused and full tests, then:

```powershell
git add -- team-2/index.html team-2/js/portfolio-core.mjs tests
git commit -m "fix: resolve calendar Gantt verification findings"
```

If no files changed, do not create an empty commit.

- [ ] **Step 7: Push the verified result to UAT**

Run:

```powershell
git status --short
git push uat HEAD:main
```

Expected: clean worktree and `uat/main` advances to the verified commit.

- [ ] **Step 8: Verify GitHub Pages and deployed content**

Confirm the latest `pages-build-deployment` run succeeds, then open:

```text
https://augusliang23-web.github.io/pm-dashboard-uat/team-2/index.html?v=<deployed-commit>
```

Repeat the desktop layout, Weekly/Monthly scale, narrow layout, and console checks. Production v2.0 remains unchanged.
