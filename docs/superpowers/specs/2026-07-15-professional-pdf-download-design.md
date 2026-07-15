# PM Dashboard v2.1 Professional PDF Download Design

## Objective

Replace browser-dependent PDF printing with a professional report service for single-project and Overview reports. The generated PDF must download directly to the user's device and must never be persisted in Cloud Storage, Firestore, a third-party service, or application logs.

## Non-negotiable data-handling rules

- A report request contains identifiers and selected sections only; it never contains report content or a client-rendered HTML document.
- The report service verifies the Firebase ID token, reads the requested week from Firestore, and authorizes the request before rendering.
- The PDF exists only as an in-memory response buffer. The service must not call Cloud Storage, Firestore write APIs, or any external document API.
- The service must not write the PDF, report HTML, project content, or personal data to logs. Operational logs may contain only a generated request ID, report mode, status code, and byte count.
- The browser downloads the response through `Content-Disposition: attachment`; it does not open a browser print dialog.

## Architecture

The static GitHub Pages dashboard remains the UI. A new Cloud Run service, protected by Firebase Authentication, exposes `POST /v1/reports/project` and `POST /v1/reports/overview`. It uses the Admin SDK to retrieve the selected `weeks/{weekId}` document and a headless Chromium process to render a report-specific HTML template to a PDF buffer.

The dashboard has a small `professional-pdf-client` module. It obtains the active user's ID token, sends only the report request, validates the response type, creates a temporary browser object URL, triggers a local download, and revokes the URL. The module never stores the PDF in browser persistence.

Both report modes use one shared report domain layer:

- request validation and section allow-lists;
- Firebase identity and role checks;
- data normalization and presentation-safe escaping;
- report header, footer, page-number, table, and empty-section behavior;
- PDF response and ephemeral resource cleanup.

## Report behavior

### Single project

The project report supports the existing section choices: project brief, project update, milestone, Gantt, team allocation, discipline hours, and budget. Empty optional sections are omitted. Narrative updates use a responsive two-column/one-column arrangement. Milestones use an adaptive horizontal timeline for three or fewer short entries and a vertical chronology for larger or long-label collections. Tables repeat their headings and do not split a row across pages.

### Overview

The Overview report supports the existing selectable identities: health focus, weekly trend, executive summary, attention matrix, risk actions, quarterly roadmap, project portfolio, resource analytics, and budget overview. Each section is a semantic reading unit, not a copied browser DOM fragment. Long tables may flow across pages; headings repeat and cards/rows remain intact. Empty sections are omitted. Project portfolio cards repeat the report heading when a new page is required.

## Security and access

The service accepts only `weekId`, report mode, selected sections, and the project code or Overview scope. It derives all report content from Firestore. It verifies a Firebase ID token, loads the authoritative role from `users/{email}`, and permits access only to data that the corresponding dashboard role can view. VIP users may request only released weeks. The service rejects unknown fields, invalid section IDs, missing project codes, unauthorized projects, and oversized requests before starting Chromium.

## Deployment and operations

The PDF service is a private Cloud Run deployment with a configured GitHub Pages CORS allow-list and an explicitly configured dashboard endpoint. It scales to zero and has no minimum instance. The deployment uses a bounded concurrency, request timeout, and maximum instance count. Production activation requires a linked Firebase/Google Cloud billing account, budget alerts, and a UAT endpoint before the dashboard's production endpoint is changed.

## Verification

Automated tests cover request validation, authorization, omission of empty sections, safe HTML output, response headers, and the no-persistence contract. PDF visual checks use fixed fixtures for short content, long narrative content, four-plus milestones, empty allocations, long Overview tables, and no-data sections. Acceptance requires no clipped text, no blank content pages, no browser URL/date headers, no split milestone item, and no persisted PDF artifact.
