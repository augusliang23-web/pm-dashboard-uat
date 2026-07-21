import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dashboards = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../team-2/index.html', import.meta.url), 'utf8'),
]);

test('both dashboards retain defaults while using configuration-driven Executive governance helpers', () => {
  for (const dashboard of dashboards) {
    for (const label of ['IoE Product Portfolio', 'Customer Engagements', 'Investors & Strategy']) {
      assert.match(dashboard, new RegExp(label.replace('&', '&(?:amp;)?')));
    }
    assert.match(dashboard, /canViewConfiguredSection/);
    assert.match(dashboard, /canUpdateConfiguredSection/);
    assert.match(dashboard, /calculateVisibleExecutiveRag/);
  }
});

test('both dashboards load configurable Executive timeline axes and remove the old editor entry point', () => {
  for (const dashboard of dashboards) {
    assert.match(dashboard, /executive-timeline-config\.mjs/);
    assert.match(dashboard, /executiveMilestoneConfig/);
    assert.match(dashboard, /DEFAULT_EXECUTIVE_TIMELINE_CONFIG/);
    assert.doesNotMatch(dashboard, /Edit Quarterly Milestones/);
  }
});

test('Admin and Executive Owner can manage configurable labels and role policy from the timeline', () => {
  for (const dashboard of dashboards) {
    assert.match(dashboard, /Timeline settings/);
    assert.match(dashboard, /id="executiveTimelineSettingsOverlay"/);
    assert.match(dashboard, /window\.openExecutiveTimelineSettings =/);
    assert.match(dashboard, /executiveApi\.saveTimelineConfig/);
    assert.match(dashboard, /expectedVersion/);
    assert.match(dashboard, /viewRoles/);
    assert.match(dashboard, /updateRoles/);
  }
});

