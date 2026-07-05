# Team Effort Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display member count, average allocation, and FTE on every project card.

**Architecture:** Add a pure `summarizeTeamEffort` helper to `portfolio-core.mjs`, cover it with unit tests, and use its formatted values in the existing project-card renderer.

**Tech Stack:** JavaScript ES modules, Node test runner, HTML template rendering.

---

### Task 1: Add and use the team-effort summary

**Files:**
- Modify: `tests/portfolio-core.test.mjs`
- Modify: `team-2/js/portfolio-core.mjs`
- Modify: `team-2/index.html`

- [ ] **Step 1: Write the failing test**

Import `summarizeTeamEffort` and assert that fifteen allocations totaling 1470 produce `{ memberCount: 15, averagePct: 98, fte: 14.7 }`; also assert the empty-team result.

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/portfolio-core.test.mjs`

Expected: FAIL because `summarizeTeamEffort` is not exported.

- [ ] **Step 3: Implement the pure helper**

Normalize invalid allocation values to zero, calculate the sum, rounded average, and one-decimal FTE, then export the result.

- [ ] **Step 4: Update the project-card renderer**

Import the helper and replace the summed percentage with:

```text
{memberCount} members · Avg {averagePct}% · {fte} FTE
```

- [ ] **Step 5: Verify**

Run: `node --test`

Expected: all tests pass.

- [ ] **Step 6: Commit**

Commit the focused display change and its tests.
