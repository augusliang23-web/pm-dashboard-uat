# Professional PDF Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate consistent single-project and Overview PDF reports through an authenticated in-memory Cloud Run service and download them directly to the user's device.

**Architecture:** A new Node 20 Cloud Run service verifies Firebase tokens, reads report data from Firestore, renders dedicated HTML report templates in Chromium, and streams a PDF buffer in the HTTP response. The existing static dashboard calls that service through a focused client module; no PDF or report content is persisted.

**Tech Stack:** Node.js 20, Express, Firebase Admin SDK, Puppeteer, Cloud Run, Firebase Authentication, Firestore, native `node:test`.

## Global Constraints

- Do not persist PDF bytes, rendered HTML, or report data in Cloud Storage, Firestore, local durable storage, or logs.
- Every API response with PDF data must use `Content-Disposition: attachment` and `application/pdf`.
- The browser sends only identifiers and selection options; the service is the authoritative reader of report data.
- Both `index.html` and `team-2/index.html` must use the same PDF-download behavior.
- Keep browser print code available only until the Cloud Run endpoint has passed UAT; the production export action must not invoke `window.print()`.

---

### Task 1: Create the PDF service boundary and prove its no-persistence contract

**Files:**
- Create: `pdf-service/package.json`
- Create: `pdf-service/src/app.js`
- Create: `pdf-service/src/report-request.js`
- Create: `pdf-service/src/pdf-response.js`
- Create: `pdf-service/test/report-request.test.mjs`
- Create: `pdf-service/test/pdf-response.test.mjs`

**Interfaces:**
- Consumes: `{ mode, weekId, projectCode?, sections, overviewScope? }` and a Firebase ID token.
- Produces: a `Buffer` response with `Content-Type: application/pdf`, attachment disposition, and no persistence calls.

- [ ] Write failing tests that reject unknown report modes/sections and assert PDF response headers.
- [ ] Run `node --test pdf-service/test/report-request.test.mjs pdf-service/test/pdf-response.test.mjs` and observe the missing-module failure.
- [ ] Implement allow-listed request parsing and an in-memory `sendPdfDownload(response, buffer, filename)` helper; do not import Storage or Firestore write APIs.
- [ ] Re-run the focused tests and verify they pass.
- [ ] Commit with `feat: add professional PDF service boundary`.

### Task 2: Authorize and load only server-side report data

**Files:**
- Create: `pdf-service/src/firebase.js`
- Create: `pdf-service/src/report-access.js`
- Create: `pdf-service/src/report-data.js`
- Create: `pdf-service/test/report-access.test.mjs`
- Create: `pdf-service/test/report-data.test.mjs`

**Interfaces:**
- Consumes: verified Firebase token, user-role record, report request, Firestore read adapter.
- Produces: normalized `{ week, project?, role, reportOptions }` without client-provided report content.

- [ ] Write failing tests for VIP unreleased-week rejection, missing project rejection, role normalization, and omission of empty optional report sections.
- [ ] Run the focused tests and observe the missing authorization/data modules.
- [ ] Implement injected Admin SDK read adapters so tests use fixtures rather than a live Firebase project; reject invalid and unauthorized requests before calling the renderer.
- [ ] Re-run the focused tests and verify they pass.
- [ ] Commit with `feat: authorize server-side PDF report data`.

### Task 3: Render semantic report templates with adaptive pagination

**Files:**
- Create: `pdf-service/src/report-html.js`
- Create: `pdf-service/src/project-report.js`
- Create: `pdf-service/src/overview-report.js`
- Create: `pdf-service/test/project-report.test.mjs`
- Create: `pdf-service/test/overview-report.test.mjs`

**Interfaces:**
- Consumes: normalized report data from `report-data.js`.
- Produces: escaped standalone HTML with A4-landscape print CSS.

- [ ] Write failing tests that require empty team/resource/budget sections to be absent, long milestone sets to use the vertical chronology, and Overview empty sections to be absent.
- [ ] Run the focused tests and observe the missing report-template modules.
- [ ] Implement shared header/footer/page CSS, adaptive project narrative layout, milestone layout switching, repeatable table headers, and Overview section templates.
- [ ] Re-run focused tests and verify they pass.
- [ ] Commit with `feat: add semantic professional report templates`.

### Task 4: Add in-memory Chromium rendering and hardened HTTP endpoints

**Files:**
- Modify: `pdf-service/src/app.js`
- Create: `pdf-service/src/pdf-renderer.js`
- Create: `pdf-service/Dockerfile`
- Create: `pdf-service/.dockerignore`
- Create: `pdf-service/test/app.test.mjs`

**Interfaces:**
- Consumes: report HTML and an injected browser renderer.
- Produces: `POST /v1/reports/project` and `POST /v1/reports/overview` downloads.

- [ ] Write failing endpoint tests for missing bearer token, rejected origin, invalid response type, and successful attachment download.
- [ ] Run the endpoint tests and observe the missing renderer/endpoint behavior.
- [ ] Implement Firebase token verification, strict CORS, bounded body size, `page.pdf()` buffer rendering, `finally` browser/page cleanup, and metadata-only operational logging.
- [ ] Re-run endpoint tests and verify they pass.
- [ ] Commit with `feat: add authenticated in-memory PDF endpoints`.

### Task 5: Connect both dashboard entry points to direct download

**Files:**
- Create: `professional-pdf-client.mjs`
- Modify: `index.html`
- Modify: `team-2/index.html`
- Modify: `tests/project-pdf-sections.test.mjs`
- Modify: `tests/overview-print-selection.test.mjs`
- Create: `tests/professional-pdf-client.test.mjs`

**Interfaces:**
- Consumes: Firebase Auth `getIdToken()` and report option identifiers.
- Produces: local browser download and user-visible failure state; no `window.print()` for the professional path.

- [ ] Write failing source-contract tests for the module import, authenticated request, direct browser download, and absence of `window.print()` in professional export handlers.
- [ ] Run the focused tests and observe failure before the client module/handlers exist.
- [ ] Implement endpoint configuration, token retrieval, response validation, temporary object URL download, URL cleanup, busy-state controls, and accessible errors in both HTML entry points.
- [ ] Re-run focused tests and verify they pass.
- [ ] Commit with `feat: download professional project and overview PDFs`.

### Task 6: Provide deployment, privacy, and visual-verification handoff

**Files:**
- Create: `pdf-service/cloudrun.env.example`
- Create: `pdf-service/deploy.ps1`
- Modify: `README.md`
- Modify: `functions/README.md`
- Create: `docs/professional-pdf-uat-checklist.md`

**Interfaces:**
- Consumes: project ID, Cloud Run region, allowed GitHub Pages origin, and service URL.
- Produces: reproducible private deployment instructions and UAT evidence checklist.

- [ ] Write failing deployment-source tests that require no Cloud Storage reference, Cloud Run scale-to-zero configuration, and a UAT endpoint variable.
- [ ] Run the test and observe failure before deployment configuration exists.
- [ ] Add explicit deploy commands, minimum-instance zero, maximum-instance cap, endpoint environment variables, budget-alert instructions, and a fixture-based visual checklist.
- [ ] Run all dashboard and PDF service tests; render each fixture locally where Chromium is available; inspect resulting pages for clipping, blank pages, and headers/footers.
- [ ] Commit with `docs: add professional PDF deployment and UAT guide`.
