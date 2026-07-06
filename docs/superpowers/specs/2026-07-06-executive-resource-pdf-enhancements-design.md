# Executive Progress, Resource Analytics, and PDF Selection Design

Date: 2026-07-06  
Target: v2.0T local development first; deploy only after local user acceptance

## Scope

This batch improves three areas:

1. Executive Timeline progress and editing.
2. Discipline Hours and portfolio resource analytics.
3. Selective Overview PDF export.

The production v2.0 and v2.0T sites share Firebase data. Any new stored field must be optional, preserve unknown fields, and remain readable by older code. Existing records must not require a batch migration.

## Executive Timeline

### Display

- Each outcome shows a two-color progress bar:
  - completed portion: green;
  - remaining portion: gray.
- RAG affects only the status badge, not the progress bar color.
- A 100% outcome is automatically displayed as `Achieved / Done`.
- Outcomes below 100% use `On Track`, `At Risk`, or `Delayed`.
- Legacy text-only outcomes continue to load as manual 0% / On Track outcomes until edited.

### Three category summaries

The fixed categories are:

1. Solution & ecosystem
2. Customers & GTM
3. Investors & Others

Each category card shows:

- overall progress;
- overall RAG;
- Auto or Manual Override indicator;
- override reason when applicable.

Automatic category progress is the equal-weight average of all outcomes in that category with valid progress. Missing automatic evidence is excluded rather than treated as zero. Automatic category RAG uses the worst valid outcome status. If every outcome is 100%, the category displays `Achieved / Done`.

An authorized strategy editor may override category progress and RAG. An override reason is required, and the UI clearly distinguishes the override from the automatic result. Removing the override restores automatic calculation.

### Simplified editor

The editor uses the approved “category summary + quarterly disclosure” layout:

- three category summary cards at the top;
- categories collapsed by default;
- Q1–Q4 tabs inside the expanded category;
- only the selected category and quarter show outcome rows;
- each row contains outcome text, segmented progress (0/25/50/75/100), status, and an Evidence button;
- evidence details open in a secondary panel;
- advanced controls do not occupy the main editing row.

Existing stable outcome IDs and evidence references are retained.

## Project Level and Discipline Hours

Project Level supports:

- System
- Hardware Module
- Software

Discipline Hours rows are generated from unique, non-empty Team Effort Role values. Duplicate roles are merged case-insensitively into one row. When roles change, existing hour values are retained when a normalized role match exists.

If the project has no allocation rows, or allocation information is marked as not required, the entire Discipline Hours section is hidden and no validation is applied to it.

Estimated hours remain required for displayed roles; actual hours remain optional.

## Overview Resource Analytics

The member-by-member list is removed from Overview. Resource Analytics and Budget move to the bottom of Overview, in that order.

Only confirmed Team Effort allocation contributes to analytics. Calculations normalize member names and role names case-insensitively.

### KPIs

- Total Allocated FTE: sum of assignment allocation percentages divided by 100.
- Allocation Coverage: active projects with confirmed allocation or confirmed “not required” status divided by active projects.
- Overallocated People: count of distinct people whose allocation across active projects exceeds 100%; names are not displayed.
- Available Capacity: sum of the unused portion up to 100% for each known allocated person, expressed as FTE.

### Charts

- Project Level donut: allocated FTE split across System, Hardware Module, and Software.
- Function Mix stacked bars: allocated FTE for each Role split across the three Project Levels.

Empty and partial data states explain what is missing rather than presenting misleading zero values.

## Selective Overview PDF Export

The Overview Export PDF button opens a selection dialog before printing.

### Presets

- All
- Executive
- Roadmap
- Resource & Budget
- Custom

### Individual sections

The user can include or exclude each major Overview section, including:

- executive summary;
- attention matrix;
- executive timeline;
- quarterly KPI and project roadmap;
- project portfolio;
- resource analytics;
- budget.

All sections are selected by default. At least one section is required.

Selection affects only the current print operation. It does not change the dashboard, persist to Firebase, or affect other users. Selected sections keep dashboard order; Resource Analytics and Budget remain last. Print state is removed after printing or cancellation.

## Data Compatibility

- New category override data is stored as optional keyed objects, not nested arrays.
- Readers accept legacy arrays, keyed maps, text outcomes, and structured outcomes.
- Serializers preserve unknown nested fields.
- Production v2.0 compatibility helpers must be updated before any v2.0T write format that older code cannot read.
- No historical Firestore records are batch-rewritten.

## Validation and Tests

Automated tests cover:

- green/gray progress rendering at 0, 25, 50, 75, and 100%;
- automatic Done status at 100%;
- category progress, worst-state RAG, override reason validation, and override removal;
- legacy and structured executive outcome compatibility;
- Software Project Level persistence and filtering compatibility;
- dynamic Discipline Hours generation, role merging, value preservation, and hidden state;
- resource KPI and chart aggregation with duplicate people, partial confirmation, and empty data;
- PDF presets, individual selection, minimum-one validation, and print-state cleanup;
- Firestore-safe serialization without nested arrays or loss of unknown fields.

Local acceptance verifies the approved editor layout, resource analytics layout, and PDF section selection before any deployment.
