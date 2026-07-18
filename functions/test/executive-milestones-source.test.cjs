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
  ]) {
    assert.match(source, new RegExp(`const\\s+${name}\\s*=\\s*onCall`), name);
  }
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

test('exports every callable beside presence aggregation', () => {
  const source = read('index.js');
  assert.match(source, /aggregatePresenceSessions/);
  for (const name of [
    'addExecutiveMilestoneUpdate',
    'createExecutiveMilestoneChangeRequest',
    'decideExecutiveMilestoneChangeRequest',
    'applyDirectExecutiveMilestoneChange',
    'setExecutiveRagOverride',
  ]) {
    assert.match(source, new RegExp(`exports\\.${name}\\s*=\\s*executiveMilestones\\.${name}`), name);
  }
});
