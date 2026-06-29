import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getExecutiveTimelineCell,
  serializeExecutiveMilestoneTimeline
} from '../executive-timeline-core.js';

function containsDirectNestedArray(value) {
  if (Array.isArray(value)) {
    return value.some(Array.isArray) || value.some(containsDirectNestedArray);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some(containsDirectNestedArray);
  }
  return false;
}

test('serializes executive timeline without Firestore nested arrays', () => {
  const timeline = {
    title: '2026 timeline',
    quarters: ['Q1', 'Q2', 'Q3', 'Q4'],
    rows: [{
      label: 'Solution',
      cells: [['Alpha'], ['Beta', 'Gamma'], [], ['Delta']]
    }],
    phases: ['One', 'Two', 'Three', 'Four']
  };

  const stored = serializeExecutiveMilestoneTimeline(timeline);

  assert.deepEqual(stored.rows[0].cells, {
    q1: ['Alpha'],
    q2: ['Beta', 'Gamma'],
    q3: [],
    q4: ['Delta']
  });
  assert.equal(containsDirectNestedArray(stored), false);
});

test('reads both legacy array cells and Firestore-safe mapped cells', () => {
  assert.deepEqual(getExecutiveTimelineCell([['Alpha'], ['Beta']], 1), ['Beta']);
  assert.deepEqual(
    getExecutiveTimelineCell({ q1: ['Alpha'], q2: ['Beta'] }, 1),
    ['Beta']
  );
});

test('serialization does not mutate the editor timeline', () => {
  const timeline = {
    rows: [{ label: 'Solution', cells: [['Alpha'], [], [], []] }]
  };

  serializeExecutiveMilestoneTimeline(timeline);

  assert.deepEqual(timeline.rows[0].cells, [['Alpha'], [], [], []]);
});
