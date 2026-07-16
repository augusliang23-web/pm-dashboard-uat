import test from 'node:test';
import assert from 'node:assert/strict';
import { renderProjectReportHtml } from '../src/project-report.js';
import { completeProjectReportFixture } from './report-fixtures.mjs';

test('renders every selected project section with dashboard visual structures', () => {
  const html = renderProjectReportHtml(completeProjectReportFixture());

  for (const section of ['project-summary', 'milestone', 'gantt', 'resource', 'budget']) {
    assert.match(html, new RegExp(`data-report-section="${section}"`));
  }
  assert.match(html, /project-brief-grid/);
  assert.match(html, /status-badge red/);
  assert.match(html, /gantt-row/);
  assert.match(html, /team-allocation-table/);
  assert.match(html, /discipline-hours-table/);
  assert.match(html, /budget-comparison/);
  assert.match(html, /W28 2026 · Jul 6–Jul 12, 2026/);
  assert.match(html, /\.gantt-grid/);
  assert.doesNotMatch(html, /\.report-page\s*\{[^}]*overflow:hidden/);
  assert.doesNotMatch(html, /<script|onclick=|<button|<select|<input/);
});

test('uses vertical milestones for long milestone collections and omits empty sections', () => {
  const html = renderProjectReportHtml({
    week: { weekLabel: 'W28 2026' },
    project: {
      name: 'PMS', code: 'PMS-001', progress: 60,
      milestones: [
        { name: 'Discovery', date: '2026-04-30' },
        { name: 'Design', date: '2026-07-15' },
        { name: 'Demo', date: '2026-07-15' },
        { name: 'Integration', date: '2026-08-17' }
      ]
    },
    sections: ['project-brief', 'milestone']
  });
  assert.match(html, /milestone-list/);
  assert.doesNotMatch(html, /Team allocation/);
  assert.match(html, /@page \{ size: A4 landscape/);
});

test('uses a compact timeline only for three or fewer short milestones', () => {
  const html = renderProjectReportHtml({
    week: { weekLabel: 'W28 2026' },
    project: { name: 'PMS', milestones: [{ name: 'Plan' }, { name: 'Build' }, { name: 'Release' }] },
    sections: ['milestone']
  });
  assert.match(html, /milestone-timeline/);
});

test('escapes project content and omits pages that were not selected', () => {
  const fixture = completeProjectReportFixture();
  fixture.project.name = '<img src=x onerror=alert(1)>';
  fixture.project.highlight = '<script>alert(1)</script>';
  fixture.sections = ['project-brief', 'project-update'];

  const html = renderProjectReportHtml(fixture);

  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /data-report-section="gantt"/);
  assert.doesNotMatch(html, /<script>/);
});

test('keeps long milestone items in vertical rows', () => {
  const fixture = completeProjectReportFixture();
  fixture.sections = ['milestone'];
  fixture.project.milestones = Array.from({ length: 5 }, (_, index) => ({
    name: `Long milestone ${index + 1} requiring a complete printable row`,
    date: `2026-0${index + 4}-15`,
    status: index === 4 ? 'at-risk' : 'planned'
  }));

  const html = renderProjectReportHtml(fixture);

  assert.match(html, /milestone-list/);
  assert.match(html, /milestone-row keep-together/);
});
