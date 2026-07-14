# Overview PDF Pagination Design

## Goal

Prevent blank pages in the v2.1 Overview PDF while allowing long report sections to continue naturally across physical pages.

## Cause

The report renderer creates logical `.print-report-page` sections. Their cloned content is allowed to flow across physical pages, but the container also forces a trailing page break. With dynamic content and nested `break-inside: avoid` rules, Chromium can apply the trailing break after a fragmented container and emit an empty physical page.

The print layout is A4 landscape. Users must retain Landscape in the browser print dialog; Portrait reduces the printable width and increases fragmentation risk.

## Selected design

- Keep the existing report renderer and logical report sections.
- Remove the trailing forced page break from every `.print-report-page`.
- Start each later logical section with a leading page break using `.print-report-page + .print-report-page`.
- Keep headers, footers, and small report units together where possible; leave large cloned content as flowable content.
- Apply the same rules to `index.html` and `team-2/index.html` so the v2.1 root deployment and maintained team entrypoint remain aligned.

## Verification

- Add a regression test that rejects trailing forced breaks and requires leading section breaks plus a footer break-avoid rule in both entrypoints.
- Run the full Node test suite.
- Deploy only the existing independent v2.1 site. Do not modify v2.0 or v2.0T deployment targets.
