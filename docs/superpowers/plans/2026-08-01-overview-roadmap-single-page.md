# Overview Roadmap Single-Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Executive Milestones and Quarterly Roadmap compactly together on their own A4 landscape Overview PDF pages, with explicit continuation pages only when measured overflow requires them.

**Architecture:** The Overview renderer will emit each roadmap as a dedicated measured flow whose direct children are complete category or quarter-column units. The PDF theme will compact those units; the paginator will move whole units to a repeated roadmap continuation page rather than splitting them.

**Tech Stack:** Node.js ES modules, HTML/CSS PDF templates, Puppeteer measured pagination, Node.js built-in test runner.

## Global Constraints

- Apply identical production code, tests, and layout behavior to `pm-dashboard` and `pm-dashboard-uat`.
- Preserve milestone data, order, RAG/progress, and current section selection behavior.
- Use the compact A4 landscape page first; do not force unreadably small text to avoid an overflow page.
- Never split one Executive category or one Quarterly Roadmap quarter column across pages.

---

### Task 1: Define failing renderer contracts for compact roadmap flows

**Files:**
- Modify: `pdf-service/test/overview-report.test.mjs`
- Modify: `pdf-service/src/overview-report.js`

**Interfaces:**
- Produces: `renderExecutiveMilestones(model)` and `renderQuarterlyRoadmap(model)` markup with `data-pdf-flow-items`, one direct flow item per category or quarter, and roadmap page metadata.
- Consumed by: the measured paginator and PDF theme.

- [ ] **Step 1: Write failing Executive and Quarterly markup assertions**

Require `data-measured-flow="executive-roadmap"`, `data-flow-kind="executive-roadmap-category"`, `data-measured-flow="quarterly-roadmap"`, and `data-flow-kind="quarterly-roadmap-quarter"` in the Overview report HTML.

- [ ] **Step 2: Run the renderer test to verify it fails**

Run: `node --test pdf-service/test/overview-report.test.mjs`

Expected: FAIL because compact measured-flow contracts are absent.

- [ ] **Step 3: Emit complete roadmap units from the renderer**

Render Executive categories and Q1–Q4 Quarterly columns as complete direct measured-flow items, each with section title, kicker, and section metadata for continuation pages.

- [ ] **Step 4: Run the renderer test to verify it passes**

Run: `node --test pdf-service/test/overview-report.test.mjs`

Expected: PASS.

### Task 2: Apply compact layout and continuation behavior

**Files:**
- Modify: `pdf-service/src/report-theme.js`
- Modify: `pdf-service/src/measured-paginator.js`
- Modify: `pdf-service/test/pdf-layout.test.mjs`
- Modify: `pdf-service/test/measured-paginator.test.mjs`

**Interfaces:**
- Consumes: compact roadmap flow items from Task 1.
- Produces: readable 8pt-or-larger roadmap pages and whole-unit overflow continuation pages.

- [ ] **Step 1: Add failing layout and overflow tests**

Assert section-scoped compact four-column CSS and a synthetic overflow where each roadmap unit remains whole and the second page is a continuation.

- [ ] **Step 2: Run both tests to verify they fail**

Run:

```bash
node --test pdf-service/test/pdf-layout.test.mjs pdf-service/test/measured-paginator.test.mjs
```

Expected: FAIL because the current theme and flow do not provide this contract.

- [ ] **Step 3: Add scoped compact styles and use unsplittable roadmap units**

Reduce roadmap-only padding, gaps, and heading sizes while keeping a four-quarter grid and 8pt-or-larger content. Do not mark category or quarter-column flow items splittable so the existing paginator moves complete units to a continuation page.

- [ ] **Step 4: Run both tests to verify they pass**

Run:

```bash
node --test pdf-service/test/pdf-layout.test.mjs pdf-service/test/measured-paginator.test.mjs
```

Expected: PASS.

### Task 3: Synchronize, verify, and deploy both versions

**Files:**
- Modify in both repositories: Overview renderer, PDF theme, paginator, and tests.

**Interfaces:**
- Consumes: passing focused tests.
- Produces: identical PDF behavior in production and UAT.

- [ ] **Step 1: Run the full PDF service suite in both repositories**

Run: `node --test pdf-service/test/*.test.mjs`

Expected: PASS in both repositories.

- [ ] **Step 2: Compare the synchronized source files**

Run `diff -u` for `overview-report.js`, `report-theme.js`, and `measured-paginator.js` between the two repositories.

Expected: no output.

- [ ] **Step 3: Commit, push, deploy, and inspect both exports**

Commit with `feat: compact overview roadmap PDF pages`, push each `main` branch, deploy each documented PDF service target, and export a live Overview PDF from both URLs to verify single-page-first layout and whole-unit continuation.
