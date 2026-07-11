# Project PDF and Roadmap UX Design

**Date:** 2026-07-11

**Target:** v2.0T local development branch

**Status:** Approved for implementation

## Goal

Correct the single-project PDF export and simplify the project editor and portfolio roadmap so users can distinguish executive outcomes from project milestones and update IoE outcomes without navigating a dense form.

## Scope

This change covers five related user-facing improvements:

1. Export the selected project as a one-page project PDF instead of printing the Overview.
2. Replace the visible `One-page PDF` text button with the same icon treatment as the Overview PDF button.
3. Restore normal text selection and editing behavior in every manually editable project field.
4. Consolidate the Overview roadmap hierarchy and remove duplicate edit actions.
5. Replace the current IoE outcome editor with the approved hybrid row-and-detail interaction.

No Firebase collection shape, Firestore rule, role assignment, release-lock rule, or historical project data will be migrated by this work.

## Root Causes

### One-page PDF prints the Overview

The existing global print stylesheet always hides overlays and modals, forces `#execView` to display, and hides `#normalView`. `exportProjectOnePagePdf()` opens the single-project modal and immediately calls `window.print()`, but the print stylesheet hides that modal and prints the executive Overview instead.

### Text selection drags the entire milestone row

Each milestone `.ms-row` is currently marked draggable and owns the drag events. A drag gesture beginning inside its text input is therefore interpreted as row reordering. Workstream rows already use the correct interaction pattern: only a dedicated drag handle is draggable.

### Roadmap hierarchy and actions are duplicated

The Overview currently nests `Quarterly Target Roadmap`, `Quarterly milestones across projects`, `Portfolio-wide executive timeline`, and the timeline title. `Manage Strategy` and `Edit Timeline` both open the same strategy modal, so users see two actions for one workflow.

### IoE editing exposes advanced settings during routine updates

Section visibility, category override, quarter navigation, outcome status, status reason, evidence, delete action, phases, and project mapping are presented together. Routine RAG updates therefore compete visually with rarely used administrative settings.

## Approved Design

### 1. Single-project PDF mode

`exportProjectOnePagePdf()` will enter a dedicated project-print mode before opening the browser print dialog.

- Add a temporary body class, `print-project-one-page`.
- Render the selected project into `#onePageStatusModal` using the existing one-page project renderer.
- In project-print mode, hide the Overview, dashboard header, project grids, other overlays, controls, and modal chrome.
- Display only the one-page project article.
- Use A4 landscape layout and compact spacing so the selected project is the only PDF content.
- Remove the temporary class and restore modal state through `afterprint`, including when the print dialog is cancelled.
- Overview PDF export will continue using its existing section-selection workflow and will not inherit project-print rules.

If no project can be resolved from the open project detail card, the export action will return without opening a print dialog.

### 2. Project PDF export button

The selected-project detail header will use the existing `btn-icon` visual language and the same download/PDF icon used by the Overview export control.

- Remove visible `One-page PDF` button text.
- Tooltip: `Export project PDF`.
- Accessible name: `Export project PDF`.
- Keep the button in the upper-right project detail header beside the close button.
- The action remains project-specific and does not open the Overview section selector.

### 3. Manual input interaction

All manually editable project inputs will follow standard browser input behavior.

- Milestone rows will no longer be draggable.
- Only the milestone drag handle will have `draggable="true"` and drag listeners.
- Selecting text inside `input` and `textarea` controls will never reorder the row.
- Clicking or dragging within selects, date fields, numeric fields, textareas, content-editable controls, and buttons will remain local to that control.
- Reordering will start only from an explicit drag handle.
- Existing reorder behavior, date validation, preview refresh, and saved row order remain unchanged.
- The audit will cover milestones, Gantt workstreams, team allocation, resource hours, budget rows, quarterly milestones, risks/actions, and executive outcome inputs.

### 4. Portfolio Roadmap hierarchy

The Overview will expose one roadmap component named `Portfolio Roadmap`.

