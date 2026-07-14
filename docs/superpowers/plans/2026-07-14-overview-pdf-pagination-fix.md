# Overview PDF Pagination Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove conflicting trailing page breaks from the v2.1 Overview PDF so long report sections can flow without blank physical pages.

**Architecture:** The existing renderer continues to create logical report sections. Print CSS moves page separation from the end of every section to the start of each subsequent section, preventing a fragmented section from producing an extra trailing page. Small reading units remain protected from splitting; large cloned sections remain flowable.

**Tech Stack:** Static HTML, CSS print media rules, Node built-in test runner.

## Global Constraints

- Preserve A4 landscape output and retain the current report renderer.
- Keep `index.html` and `team-2/index.html` print rules identical.
- Change only the independent v2.1 deployment; do not alter v2.0 or v2.0T targets.

---

### Task 1: Lock the pagination contract with tests

**Files:**
- Modify: `tests/overview-pdf-pagination.test.mjs`

**Interfaces:**
- Consumes: the `@media print` CSS in both dashboard entrypoints.
- Produces: regression coverage for leading logical-section breaks and flow-safe footers.

- [ ] **Step 1: Write the failing test**

Require both entrypoints to use `break-after: auto` and `page-break-after: auto` for `.print-report-page`, a leading `break-before: page` rule for `.print-report-page + .print-report-page`, and `break-before: avoid-page` for `.print-report-footer`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/overview-pdf-pagination.test.mjs`

Expected: FAIL because `.print-report-page` currently uses `break-after: page`.

- [ ] **Step 3: Commit after the implementation and focused verification**

Commit the test with the CSS change in Task 2.

### Task 2: Replace trailing page breaks with leading section breaks

**Files:**
- Modify: `index.html`
- Modify: `team-2/index.html`
- Test: `tests/overview-pdf-pagination.test.mjs`

**Interfaces:**
- Consumes: `.print-report-page`, `.print-report-footer`, and `.print-report-unit` emitted by `renderPresentationReportPage`.
- Produces: deterministic boundaries between logical report sections without a trailing blank-page trigger.

- [ ] **Step 1: Implement the minimal CSS change**

Replace the trailing `break-after: page` and `page-break-after: always` declaration with `auto`. Add a sibling selector that applies `break-before: page` and `page-break-before: always` to each later `.print-report-page`. Add `break-before: avoid-page` and `page-break-before: avoid` to `.print-report-footer`.

- [ ] **Step 2: Run the focused test to verify it passes**

Run: `node --test tests/overview-pdf-pagination.test.mjs`

Expected: PASS with all pagination contract tests green.

- [ ] **Step 3: Run full regression tests**

Run: `node --test tests/*.test.mjs *.test.mjs team-2/*.test.mjs; node --test presence-estimate.test.cjs trend-summary.test.cjs`

Expected: 250 tests pass with 0 failures.

- [ ] **Step 4: Commit**

Run: `git add index.html team-2/index.html tests/overview-pdf-pagination.test.mjs docs/superpowers/specs/2026-07-14-overview-pdf-pagination-design.md docs/superpowers/plans/2026-07-14-overview-pdf-pagination-fix.md && git commit -m "fix: prevent blank overview PDF pages"`

### Task 3: Deploy the verified v2.1 PDF fix

**Files:**
- No source changes.

**Interfaces:**
- Consumes: the verified v2.1 branch.
- Produces: an updated `https://augusliang23-web.github.io/pm-dashboard-v2-1/` site.

- [ ] **Step 1: Push the v2.1 branch and Pages main branch**

Run: `git push origin codex/v2.1-release` and `git push v21 HEAD:main`.

- [ ] **Step 2: Verify deployment content**

Confirm the Pages site responds with HTTP 200 and contains the updated pagination CSS.
