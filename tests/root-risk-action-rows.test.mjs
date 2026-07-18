import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRiskActionRows } from '../js/portfolio-core.mjs';

test('root Risk/Action rows preserve asymmetric pairing and choose a default Primary', () => {
  assert.deepEqual(normalizeRiskActionRows({
    riskActions: [
      { risk: '', action: 'Action without a risk' },
      { risk: 'Risk without an action', action: '' },
    ],
  }), [
    { risk: '', action: 'Action without a risk', primary: true },
    { risk: 'Risk without an action', action: '', primary: false },
  ]);

  assert.deepEqual(normalizeRiskActionRows({ risk: 'Risk A\nRisk B', next: 'Action A' }), [
    { risk: 'Risk A', action: 'Action A', primary: true },
    { risk: 'Risk B', action: '', primary: false },
  ]);
});

test('root Risk/Action rows preserve nested text and order Primary first without mutation', () => {
  const source = {
    riskActions: [
      { risk: '• Secondary\n  • Child', action: 'Later', primary: false },
      { risk: '1. Main', action: '1. Now', primary: true },
    ],
  };

  assert.deepEqual(normalizeRiskActionRows(source), [
    { risk: '1. Main', action: '1. Now', primary: true },
    { risk: '• Secondary\n  • Child', action: 'Later', primary: false },
  ]);
  assert.deepEqual(source.riskActions.map(item => item.risk), ['• Secondary\n  • Child', '1. Main']);
});
