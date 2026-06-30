# Project Detail Layout and Attention Sync Design

Date: 2026-06-30  
Target: PM Dashboard v2.0T, `team-2`  
Baseline: `361ac4a`

## Goal

Improve the readability of the Single Project page and restore editable Attention Matrix behavior for unreleased weeks. Keep released-week data immutable and make Project Portfolio order follow the Attention Matrix classification.

## Scope

### Single Project page

1. Keep the upper section focused on:
   - basic project information;
   - Highlight;
   - Milestone Roadmap;
   - Resources.
2. Move Schedule/Gantt out of the upper two-column layout into a separate full-width block below it.
3. Place Quarterly Milestones in a separate full-width block below the Gantt.
4. Display Quarterly Milestones as four horizontal columns: Q1, Q2, Q3, and Q4 for the report year.
5. Preserve the existing Week/Month Gantt view switch, scrolling, workstream content, and status/progress presentation.
6. On narrow screens, the four quarter columns may wrap or scroll horizontally, but their Q1-to-Q4 order must remain unchanged.

### Overview page

1. For an unreleased Draft week, allow an authorized user to change a project's Attention Matrix classification using:
   - drag and drop between quadrants;
   - the existing classification dropdown.
2. Released weeks remain read-only. Drag handles, drop targets, and editable classification controls must not be enabled for released data.
3. Preserve the current VIP/read-only permission behavior in addition to the released-week lock.
4. After a successful drag/drop or dropdown change:
   - update the Attention Matrix immediately;
   - reorder Project Portfolio immediately without a page reload.
5. Sort Project Portfolio by this fixed classification priority:
   1. Executive Action
   2. Strategic Watch
   3. Monitor Closely
   4. Keep Watching
6. Preserve the original project order within the same classification. The sort must therefore be stable.
7. Projects with missing or unrecognized classifications appear after the four defined groups, while retaining their relative order.

## Design

### Single Project layout

The project detail renderer will use three vertically stacked regions:

1. Upper detail region: existing project summary, Highlight, Milestone Roadmap, and Resources.
2. Full-width Gantt region: Schedule heading, workstream count, Week/Month switch, and timeline.
3. Full-width Quarterly Milestones region: four equal quarter columns in Q1-to-Q4 order.

The Gantt and Quarterly Milestones are no longer children of the narrow right column. Their content and data model do not change; only their placement and responsive styling change.

### Attention editing

The existing editability rule remains the source of truth:

- editable only when the current week is not released and the current perspective/role permits editing;
- otherwise render the matrix as read-only.

Both dropdown and drag/drop actions will use the same attention-update path. The update must preserve the current week's other nested data and must respect release/version protection. On success, the page rerenders from the updated state. On failure, the prior classification remains visible and the existing error-feedback pattern is used.

### Portfolio ordering

Introduce one pure, stable ordering helper that maps the four classifications to numeric ranks. Project Portfolio consumes the ordered copy; the underlying project collection is not destructively reordered. This keeps the display rule isolated and prevents unrelated views or saved project order from changing.

## Data and Compatibility

- No schema change or data migration is required.
- No project relationships are introduced.
- No changes are made to the physical quadrant arrangement of the Attention Matrix.
- Existing week release, account, authorization, and version-lock behavior remains in force.
- Existing project details, milestones, schedule, quarterly milestones, and resource data remain compatible.

## Error Handling

- Reject attention changes if the week becomes released or the stored version changes before persistence completes.
- Do not leave the UI showing an unsaved classification after a failed update.
- Empty quarterly data still renders Q1-to-Q4 headings with an empty-state message in the relevant quarter.
- An empty schedule renders the existing empty state inside the new full-width Gantt region.

## Verification

### Automated

1. Layout structure test confirms Gantt and Quarterly Milestones are outside the upper detail grid.
2. Quarterly renderer test confirms Q1-to-Q4 ordering.
3. Portfolio ordering tests cover:
   - all four priority groups;
   - stable order within a group;
   - missing or unknown classifications last.
4. Attention editability tests confirm:
   - Draft week allows authorized drag/drop and dropdown changes;
   - Released week remains read-only;
   - VIP/read-only perspective remains read-only.
5. Interaction tests confirm both edit methods rerender Matrix and Portfolio after successful persistence and revert on failure.
6. Run the complete existing test suite.

### Browser

Verify in the local `team-2` page at desktop and narrow widths:

1. Single Project upper section remains readable.
2. Gantt is a separate full-width horizontal block.
3. Quarterly Milestones appears below it in Q1-to-Q4 order.
4. Draft Attention Matrix supports drag/drop and dropdown changes.
5. Released Attention Matrix cannot be modified.
6. Project Portfolio immediately follows the required priority order after a Draft-week change.

## Deployment

Implement and validate on v2.0T `team-2` first. Deployment to production v2.0 is outside this change until the UAT result is reviewed and explicitly approved.
