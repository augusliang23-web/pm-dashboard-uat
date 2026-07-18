import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ReportAccessError,
  authorizeExecutiveAudienceView,
  authorizeReportAccess
} from '../src/report-access.js';

test('rejects Executive Owner access to an unreleased reporting week', () => {
  assert.throws(
    () => authorizeReportAccess({ email: 'owner@example.com', role: 'executive' }, { isReleased: false }, { mode: 'overview' }),
    ReportAccessError
  );
});

test('accepts a released week and normalizes known dashboard roles', () => {
  const access = authorizeReportAccess(
    { email: 'pm@example.com', role: 'Engineering' },
    { isReleased: false },
    { mode: 'overview' }
  );
  assert.deepEqual(access, { email: 'pm@example.com', role: 'engineering' });
});

test('limits Executive milestone views to the authenticated role', () => {
  assert.equal(authorizeExecutiveAudienceView('executive', 'leadership'), 'leadership');
  assert.equal(authorizeExecutiveAudienceView('pm'), 'pm-engineering');
  assert.equal(authorizeExecutiveAudienceView('sales', 'everyone'), 'everyone');
  assert.equal(authorizeExecutiveAudienceView('bd', 'business-product'), 'business-product');
  assert.throws(
    () => authorizeExecutiveAudienceView('engineering', 'business-product'),
    error => error instanceof ReportAccessError && error.statusCode === 403
  );
  assert.throws(() => authorizeExecutiveAudienceView('unknown-role'), ReportAccessError);
});
