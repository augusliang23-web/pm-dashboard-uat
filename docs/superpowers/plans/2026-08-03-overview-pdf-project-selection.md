# Overview PDF Project Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-step Overview PDF export that recalculates every project-scoped section from selected projects.

**Architecture:** `team-2/index.html` collects section and project choices without persisting them. The shared Cloud Run service validates selected codes, filters trusted current and trend-week data before report modelling, and excludes unscoped Executive milestones for a partial selection.

**Tech Stack:** Static HTML, JavaScript ES modules, Node.js `node:test`, Cloud Run.

## Global Constraints

- Apply the same feature to v2.1 `pm-dashboard` and v2.2T `pm-dashboard-uat`.
- List only visible Overview projects, checked by default.
- Send only project codes; server-side Firestore data remains authoritative.
- Reject no selection and do not store a previous choice.
- Omit Executive milestones for a partial project selection.

---

### Task 1: Define and test the project-selection request contract

**Files:** `pdf-service/src/report-request.js`, `pdf-service/test/report-request.test.mjs`

- [ ] Write failing `node:test` assertions for a non-empty unique `projectCodes` array and empty, duplicate, blank, and non-string rejections.
- [ ] Run `npm test --prefix pdf-service -- report-request.test.mjs` and confirm failure.
- [ ] Allow `projectCodes` for Overview requests only; normalize, de-duplicate-check, and return it.
- [ ] Re-run the focused test and commit `feat: accept Overview PDF project selections`.

### Task 2: Enforce project scope in the PDF service

**Files:** `pdf-service/src/report-data.js`, `pdf-service/src/report-model.js`, `pdf-service/src/overview-report.js`, `pdf-service/test/report-data.test.mjs`, `pdf-service/test/overview-report.test.mjs`

- [ ] Write failing tests proving current/trend weeks are filtered and Executive milestones are omitted for a partial selection.
- [ ] Run `npm test --prefix pdf-service -- report-data.test.mjs overview-report.test.mjs` and confirm failure.
- [ ] Filter trusted cloned week objects by selected codes before modelling, carry original-project count, and omit partial-selection milestones.
- [ ] Re-run focused tests and commit `feat: scope Overview PDF data to selected projects`.

### Task 3: Add the browser two-step selection UI

**Files:** `team-2/index.html`, `tests/overview-print-selection.test.mjs`

- [ ] Write failing UI-source tests for the second accessible dialog, checked-by-default projects, Select all, Clear, validation, and unpersisted `projectCodes` request data.
- [ ] Run `node --test tests/overview-print-selection.test.mjs` and confirm failure.
- [ ] Implement the sections-to-projects dialog sequence and final export request from role-filtered Overview projects.
- [ ] Re-run the UI test and commit `feat: choose projects for Overview PDF export`.

### Task 4: Verify and deploy both releases

- [ ] Compare matching feature files against the v2.1 worktree after UAT implementation.
- [ ] Run `npm test --prefix pdf-service && node --test tests/*.test.mjs` in both worktrees.
- [ ] Deploy the shared Cloud Run PDF service once, then deploy each verified Pages source.
- [ ] Confirm both release URLs expose and submit the two-step export flow.