test('compact roadmap items separate RAG from neutral update-record metadata', () => {
  for (const dashboard of dashboards) {
    assert.match(dashboard, /data-executive-item-id=/);
    assert.match(dashboard, /class="executive-compact-item/);
    assert.match(dashboard, /executive-compact-title/);
    assert.match(dashboard, /executive-compact-update/);
    assert.match(dashboard, /latestStatusText/);
    assert.match(dashboard, /latestStatusAt/);
    assert.match(dashboard, /latestStatusBy/);
    assert.match(dashboard, /getExecutiveUpdateFreshness/);
    assert.match(dashboard, /executive-update-record/);
    assert.match(dashboard, /Update record/);
    assert.match(dashboard, /No update recorded/);
    assert.match(dashboard, /Refresh requested/);
    assert.match(dashboard, /Please refresh/);
    assert.match(dashboard, /freshness of the leadership status update only/);
    assert.doesNotMatch(dashboard, /freshnessLabel = freshness === 'overdue'/);
  }
});

test('roadmap renders section and quarter RAG after filtering hidden rows', () => {
  for (const dashboard of dashboards) {
    const renderStart = dashboard.indexOf('function renderExecutiveQuarterMilestones(');
    const renderEnd = dashboard.indexOf('function renderProjectQuarterItems(', renderStart);
    const source = dashboard.slice(renderStart, renderEnd);
    assert.ok(source.indexOf('.filter(row => canViewExecutiveSection(row))') >= 0);
    assert.ok(source.indexOf('calculateExecutiveSectionRag(') > source.indexOf('.filter(row => canViewExecutiveSection(row))'));
    assert.ok(source.indexOf('calculateExecutiveQuarterRag(') > source.indexOf('.filter(row => canViewExecutiveSection(row))'));
    assert.match(source, /dcdc-section-rag/);
    assert.match(source, /dcdc-quarter-rag/);
  }
});

test('focused drawer supports permission-aware RAG and monthly updates', () => {
  for (const dashboard of dashboards) {
    assert.match(dashboard, /id="executiveItemDrawerOverlay"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="executiveItemDrawerTitle"/);
    assert.match(dashboard, /data-executive-rag="green"/);
    assert.match(dashboard, /data-executive-rag="yellow"/);
    assert.match(dashboard, /data-executive-rag="red"/);
    assert.match(dashboard, /id="executiveStatusUpdate"/);
    assert.match(dashboard, /id="executiveUpdateHistory"/);
    assert.match(dashboard, /Rename/);
    assert.doesNotMatch(dashboard, /Move to/);
    assert.match(dashboard, /Delete milestone/);
    assert.match(dashboard, /function renderExecutiveItemDrawer\(/);
    assert.match(dashboard, /window\.openExecutiveItemDrawer =/);
    assert.match(dashboard, /window\.saveExecutiveItemUpdate =/);
    assert.match(dashboard, /executiveApi\.addUpdate/);
  }
});

test('drawer guards auth identity and renders append-only history newest first', () => {
  for (const dashboard of dashboards) {
    assert.match(dashboard, /function isExecutiveUpdateSessionCurrent\(/);
    for (const field of ['authUid', 'authEmail', 'role', 'weekId', 'itemId', 'version']) {
      assert.match(dashboard, new RegExp(`${field}:`));
    }
    assert.match(dashboard, /collection\(db, 'executiveMilestoneUpdates'\)/);
    assert.match(dashboard, /orderBy\('createdAt', 'desc'\)/);
    assert.match(dashboard, /canUpdateConfiguredSection\(executiveTimelineConfig, currentRole/);
    assert.match(dashboard, /executive-drawer-read-only/);
    assert.match(dashboard, /@media \(max-width: 760px\)/);
    assert.match(dashboard, /await executiveApi\.addUpdate\([\s\S]*?isExecutiveUpdateSessionCurrent\(session, \{ requireVersion: false \}\)/);
  }
});

test('structural requests use contextual actions and retain an exact hidden diff', () => {
  for (const dashboard of dashboards) {
    assert.match(dashboard, /id="executiveChangeRequestOverlay"[^>]*role="dialog"/);
    assert.match(dashboard, /\+ Add milestone/);
    assert.match(dashboard, /id="executiveStructuralActions"/);
    assert.match(dashboard, /id="executiveStructuralTitle"/);
    assert.match(dashboard, /id="executiveStructuralSection"/);
    assert.match(dashboard, /id="executiveStructuralQuarter"/);
    assert.match(dashboard, /id="executiveStructuralReason"/);
    assert.match(dashboard, /id="executiveStructuralSummary"/);
    assert.doesNotMatch(dashboard, /id="executiveChangeIndex"/);
    assert.doesNotMatch(dashboard, /id="executiveChangeBefore"/);
    assert.doesNotMatch(dashboard, /id="executiveChangeAfter"/);
    assert.match(dashboard, /function openExecutiveStructuralAction\(/);
    assert.match(dashboard, /function buildExecutiveChangePayload\(/);
    assert.match(dashboard, /expectedVersion:/);
    assert.match(dashboard, /executiveApi\.createRequest/);
    assert.match(dashboard, /executiveApi\.applyDirectChange/);
  }
});

test('Executive milestones use a dedicated drag handle and confirm cross-grid moves before saving', () => {
  for (const dashboard of dashboards) {
    assert.match(dashboard, /data-executive-drag-item-id=/);
    assert.match(dashboard, /draggable="true"/);
    assert.match(dashboard, /data-executive-drop-section=/);
    assert.match(dashboard, /data-executive-drop-quarter=/);
    assert.match(dashboard, /document\.addEventListener\('dragstart'/);
    assert.match(dashboard, /document\.addEventListener\('dragover'/);
    assert.match(dashboard, /document\.addEventListener\('drop'/);
    assert.match(dashboard, /targetIndex/);
    assert.match(dashboard, /openExecutiveStructuralAction\(\{ action: 'move'/);
    assert.doesNotMatch(dashboard, /id="executiveMoveChangeBtn"/);
  }
});

test('cross-grid moves show read-only context and requesters can withdraw a pending request', () => {
  for (const dashboard of dashboards) {
    assert.match(dashboard, /id="executiveStructuralMoveContext"/);
    assert.match(dashboard, /const isMove = action === 'move'/);
    assert.match(dashboard, /executiveStructuralTitle'\)\.hidden\s*=\s*isMove/);
    assert.match(dashboard, /executiveStructuralSection'\)\.hidden\s*=\s*isMove/);
    assert.match(dashboard, /executiveStructuralQuarter'\)\.hidden\s*=\s*isMove/);
    assert.match(dashboard, /window\.withdrawExecutiveChangeRequest\s*=/);
    assert.match(dashboard, /Withdraw request/);
    assert.match(dashboard, /executiveApi\.withdrawRequest/);
    assert.match(dashboard, /#executiveChangeRequestOverlay \[hidden\] \{ display:none !important; \}/);
    assert.match(dashboard, /id="executiveViewMyRequestsBtn"/);
  }
});

test('Executive Owner inbox supports approve, reject, conflict, and Admin audit-only review', () => {
  for (const dashboard of dashboards) {
    assert.match(dashboard, /id="executiveApprovalInboxBtn"/);
    assert.match(dashboard, /id="executivePendingCount"/);
    assert.match(dashboard, /id="executiveApprovalInboxOverlay"[^>]*role="dialog"/);
    assert.match(dashboard, /window\.openExecutiveApprovalInbox =/);
    assert.match(dashboard, /window\.decideExecutiveChangeRequest =/);
    assert.match(dashboard, /executiveApi\.decideRequest/);
    assert.match(dashboard, /state === 'conflict'/);
    assert.match(dashboard, /currentRole === 'executive'/);
    assert.match(dashboard, /Admin audit-only/);
    assert.match(dashboard, /orderBy\('createdAt', 'desc'\),\s*limit\(100\)/);
    assert.doesNotMatch(dashboard, /executiveApprovalEmail|approvalMailbox|sendApprovalEmail/);
  }
});

test('Executive request inbox uses a notification bell with role-accurate labels', () => {
  for (const dashboard of dashboards) {
    assert.match(dashboard, /id="executiveApprovalInboxBtn"[\s\S]{0,400}?aria-label="Change notifications"/);
    assert.match(dashboard, /Approval requests/);
    assert.match(dashboard, /Admin audit-only/);
    assert.match(dashboard, /My change requests/);
    assert.doesNotMatch(dashboard, />✓<span id="executivePendingCount"/);
    assert.match(dashboard, /function isExecutiveChangeReviewer\(\)\s*\{[\s\S]{0,120}?\['admin', 'executive'\]\.includes\(currentRole\)/);
    assert.doesNotMatch(dashboard, /currentRole === 'pm'\) document\.getElementById\('executiveApprovalInboxBtn'\)/);
  }
});

test('move submission uses standard action buttons and leaves a visible result in the dialog', () => {
  for (const dashboard of dashboards) {
    assert.match(dashboard, /class="btn-primary" id="executiveSubmitChangeBtn"/);
    assert.match(dashboard, /class="btn-ghost" id="executiveChangeCancelBtn"/);
    assert.match(dashboard, /Change request submitted successfully/);
    assert.match(dashboard, /Unable to submit the change/);
  }
});

test('Admin and Executive Owner can set or remove audited summary RAG overrides', () => {
  for (const dashboard of dashboards) {
    assert.match(dashboard, /data-executive-rag-override=/);
    assert.match(dashboard, /id="executiveRagOverrideOverlay"/);
    assert.match(dashboard, /id="executiveRagOverrideReason"/);
    assert.match(dashboard, /executiveApi\.setRagOverride/);
    assert.match(dashboard, /Remove override/);
    assert.match(dashboard, /const canViewAllSections = executiveTimelineConfig\.sections\.every\([\s\S]{0,240}?leadershipOverride/);
  }
});

test('legacy strategy save cannot rewrite the Executive timeline', () => {
  for (const dashboard of dashboards) {
    assert.doesNotMatch(dashboard, /renderExecutiveMilestoneEditor\(layer\.executiveMilestoneTimeline\)/);
    assert.doesNotMatch(dashboard, /const executiveMilestoneTimeline = serializeExecutiveMilestoneTimeline\(\s*collectExecutiveMilestoneTimeline\(\)/);
    assert.match(dashboard, /const strategyLayer = \{\s*\.\.\.\(week\.strategyLayer \|\| \{\}\),\s*projectMap\s*\}/);
  }
});

test('production dashboards use final role names without a VIP runtime bridge', () => {
  for (const dashboard of dashboards) {
    assert.doesNotMatch(dashboard, /allowVipBridge:\s*true/);
    assert.doesNotMatch(dashboard, /vipPerspective/);
    assert.match(dashboard, /executivePerspective/);
  }
});
