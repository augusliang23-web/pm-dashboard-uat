# PM Dashboard v2.1 Dashboard-Style PDF Design

## Objective

Upgrade the professional Overview and single-project PDFs from simplified reports to print-optimized versions of the dashboard. The PDFs must preserve the dashboard's visual language and information hierarchy while removing interactive navigation and controls. This design extends the security and no-persistence rules in `2026-07-15-professional-pdf-download-design.md`; those rules remain mandatory.

## Approved direction

Use a server-side dashboard report design system inside the existing Cloud Run PDF service. The browser continues to send only report identifiers and selected section IDs. The service authenticates the request, reads authoritative Firestore data, builds a presentation model, renders report-specific HTML, and returns an in-memory PDF download.

Do not open the live dashboard in Chromium and do not send client-rendered HTML to the service. These alternatives would increase authentication complexity or weaken the existing security boundary.

## Visual design

The report uses the dashboard's color tokens, typography hierarchy, rounded cards, status colors, RAG indicators, progress bars, tables, timelines, and chart semantics. Navigation, buttons, selectors, modals, hover behavior, and other interactive controls are omitted. Each page has a compact report header with report name, project or portfolio identity, week, and generation context, plus a restrained page footer.

Charts and decorations use HTML, CSS, and compact inline SVG. The service uses system fonts and does not load remote fonts, third-party images, high-resolution backgrounds, or full-dashboard screenshots. Shadows and effects may be simplified for reliable printing, but content structure, color meaning, and relative visual emphasis must match the dashboard.

## Page composition

All pages use A4 landscape orientation. Unselected or empty optional sections are omitted without leaving blank pages. A section may continue onto another page when necessary. Tables split only between complete rows and repeat their headings; cards and timeline items remain intact.

### Overview report

The Overview report supports all nine existing selections in dashboard reading order:

1. A combined opening page for Portfolio health and focus, Weekly trends, and Executive summary.
2. A management-attention page for Attention matrix and Risk actions.
3. Quarterly roadmap.
4. Project portfolio.
5. Resource analytics.
6. Budget overview.

Only selected sections appear. If a combined page contains only one selected section, that section expands naturally instead of reserving empty space for the others.

### Single-project report

The project report supports all seven existing selections:

1. A combined opening page for Project brief and Project update.
2. Milestone timeline.
3. Gantt chart.
4. A resource page for Team allocation and Discipline hours.
5. Budget.

The Gantt, resource, and budget views reproduce the dashboard's status and comparison cues rather than reducing them to plain text tables.

## Component boundaries

- The request layer validates authentication, report identity, project access, and the section allow-list before Chromium starts.
- A normalization layer converts Firestore values into stable Overview and project presentation models. It owns defaults, numeric formatting, ordering, and empty-state decisions.
- A shared report theme owns print tokens, the A4 shell, header and footer, card primitives, badges, progress bars, tables, and section-break rules.
- Small report components own timelines, RAG summaries, compact trend charts, Gantt rows, resource bars, and budget comparisons. They receive normalized values and return escaped report markup.
- `overview-report` and `project-report` compose those components in the approved order without duplicating the shared theme.
- The PDF renderer owns Chromium lifecycle, PDF options, response-size checks, and cleanup. A warm Cloud Run instance may reuse its Chromium browser, but each request receives an isolated page that is closed after rendering.

These boundaries allow visual changes without changing authorization or Firestore access, and allow data mapping changes without rewriting the print theme.

## Data flow and security

1. The dashboard sends the report type, week ID, project code when applicable, and selected section IDs with a Firebase ID token.
2. The service validates the token, loads the authoritative role, confirms access, and rejects unknown inputs.
3. The service reads the requested Firestore document and creates a normalized presentation model.
4. The appropriate report composer generates safely escaped HTML using the shared print theme.
5. Chromium creates an in-memory PDF buffer.
6. The renderer validates the byte count and returns the buffer with an attachment filename, then closes request-scoped resources.

The PDF, rendered HTML, report data, and personal data are not written to disk, Firestore, Cloud Storage, external services, caches, or logs.

## Size and free-tier controls

- A representative all-section Overview PDF and all-section project PDF each have a soft target of 1.5 MiB or less.
- The service has a hard response limit of 8 MiB. An oversized buffer is discarded and a safe error is returned instead of transferring it.
- Reports use vector and text rendering; full-page raster captures are prohibited.
- Remote assets and embedded web fonts are prohibited.
- Cloud Run remains request-based, scales to zero, and has no minimum instance. Browser reuse on warm instances reduces repeated startup work without persisting report content.
- PDF byte counts are recorded only as operational metadata so future visual changes can be checked for size regressions.

These controls minimize compute and outbound data but do not promise zero billing because Cloud Run free-tier use is aggregated at the billing-account level.

## Error handling

- Missing selections, unknown section IDs, malformed identities, or oversized input return a clear client error before rendering.
- Missing or unauthorized data returns a safe not-found or access-denied response without disclosing protected details.
- Rendering and size-limit failures return a generic report-generation error while server logs retain only request ID, report mode, status, timing, and byte count.
- The frontend awaits the request, restores the export button in every outcome, revokes temporary object URLs, and shows an actionable message. No failure may leave the button apparently unresponsive.
- Empty valid data renders an intentional dashboard-style empty state when the section is required; empty optional sections are omitted.

## Testing and acceptance

Automated tests cover:

- all nine Overview and all seven project section IDs;
- selection ordering and omission of unselected or empty optional sections;
- escaping of user-controlled text and preservation of the no-persistence contract;
- long names, long narrative text, long tables, multiple timeline items, empty allocations, zero values, and missing optional values;
- complete-row table pagination and intact cards, Gantt rows, and timeline items;
- response headers, browser cleanup, frontend button recovery, and safe error messages;
- representative all-section PDFs at or below the 1.5 MiB target and rejection above 8 MiB.

Final acceptance requires downloading both report types from the deployed dashboard and visually inspecting every rendered page. There must be no clipped text, overlapping content, unexpected blank pages, browser URL/date headers, missing selected sections, or interactive UI. Existing authorization, download, security, and PDF-service tests must continue to pass.

## Out of scope

- Pixel-identical screenshots of the interactive dashboard.
- User-selectable PDF themes or paper sizes.
- Cloud PDF history, storage, sharing links, or server-side caching.
- Changes to dashboard data definitions unrelated to report presentation.
