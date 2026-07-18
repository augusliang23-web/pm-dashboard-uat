# PM Dashboard

DCDC portfolio and weekly status dashboard. The `v2.2T` branch is the test candidate for Executive milestone governance.

## v2.2T role rollout

Supported roles are `admin`, `executive` (shown as Executive Owner), `pm`, `engineering`, `sales`, `bd`, and `product`. Unknown roles fail closed.

Before preview UAT, use Firebase Console to update the department-head user document from `role: 'vip'` to `role: 'executive'`. Confirm there are no `business` role documents; assign `sales` or `bd` explicitly where required. This repository does not automate user-role writes.

- Admin and Executive Owner can view and update all three Executive milestone sections and make audited structural changes directly.
- PM and Engineering can view and update only IoE Product Portfolio.
- Sales, BD, and Product can view all sections and update only Customer Engagements.
- Non-leadership structural edits are submitted to the in-dashboard Executive Owner approval inbox.

Phase 1 does not configure or send approval email. The single Executive approval mailbox remains deferred.

## Security and deployment handoff

Client authorization checks are defense-in-depth. Before UAT, verify and deploy Firestore Security Rules together with the included Functions and Firestore indexes; callable Functions authorize every Executive mutation and Rules deny direct client writes. See `functions/README.md` for commands.

Deployment blockers: the current `weeks` schema embeds all three Executive sections in one document. Firestore Security Rules cannot redact individual fields from a readable document, so the role-based section visibility is enforced by the dashboard UI but is not yet a confidentiality boundary against direct API reads. The schema also has no authoritative active-week marker; callables reject released weeks, but cannot distinguish the current draft from an older unreleased draft. Do not expose v2.2T to restricted-role users until the Executive sections are migrated to separately protected documents (or an equivalent server-filtered read model) and mutations validate a protected active-week setting.

## Vendored dependencies

`team-2/vendor/xlsx.full.min.js` is SheetJS CE 0.20.3 from `https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js`. SHA-256: `CC015130AA8521E7F088F88898EBA949CCDCBFB38DF0BD129B44B7273C3A6F41`.
