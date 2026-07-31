import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const production = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const testVersion = await readFile(new URL('../team-2/index.html', import.meta.url), 'utf8');

test('v2.0 uses confirmed immutable release writes', () => {
  assert.match(
    production,
    /import \{ confirmWeekMutation, getWriteErrorMessage \} from "\.\/sync-core\.js"/
  );
  assert.match(production, /await updateDoc\(doc\(db, "weeks", id\), \{/);
  assert.match(
    production,
    /finally\s*\{\s*releaseWriteInProgress = false;\s*hideLoader\(\)/s
  );
});

test('v2.0 strategy save commits a clone after confirmation', () => {
  assert.match(production, /const savedWeek = await confirmWeekMutation\(/);
  assert.match(production, /allWeeks\[currentIdx\] = savedWeek/);
});

test('v2.2T keeps Executive timeline cells out of the legacy strategy save path', () => {
  assert.match(
    production,
    /import \{ getExecutiveTimelineCell \} from "\.\/executive-timeline-core\.js"/
  );
  assert.match(
    production,
    /const cell = getExecutiveTimelineCell\(row\.cells, index\)/
  );
  assert.match(
    production,
    /const strategyLayer = \{\s*\.\.\.\(week\.strategyLayer \|\| \{\}\),\s*projectMap\s*\}/
  );
  assert.match(
    testVersion,
    /const strategyLayer = \{\s*\.\.\.\(week\.strategyLayer \|\| \{\}\),\s*projectMap\s*\}/
  );
});

test('v2.0T uses confirmed immutable release writes', () => {
  assert.match(
    testVersion,
    /import \{ confirmWeekMutation, getWriteErrorMessage \} from "\.\.\/sync-core\.js"/
  );
  assert.match(testVersion, /await updateDoc\(doc\(db, "weeks", id\), \{/);
  assert.match(
    testVersion,
    /finally\s*\{\s*releaseWriteInProgress = false;\s*hideLoader\(\)/s
  );
});

test('v2.0T strategy save commits a clone after confirmation', () => {
  assert.match(testVersion, /const savedWeek = await confirmWeekMutation\(/);
  assert.match(testVersion, /allWeeks\[currentIdx\] = savedWeek/);
});

test('Overview PDF picker wires Executive milestones before Quarterly Roadmap', () => {
  assert.ok(
    production.indexOf('value="executive-milestones"') < production.indexOf('value="quarterly-roadmap"')
  );
  assert.match(production, /id="executiveMilestoneAudienceView"/);
  assert.match(production, /executiveAudienceView/);
});