Header controls:

- One roadmap year selector.
- Two view tabs: `Executive Outcomes` and `Project Milestones`.
- One `Edit Executive Roadmap` button when the executive tab is active.

Executive view:

- Title: `{year} IoE Executive Roadmap`.
- Shows the three executive section summaries, quarterly RAG, outcomes, and phase labels.
- Contextual button label: `Edit Executive Roadmap`.

Project view:

- Title: `{year} Project Milestone Roadmap`.
- Shows quarterly milestones derived from individual projects.
- Does not show a second global roadmap editor because project milestones are maintained inside each project card.
- Shows a short `Edit milestones from the project card` guidance note for administrators.

Removed from the visible hierarchy:

- `Quarterly Target Roadmap`
- `Quarterly milestones across projects`
- `Portfolio-wide executive timeline`
- Duplicate `Manage Strategy` and `Edit Timeline` actions in the same roadmap context

Existing role-based executive section visibility, released-week locking, RAG calculation, and project milestone data remain unchanged.

### 5. IoE hybrid outcome editor

The approved C design uses a compact quarter list with inline details.

Routine view:

- Section header shows the section name and outcome count.
- Q1–Q4 tabs select the active quarter.
- Each outcome occupies one row showing outcome text, RAG status, evidence count or reason requirement, and a chevron.
- `+ Add outcome` adds a new row to the active quarter.
- Clicking an outcome row expands its detail panel immediately below that row.
- Only one outcome detail panel within a section is expanded at a time.

Expanded detail panel:

- Outcome title.
- Three direct RAG controls: Green, Yellow, and Red.
- Status-change reason, shown and required only when RAG differs from the saved status.
- Evidence list with add/remove actions, retaining the current maximum of three evidence references.
- Delete outcome action with confirmation.

Advanced section settings:

- Section visibility, category override, override reason, and other administrative settings move behind a section `···` settings action.
- Manual category override remains optional and retains its current validation.
- Bottom phase labels remain in a separate advanced roadmap-settings area.
- Project evidence and project mapping data remain compatible with the current saved structure.

## Data and State Compatibility

- Existing `executiveMilestoneTimeline.rows[].cells[]` outcomes remain valid.
- Existing `sectionId`, `audience`, `manualHealth`, `statusReason`, status audit fields, and evidence sources are preserved.
- Expanded/collapsed editor state is transient UI state and is not saved to Firebase.
- The active roadmap view tab is local UI state and does not alter roadmap data.
- Released weeks stay read-only. The new editor must not bypass `assertCurrentWeekEditable()` or existing role checks.

## Error Handling

- Project PDF cleanup must run after successful printing or print cancellation.
- A missing selected project must not fall back to Overview printing.
- A changed RAG without a reason must block saving and focus the relevant reason field.
- Invalid or missing evidence references continue to display as needing relink rather than deleting historical data.
- Advanced section settings must keep existing validation messages for manual override reasons.

## Verification

Automated tests will verify:

- Project PDF mode shows only the selected project article and does not activate Overview print selection.
- The project export control is icon-only with the correct tooltip and accessible label.
- Milestone row drag starts only from its handle, while input text remains selectable.
- No other manual input container is incorrectly draggable.
- The roadmap renders one title hierarchy, two view tabs, and one contextual edit action.
- The duplicate visible roadmap headings and duplicate edit actions are removed.
- The IoE editor renders compact rows and expands one inline detail panel.
- Status reasons remain required only for changed RAG values.
- Existing role visibility, release locking, evidence preservation, and executive outcome normalization tests continue to pass.

Manual browser checks will cover project PDF preview, Overview PDF export, text selection in every editor section, responsive layout, keyboard focus, and save/reopen consistency.

## Out of Scope

- Automatic PDF file download without the browser print dialog.
- Redesigning project milestone data or executive RAG calculation.
- Changing Firebase authentication, Firestore security rules, or deployment workflow.
- Adding new executive sections or changing existing section permissions.
