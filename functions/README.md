# Firebase Functions

The v2.1 client writes login sessions to `presenceSessions`. The scheduled
`aggregatePresenceSessions` function converts closed or timed-out sessions into
daily per-user documents in `presenceDailyRollups`.

## Executive milestone callables

- `addExecutiveMilestoneUpdate`
- `createExecutiveMilestoneChangeRequest`
- `decideExecutiveMilestoneChangeRequest`
- `applyDirectExecutiveMilestoneChange`
- `setExecutiveRagOverride`

Each callable reloads the authenticated user's role inside its transaction. Released weeks are immutable. Update history, change requests, and audit records are client read-only.

## Deploy

1. Install the Firebase CLI and authenticate to the Firebase project.
2. From the repository root, run:

   ```powershell
   firebase use project-manager-dashboar-a067f
   firebase deploy --only functions:aggregatePresenceSessions,functions:addExecutiveMilestoneUpdate,functions:createExecutiveMilestoneChangeRequest,functions:decideExecutiveMilestoneChangeRequest,functions:applyDirectExecutiveMilestoneChange,functions:setExecutiveRagOverride
   firebase deploy --only firestore:rules
   firebase deploy --only firestore:indexes
   ```

3. In Google Cloud Firestore, create a TTL policy for collection group
   `presenceSessions` using the timestamp field `expiresAt`.

   ```powershell
   gcloud firestore fields ttls update expiresAt `
     --collection-group=presenceSessions `
     --project=project-manager-dashboar-a067f `
     --enable-ttl
   ```

Session detail is retained for 90 days. Daily rollups do not contain an
`expiresAt` field and are therefore retained.

## Required access

Authenticated users need permission to create and update their own
`presenceSessions` document. Admin users need read access to session history.
Only the Admin SDK used by this function should write `presenceDailyRollups`.

## Role migration before UAT

In Firebase Console, update the designated department-head account from `vip` to `executive`. Verify no account retains `business`; use `sales` or `bd`. The application intentionally has no permanent compatibility alias and no browser-based role migration.

Approval email configuration and delivery are not part of v2.2T Phase 1.

## Visibility architecture blocker

The current `weeks` document embeds all Executive sections. Firestore Rules can protect whole documents, but cannot return a field-filtered version to PM or Engineering. The UI applies the approved visibility matrix; it must not be treated as server-enforced confidentiality until the three sections move to independently protected documents or are served through an equivalent filtered backend read model. The schema also lacks a protected active-week marker, so callables reject released weeks but cannot distinguish the current draft from an older unreleased draft. Keep this candidate undeployed to restricted-role users until both migrations are complete.
