const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const functionsRoot = path.resolve(__dirname, '..');
const read = file => readFileSync(path.join(functionsRoot, file), 'utf8');

test('defines all Executive milestone callable handlers', () => {
  const source = read('executive-milestones.js');
  for (const name of [
    'addExecutiveMilestoneUpdate',
    'createExecutiveMilestoneChangeRequest',
    'decideExecutiveMilestoneChangeRequest',
    'applyDirectExecutiveMilestoneChange',
    'setExecutiveRagOverride',
    'saveExecutiveMilestoneTimelineConfig',
    'withdrawExecutiveMilestoneChangeRequest',
  ]) {
    assert.match(source, new RegExp(`const\\s+${name}\\s*=\\s*onCall`), name);
  }
});

test('defines and exports a requester-only Executive change withdrawal callable', () => {
  const source = read('executive-milestones.js');
  assert.match(source, /const\s+withdrawExecutiveMilestoneChangeRequest\s*=\s*onCall/);
  assert.match(source, /Only the requester can withdraw this change request/);
  assert.match(source, /state:\s*'withdrawn'/);
  assert.match(source, /withdrawnAt:/);
  assert.match(source, /withdrawnBy:/);
  assert.match(read('index.js'), /exports\.withdrawExecutiveMilestoneChangeRequest\s*=\s*executiveMilestones\.withdrawExecutiveMilestoneChangeRequest/);
});

test('authenticates from the token email and reloads the actor role in each transaction', () => {
  const source = read('executive-milestones.js');
  assert.match(source, /request\.auth\.token\.email/);
  assert.match(source, /collection\(['"]users['"]\)\.doc\(email\)/);
  assert.match(source, /transaction\.get\(userRef\)/);
  assert.match(source, /normalizeRole\(userSnapshot\.data\(\)\.role/);
  assert.match(source, /db\.runTransaction/g);
  assert.doesNotMatch(source, /allowVipBridge:\s*true/);
});

test('keeps weekly snapshots and append-only records in atomic transactions', () => {
  const source = read('executive-milestones.js');
  assert.match(source, /executiveMilestoneTimeline/);
  assert.match(source, /executiveMilestoneUpdates/);
  assert.match(source, /executiveMilestoneChangeRequests/);
  assert.match(source, /executiveMilestoneAudit/);
  assert.match(source, /transaction\.update\(weekRef/);
  assert.match(source, /lastModifiedBy:\s*actor(?:Email|\.email)/);
  assert.match(source, /transaction\.create\(updateRef/);
  assert.match(source, /transaction\.create\(requestRef/);
  assert.match(source, /transaction\.create\(auditRef/);
  assert.match(source, /snapshot\.data\(\)\.isReleased\s*===\s*true/);
  assert.match(source, /Released reporting weeks cannot be changed/);
});

test('reloads live timeline configuration for every Executive mutation', () => {
  const source = read('executive-milestones.js');
  assert.match(source, /collection\(['"]executiveMilestoneConfig['"]\)\.doc\(['"]timeline['"]\)/);
  assert.match(source, /normalizeTimelineConfig/);
  assert.match(source, /configVersion/);
  assert.match(source, /config,\s*$/m);
});

test('defines a version-checked timeline configuration change with audit', () => {
  const source = read('executive-milestones.js');
  assert.match(source, /saveExecutiveMilestoneTimelineConfig/);
  assert.match(source, /timeline-config-change/);
  assert.match(source, /expectedVersion/);
  assert.match(source, /Only Admin or Executive Owner can edit timeline settings/);
});

test('exports every callable beside presence aggregation', () => {
  const source = read('index.js');
  assert.match(source, /aggregatePresenceSessions/);
  for (const name of [
    'addExecutiveMilestoneUpdate',
    'createExecutiveMilestoneChangeRequest',
    'decideExecutiveMilestoneChangeRequest',
    'applyDirectExecutiveMilestoneChange',
    'setExecutiveRagOverride',
    'saveExecutiveMilestoneTimelineConfig',
    'withdrawExecutiveMilestoneChangeRequest',
  ]) {
    assert.match(source, new RegExp(`exports\\.${name}\\s*=\\s*executiveMilestones\\.${name}`), name);
  }
});
