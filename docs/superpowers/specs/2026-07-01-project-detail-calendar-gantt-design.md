# Project Detail Layout and Calendar Gantt Design

Date: 2026-07-01  
Target: PM Dashboard v2.0T, `team-2`  
Baseline: `0cd9e43`

## Goal

Improve the Single Project page hierarchy and make the Gantt time scale self-explanatory without changing project data.

## Scope

1. Remove the One-page Status button from the Single Project header.
2. Use a two-column upper region on desktop:
   - left two-thirds: project information and narrative;
   - right one-third: RAG, Progress, and Milestone Roadmap.
3. Move every section currently below Milestone Roadmap out of the right column.
4. Arrange the lower full-width sections in this order:
   1. Gantt;
   2. Quarterly Milestones;
   3. Resources;
   4. Team & Effort and Budget Snapshot.
5. Replace the current Gantt scale display with a two-level calendar axis.

## Single Project Layout

### Header

- Keep the project name, project code, and close button.
- Remove the One-page Status button.
- Removing the button does not change stored project data.

### Upper region

The desktop grid uses a 2:1 ratio:

- Left column:
  - Owner, Deputy, Customer, and Location;
  - Highlight;
  - Weekly Key Actions;
  - Risk / Blocker;
  - Risk Required Actions.
- Right column:
  - RAG badge;
  - Progress;
  - Milestone Roadmap.

Resources, Team & Effort, and Budget Snapshot must not remain inside the right column.

At the existing responsive breakpoint, the upper region becomes one column. Narrative remains before the Milestone panel.

### Lower region

Use four vertically stacked full-width sections:

1. Schedule/Gantt.
2. Quarterly Milestones with Q1-to-Q4 horizontal columns.
3. Resources table.
4. A two-column resource summary containing Team & Effort and Budget Snapshot.

Team & Effort and Budget Snapshot collapse to one column at narrow widths.

## Calendar Gantt

### Root cause addressed

The current date labels are generated from week or month ticks, but row backgrounds are divided into ten fixed visual segments. Because the lines and labels describe different intervals, users cannot reliably interpret the scale.

### Axis model

Introduce a pure calendar-axis helper that receives the earliest workstream date, latest workstream date, and selected scale. It returns:

- aligned axis start and exclusive axis end;
- lower-level ticks;
- upper-level calendar groups;
- formatted date-range text;
- scale guidance text.

The same tick positions drive both header labels and vertical lines in every workstream row. The fixed ten-segment background is removed.

### Weekly view

- Control label: `Weekly view`.
- Axis begins on the Monday on or before the earliest workstream date.
- Axis ends on the Monday after the final displayed week.
- Lower row: one cell per week, labelled in the form `W27 · Jul 6`.
- Upper row: month groups spanning the visible weekly cells.
- Guidance: `Each grid column represents one calendar week.`

### Monthly view

- Control label: `Monthly view`.
- Axis begins on the first day of the earliest month.
- Axis ends on the first day of the month after the latest workstream date.
- Lower row: one cell per month, labelled `Jul`, `Aug`, and so on.
- Upper row: year groups spanning the visible month cells.
- Guidance: `Each grid column represents one calendar month.`

### Shared behavior

- Show the actual schedule range beside the scale controls.
- Use `aria-pressed` on the scale buttons.
- Preserve workstream bars, status colors, progress labels, linked milestone diamonds, and the Today line.
- Calculate bars and markers against the aligned calendar axis.
- Give weekly cells enough minimum width to read their labels and monthly cells enough minimum width to identify the month.
- Use horizontal scrolling when the calendar requires more width than the modal.
- An empty schedule still shows the scale controls, guidance, and the existing empty-state message.

## Data and Compatibility

- No Firestore schema change.
- No migration.
- No changes to Project Editor schedule fields.
- No changes to Overview, Attention Matrix, or Project Portfolio.
- Existing project, resource, budget, milestone, and quarterly milestone data remain compatible.

## Error and Edge Handling

- Ignore undated or invalid workstream rows using the current validation behavior.
- If no valid dated rows remain, render the empty state without attempting calendar calculations.
- Calendar calculations use UTC to avoid locale and daylight-saving shifts.
- ISO week labels must handle year boundaries correctly.
- A one-week or one-month schedule still renders one readable calendar cell.

## Verification

### Automated

1. Confirm the One-page Status button is absent from the Single Project header.
2. Confirm the upper grid uses a 2:1 desktop ratio and preserves the existing one-column breakpoint.
3. Confirm Resources, Team & Effort, and Budget Snapshot appear after the Gantt and Quarterly sections in the required order.
4. Test weekly axis alignment, Monday boundaries, ISO week labels, month grouping, and year-boundary behavior.
5. Test monthly axis alignment, month labels, and year grouping.
6. Confirm Gantt rows render vertical lines from the same tick model as the header.
7. Confirm `Weekly view` and `Monthly view` controls expose `aria-pressed`.
8. Run the complete existing test suite.

### Browser

1. Open a project with dated workstreams and verify the 2:1 upper layout.
2. Confirm Milestone remains on the right and no Resources content remains beneath it.
3. Confirm the lower section order.
4. Switch between Weekly view and Monthly view and verify that labels, groups, lines, bars, milestones, and Today remain aligned.
5. Verify horizontal scrolling and stacked layout at narrow widths.
6. Confirm there are no browser console errors.

## Deployment

Implement and validate on v2.0T `team-2` first. Production v2.0 remains unchanged until UAT review and explicit approval.
