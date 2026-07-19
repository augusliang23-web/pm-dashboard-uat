import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dashboards = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../team-2/index.html', import.meta.url), 'utf8'),
]);

test('both dashboards use the fixed Executive sections and governance helpers', () => {
  for (const dashboard of dashboards) {
    for (const label of ['IoE Product Portfolio', 'Customer Engagements', 'Investors & Strategy']) {
      assert.match(dashboard, new RegExp(label.replace('&', '&(?:amp;)?')));
    }
    assert.match(dashboard, /canViewExecutiveSectionByRole/);
    assert.match(dashboard, /canUpdateExecutiveSection/);
    assert.match(dashboard, /calculateVisibleExecutiveRag/);
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
    assert.match(dashboard, /Request structural change/);
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
    assert.match(dashboard, /canUpdateExecutiveSection\(currentRole/);
    assert.match(dashboard, /executive-drawer-read-only/);
    assert.match(dashboard, /@media \(max-width: 760px\)/);
    assert.match(dashboard, /await executiveApi\.addUpdate\([\s\S]*?isExecutiveUpdateSessionCurrent\(session, \{ requireVersion: false \}\)/);
  }
});

test('structural requests use an exact diff and approved change types', () => {
  for (const dashboard of dashboards) {
    assert.match(dashboard, /id="executiveChangeRequestOverlay"[^>]*role="dialog"/);
    for (const type of ['add', 'rename', 'move-section', 'move-quarter', 'reorder', 'delete']) {
      assert.match(dashboard, new RegExp(`value="${type}"`));
    }
    assert.match(dashboard, /id="executiveChangeBefore"/);
    assert.match(dashboard, /id="executiveChangeAfter"/);
    assert.match(dashboard, /id="executiveChangeReason"/);
    assert.match(dashboard, /function buildExecutiveChangePayload\(/);
    assert.match(dashboard, /executiveApi\.createRequest/);
    assert.match(dashboard, /executiveApi\.applyDirectChange/);
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

test('Admin and Executive Owner can set or remove audited summary RAG overrides', () => {
  for (const dashboard of dashboards) {
    assert.match(dashboard, /data-executive-rag-override=/);
    assert.match(dashboard, /id="executiveRagOverrideOverlay"/);
    assert.match(dashboard, /id="executiveRagOverrideReason"/);
    assert.match(dashboard, /executiveApi\.setRagOverride/);
    assert.match(dashboard, /Remove override/);
    assert.match(dashboard, /const canViewAllSections = EXECUTIVE_SECTIONS\.every\([\s\S]{0,240}?leadershipOverride/);
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
