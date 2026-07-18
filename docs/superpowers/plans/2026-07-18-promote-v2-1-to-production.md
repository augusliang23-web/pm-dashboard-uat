# Promote v2.1 to Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fast-forward the original PM production dashboard from v2.0 to the complete tested v2.1 release and verify the deployed production URL.

**Architecture:** Reuse the existing isolated Git worktree on `codex/v2.1-release`, verify that the latest `origin/main` is its ancestor, and treat its exact head as the production candidate. Verify the candidate locally, push it to `origin/main` without force, and validate both the GitHub Pages workflow and live production page.

**Tech Stack:** Git, PowerShell, Node.js test runner, npm, GitHub Pages, browser-based deployment verification

## Global Constraints

- Preserve the existing production URL, Firebase project, stored dashboard data, and deployment configuration.
- Do not write to Firestore, alter authentication users, or migrate dashboard documents.
- Do not force-push.
- Stop if `origin/main` gains a commit that is not an ancestor of the release branch.
- The promoted dashboard must declare and display `v2.1`.
- The rollback reference before promotion is `f3ce075b3a24e8aaf8bb60181c83a56497072986`.

---

### Task 1: Verify the isolated production promotion worktree

**Files:**
- Reference: `docs/superpowers/specs/2026-07-18-promote-v2-1-to-production-design.md`
- Reference: `index.html`

**Interfaces:**
- Consumes: `origin/main`, `codex/v2.1-release`, Git worktree metadata
- Produces: verified clean candidate on `codex/v2.1-release` in `.worktrees/v2.1-release`

- [ ] **Step 1: Fetch both release remotes and verify ancestry**

Run:

```powershell
git fetch --prune origin
git fetch --prune v21
git merge-base --is-ancestor origin/main codex/v2.1-release
git rev-parse origin/main
git rev-parse codex/v2.1-release
```

Expected: every command exits `0`; `origin/main` remains an ancestor of `codex/v2.1-release`.

- [ ] **Step 2: Verify the existing isolated release worktree**

Run inside `.worktrees/v2.1-release`:

```powershell
$gitDir = git rev-parse --git-dir
$gitCommon = git rev-parse --git-common-dir
$branch = git branch --show-current
"GIT_DIR=$gitDir"
"GIT_COMMON=$gitCommon"
"BRANCH=$branch"
```

Expected: `GIT_DIR` and `GIT_COMMON` differ and the branch is `codex/v2.1-release`, proving the candidate is already isolated from the dirty primary workspace.

- [ ] **Step 3: Verify the isolated branch is the approved release candidate**

Run inside `.worktrees/v2.1-release`:

```powershell
git merge-base --is-ancestor origin/main HEAD
git diff --check origin/main...HEAD
git status --short --untracked-files=no
```

Expected: ancestry and diff checks exit `0`; there are no tracked uncommitted changes. Known ignored or pre-existing untracked development artifacts are not part of the candidate tree.

### Task 2: Verify the exact production candidate

**Files:**
- Verify: `index.html`
- Verify: `js/list-editor.mjs`
- Verify: `tests/*.test.mjs`
- Verify: `pdf-service/test/*.test.mjs`

**Interfaces:**
- Consumes: production candidate at `codex/v2.1-release`
- Produces: recorded root, PDF, Team 2 baseline, release-marker, and Git integrity evidence

- [ ] **Step 1: Verify the v2.1 release markers and promoted feature wiring**

Run:

```powershell
rg -n "DASHBOARD_RELEASE = 'v2.1'|<span class=\"hdr-version\">v2.1</span>|./js/list-editor.mjs|project-risk-table-wrap" index.html
```

Expected: all four required markers are present.

- [ ] **Step 2: Run the complete root dashboard suite**

Run:

```powershell
node --test *.test.mjs *.test.cjs tests/*.test.mjs
```

Expected: exit `0` with no failed tests.

- [ ] **Step 3: Run the complete PDF service suite**

Run from `pdf-service`:

```powershell
npm.cmd test
```

Expected: exit `0` with no failed tests.

- [ ] **Step 4: Record the isolated Team 2 baseline**

Run:

```powershell
node --test team-2/*.test.mjs team-2/*.test.cjs
```

Expected: the known legacy `team-2/trend-summary.test.cjs` string assertion may remain the only failure; no additional Team 2 failure is acceptable.

- [ ] **Step 5: Reconfirm candidate integrity immediately before publishing**

Run:

```powershell
git fetch origin
git merge-base --is-ancestor origin/main HEAD
git diff --check origin/main...HEAD
git status --short --untracked-files=no
```

Expected: `origin/main` is still an ancestor, the diff check exits `0`, and there are no tracked uncommitted changes.

### Task 3: Publish the fast-forward release

**Files:**
- Publish: complete Git tree at `codex/v2.1-release`

**Interfaces:**
- Consumes: fully verified production candidate
- Produces: `origin/main` pointing to the exact candidate commit

- [ ] **Step 1: Record the candidate and rollback commits**

Run:

```powershell
$candidate = git rev-parse HEAD
$rollback = git rev-parse origin/main
"CANDIDATE=$candidate"
"ROLLBACK=$rollback"
```

Expected: candidate is the release-branch head and rollback is the pre-promotion production commit or a later verified ancestor.

- [ ] **Step 2: Push without force**

Run:

```powershell
git push origin HEAD:main
```

Expected: a normal fast-forward update succeeds.

- [ ] **Step 3: Verify the remote branch**

Run:

```powershell
$candidate = git rev-parse HEAD
$remote = (git ls-remote origin refs/heads/main).Split()[0]
if ($remote -ne $candidate) { throw "origin/main does not match the production candidate" }
```

Expected: command exits `0` and both commits match.

### Task 4: Verify GitHub Pages and the original production URL

**Files:**
- Verify remotely: `https://augusliang23-web.github.io/pm-dashboard/`

**Interfaces:**
- Consumes: deployed `origin/main` commit
- Produces: workflow, HTTP, DOM, responsive CSS, and browser-error evidence

- [ ] **Step 1: Wait for the Pages workflow for the candidate commit**

Run bounded GitHub API checks against:

```text
https://api.github.com/repos/augusliang23-web/pm-dashboard/actions/runs?per_page=10
```

Expected: `pages build and deployment` reports `completed` and `success` for the exact candidate SHA.

- [ ] **Step 2: Verify the deployed HTML with a candidate cache buster**

Fetch:

```text
https://augusliang23-web.github.io/pm-dashboard/?v=<candidate-short-sha>
```

Expected: HTTP `200`; HTML contains `DASHBOARD_RELEASE = 'v2.1'`, `<span class="hdr-version">v2.1</span>`, `./js/list-editor.mjs`, and `project-risk-table-wrap`.

- [ ] **Step 3: Inspect the live page at desktop and 700 px widths**

Use the in-app browser to verify:

```text
Desktop: title loads, v2.1 markers and paired preview markup are present.
700 px: the max-width 760 px rule is active, Risk/Action editors stack, toolbar buttons wrap, and labels remain visible.
Console: no page errors.
```

Expected: every check passes without authentication writes or data mutations.

- [ ] **Step 4: Preserve the auditable rollback point**

Record in the completion report:

```text
Pre-promotion production commit: f3ce075b3a24e8aaf8bb60181c83a56497072986
Promoted production commit: <candidate-sha>
```

Expected: both SHAs are included in the handoff along with the verified production URL.
