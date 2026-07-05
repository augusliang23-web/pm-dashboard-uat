# Team Effort Summary Design

## Goal

Replace the misleading summed percentage on project cards with a readable staffing summary.

## Approved display

For projects with team members, show:

`15 members · Avg 98% · 14.7 FTE`

- `members`: number of team-member rows.
- `Avg`: arithmetic mean of valid per-member allocation percentages, rounded to the nearest whole percent.
- `FTE`: summed allocation divided by 100, displayed with one decimal place.
- Empty teams show `0 members · Avg 0% · 0.0 FTE`.

## Scope

Only the project-card display and its pure summary calculation change. Stored team allocation data, Project Editor behavior, resource reporting, and project progress remain unchanged.

## Verification

Unit-test the calculation and confirm the project card consumes the shared summary.
