# Executive Summary Decision Brief PDF Design

**Date:** 2026-07-16
**Status:** Approved for implementation planning

## Objective

Replace the current dense Executive Summary PDF page with a fixed two-page, management-readable Decision Brief while keeping the existing Weekly Summary copy/paste workflow and avoiding any new runtime AI dependency or cost.

## User workflow

The authoring workflow remains unchanged:

1. The dashboard generates a Weekly Summary prompt.
2. The user runs that prompt in Copilot or Gemini.
3. The user pastes the generated plain text into the existing Weekly Summary field.
4. The dashboard saves the text and the PDF service formats it for export.

The dashboard's built-in prompt will be updated. Users will not need to maintain a separate prompt, and the PDF service will not call an AI API.

## Weekly Summary output contract

The revised prompt asks for a stable, human-readable structure:

```text
WEEKLY MOVEMENT

Portfolio Summary: <one concise portfolio-level summary>

- Project: <exact project name>
  Movement: <one or two concise sentences>
  Blocker: <one concise sentence, or None>
  Next step: <one concise sentence>

MANAGEMENT ASK

- Project: <exact project name>
  Decision / Support needed: <one concise sentence>
  Business impact: <one concise sentence>
```

Prompt limits:

- One portfolio summary.
- Four to six project movement entries.
- Up to four management asks.
- One or two sentences per field.
- Exact project names from the supplied dashboard data.
- Plain text only; no Markdown tables or invented facts.

These limits are part of the content contract so the report can preserve readable typography within two pages.

## Storage and compatibility

The existing `executiveSummary` plain-text field remains the source of truth. No Firestore migration or schema change is required.

The PDF service will support two input modes:

1. **Structured format:** Parse the new labels into portfolio summary, project movement, blockers, next steps, management asks, and business impacts.
2. **Legacy format:** Recognize the existing `WEEKLY MOVEMENT`, `MANAGEMENT ASK`, `Portfolio Summary:`, and `- Project Name: text` conventions and map them into the new presentation model.

Historical summaries remain exportable without manual rewriting. Parsing failure must not abort the report; unrecognized text falls back to a safe legacy text block within the same page rules.

## PDF presentation model

The parser produces a presentation-only model without changing stored data:

```text
ExecutiveSummaryBrief
  portfolioSummary
  priorityProjects[]
    projectName
    movement
    blocker
    nextStep
  managementAsks[]
    projectName
    supportNeeded
    businessImpact
  hasAdditionalContent
```

Priority projects are selected deterministically from source order, with projects that also have a management ask placed first. No AI ranking occurs during PDF generation.

## Page 1: Decision Brief

Page 1 provides a fast management scan:

- Existing report identity and reporting-period header.
- `Executive Summary` eyebrow and `Management-ready update` title.
- Compact portfolio status/KPI strip when the required values already exist in the report model.
- Portfolio Summary in a visually distinct lead block.
- Up to two priority project cards containing Movement, Blocker, and Next Step.
- Up to four Management Ask items containing the requested decision/support and its business impact.
- Existing report footer and page identity.

## Page 2: Project Context

Page 2 provides supporting detail:

- `Project Context` title and short explanatory subtitle.
- Up to six project sections in source order.
- Each section uses clear labels for Movement, Blocker, and Next Step.
- Management asks may be cross-referenced but are not repeated in full unless needed for comprehension.
- If more content exists, show a restrained note: `Additional project details are available in the dashboard.`

The source Weekly Summary remains intact in the dashboard even when the PDF display is capped.

## Typography and spacing

- Main page title: 24–26 pt.
- Section title: 14–15 pt.
- Project title: 12–14 pt.
- Body text: minimum 10.5 pt.
- Body line height: approximately 1.45.
- Paragraphs should normally remain within three to four lines.
- Use whitespace, dividers, and light cards to establish hierarchy.
- Do not shrink text below the minimum size to force overflow onto a page.
- Avoid the current long, uninterrupted two-column paragraph layout.

## Fixed-page and overflow rules

The Executive Summary section is always two pages in the overview PDF.

- Page 1 caps priority projects and management asks as described above.
- Page 2 caps project context at six projects.
- New summaries are kept within capacity through the revised prompt.
- Legacy or unusually long content is clipped at logical field boundaries, never mid-word or mid-line.
- When material is omitted from the PDF presentation, display the additional-details note.
- Omitted content is not removed from saved dashboard data.

## Error handling

- Missing optional fields are omitted without leaving empty labels or cards.
- A missing portfolio summary uses the first valid legacy movement paragraph as the lead summary when possible.
- Unknown labels remain available to the legacy fallback rather than causing export failure.
- Malformed Weekly Summary input must not prevent other selected PDF sections from rendering.
- All user-supplied text remains escaped by the existing React/PDF rendering path.

## Testing and acceptance criteria

Automated coverage must include:

- Revised prompt contains the exact structured headings, labels, and limits.
- Parser tests for the new structured format.
- Parser tests for current legacy summaries.
- Missing fields, empty sections, excessive entries, long text, and malformed input.
- Deterministic priority ordering and overflow-note behavior.
- PDF generation succeeds without any AI or external network call.
- Chromium/render integration confirms that the Executive Summary occupies exactly two pages and introduces no trailing blank page.

Visual acceptance criteria:

- Page 1 can be scanned for portfolio status, priority changes, and management decisions in under one minute.
- Page 2 clearly separates projects and field labels.
- Body text is never smaller than 10.5 pt.
- No text collision, footer overlap, clipped card, or dense two-column paragraph wall.
- Existing historical summaries remain usable without migration.

## Out of scope

- Adding an AI API to the dashboard or PDF service.
- Automatically rewriting historical Weekly Summaries.
- Changing the Firestore data model.
- Expanding the Executive Summary beyond two PDF pages.
- Replacing Copilot or Gemini as the user's chosen authoring assistant.
