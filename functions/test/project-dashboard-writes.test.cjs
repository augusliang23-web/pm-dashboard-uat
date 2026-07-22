const assert = require('node:assert/strict');
const test = require('node:test');
const {
  assertDraftWeek,
  canMutateProject,
  canSetWeekRelease,
  canDeleteProject,
  canManageWeekFields,
  canCreateProject,
} = require('../project-dashboard-writes');

const project = { owner: 'owner@example.com', deputy: 'Deputy' };

test('project authority permits Admin globally and PM ownership only', () => {
  assert.equal(canMutateProject({ role: 'admin', project, email: 'admin@example.com' }), true);
  assert.equal(canMutateProject({ role: 'pm', project, email: 'owner@example.com' }), true);
  assert.equal(canMutateProject({ role: 'pm', project, email: 'other@example.com' }), false);
  assert.equal(canMutateProject({ role: 'bd', project, email: 'owner@example.com' }), false);
});

test('released weeks reject writes and only PM or Admin changes release state', () => {
  assert.throws(() => assertDraftWeek({ isReleased: true }), /Released reporting weeks/);
  assert.equal(canSetWeekRelease('admin'), true);
  assert.equal(canSetWeekRelease('pm'), true);
  assert.equal(canSetWeekRelease('bd'), false);
});

test('structural and week management authority is explicit', () => {
  assert.equal(canDeleteProject('admin'), true);
  assert.equal(canDeleteProject('pm'), false);
  assert.equal(canCreateProject('admin'), true);
  assert.equal(canCreateProject('pm'), false);
  assert.equal(canManageWeekFields('admin'), true);
  assert.equal(canManageWeekFields('pm'), false);
});
