import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dashboard = await readFile(new URL('../team-2/index.html', import.meta.url), 'utf8');

test('dashboard roles include engineering, business, and product access groups', () => {
  assert.match(dashboard, /engineering/);
  assert.match(dashboard, /business/);
  assert.match(dashboard, /product/);
  assert.match(dashboard, /function canViewExecutiveSection\(/);
  assert.match(dashboard, /audience/);
  assert.match(dashboard, /sectionId/);
});

test('executive milestone display is RAG based instead of percentage based', () => {
  assert.match(dashboard, /function executiveRagLabel\(/);
  assert.match(dashboard, /function calculateExecutiveQuarterRag\(/);
  assert.match(dashboard, /class="exec-outcome-rag/);
  assert.doesNotMatch(dashboard, /class="exec-outcome-progress"/);
  assert.doesNotMatch(dashboard, /class="dcdc-quarter-progress"/);
});

test('executive outcome status changes require a reason', () => {
  assert.match(dashboard, /data-original-health=/);
  assert.match(dashboard, /class="ft etm-status-reason"/);
  assert.match(dashboard, /Executive milestone status changes require a reason/);
  assert.match(dashboard, /statusReason:/);
});

test('released weeks block content mutations at every write entry point', () => {
  assert.match(dashboard, /function assertCurrentWeekEditable\(/);
  assert.match(dashboard, /assertCurrentWeekEditable\(week\)/);
  assert.match(dashboard, /assertCurrentWeekEditable\(liveWeek\)/);
  assert.match(dashboard, /if \(isWeekReleased\(week\)\) return/);
});

test('single project detail exposes one-page PDF export from the card header', () => {
  assert.match(dashboard, /id="pd_one_page_pdf"/);
  assert.match(dashboard, /exportProjectOnePagePdf/);
  assert.match(dashboard, /window\.print\(\)/);
});
