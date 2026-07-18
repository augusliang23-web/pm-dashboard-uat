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

test('compact roadmap items expose RAG, latest update, identity, actor, date, and freshness', () => {
  for (const dashboard of dashboards) {
    assert.match(dashboard, /data-executive-item-id=/);
    assert.match(dashboard, /class="executive-compact-item/);
    assert.match(dashboard, /executive-compact-title/);
    assert.match(dashboard, /executive-compact-update/);
    assert.match(dashboard, /latestStatusText/);
    assert.match(dashboard, /latestStatusAt/);
    assert.match(dashboard, /latestStatusBy/);
    assert.match(dashboard, /getExecutiveUpdateFreshness/);
    assert.match(dashboard, /executive-freshness/);
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
