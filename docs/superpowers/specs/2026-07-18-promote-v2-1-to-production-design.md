# Promote v2.1 to the Production Dashboard Design

## Objective

Promote the fully tested v2.1 dashboard currently published from `v21/main` to the original production repository used by PMs at `origin/main`, while preserving the existing production URL, Firebase project, stored dashboard data, and deployment configuration.

## Current State

- Production remote: `origin` (`augusliang23-web/pm-dashboard`)
- Production branch: `origin/main` at `f3ce075b3a24e8aaf8bb60181c83a56497072986`
- Approved v2.1 release: `v21/main` at `52c218160949f9a1c6ca54ea13e513381931ae62`
- `origin/main` is an ancestor of `v21/main`, so the promotion can use a normal fast-forward update without force-pushing or resolving a merge conflict.
- The v2.1 dashboard already declares `DASHBOARD_RELEASE = 'v2.1'` and displays the `v2.1` header badge.

## Promotion Design

Create an isolated release worktree from the latest `origin/main`, fast-forward it to the approved v2.1 release history, and verify the merged result before publishing. Push the verified release commit to `origin/main` using a non-force push.

The promotion includes the complete v2.1 release history rather than cherry-picking only the latest list-editor commits. This preserves all features and dependencies that were tested together on the v2.1 site, including the structured PM list editor, responsive Risk/Action inputs, paired Single Project preview, PDF updates, security fixes, and earlier v2.1 improvements.

## Production Data and Configuration

The release changes repository files only. It must not write to Firestore, alter authentication users, migrate dashboard documents, or change the Firebase project configuration. The existing production URL and repository identity remain unchanged.

No force push is allowed. Immediately before publishing, verify that `origin/main` still points to the inspected production commit or remains an ancestor of the release commit. If an unexpected production commit appears, stop and reassess instead of overwriting it.

## Verification

Before publishing:

1. Confirm the release worktree has no tracked uncommitted changes.
2. Confirm the production branch can fast-forward to the release commit.
3. Run the full root dashboard test suite.
4. Run the PDF service test suite.
5. Record any pre-existing isolated Team 2 baseline failure separately; it must not be introduced or changed by this promotion.
6. Confirm the release marker and header badge both display `v2.1`.

After publishing:

1. Confirm `origin/main` equals the promoted release commit.
2. Confirm the GitHub Pages deployment completes successfully for that commit.
3. Fetch the original production URL with a commit-based cache buster and verify it contains the v2.1 release marker, list-editor module, and paired Risk/Action preview markup.
4. Inspect the deployed page in a browser at desktop and 700 px widths and confirm there are no page errors.

## Rollback

The pre-promotion production commit is `f3ce075b3a24e8aaf8bb60181c83a56497072986`. If the promoted site fails deployment verification, do not rewrite shared history automatically. Report the failure and use an explicit revert commit or a user-approved rollback procedure so the recovery remains auditable.

## Success Criteria

- The original PM production URL continues to work.
- The header identifies the dashboard as v2.1.
- The production repository contains the same tested v2.1 functionality as the dedicated v2.1 site.
- Root and PDF tests pass on the exact promoted commit.
- The deployed page exposes the structured list editor and paired Risk/Action preview without browser console errors.
