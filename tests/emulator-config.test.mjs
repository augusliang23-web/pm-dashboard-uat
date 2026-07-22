import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dashboard = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const seed = await readFile(new URL('../scripts/seed-v2.2t-emulator.mjs', import.meta.url), 'utf8');

test('v2.2T local preview can only opt into the isolated Firebase Emulator project', async () => {
  const config = JSON.parse(await readFile(new URL('../firebase.json', import.meta.url), 'utf8'));
  const aliases = JSON.parse(await readFile(new URL('../.firebaserc', import.meta.url), 'utf8'));

  assert.equal(aliases.projects.default, 'demo-pm-dashboard-v22t');
  assert.equal(config.emulators.firestore.port, 8080);
  assert.equal(config.emulators.auth.port, 9099);
  assert.equal(config.emulators.functions.port, 5001);
  assert.match(dashboard, /new URLSearchParams\(window\.location\.search\)\.get\('emulator'\) === '1'/);
  assert.match(dashboard, /connectFirestoreEmulator\(db, '127\.0\.0\.1', 8080\)/);
});

test('the local seed bypasses rules only through the Emulator Admin SDK', () => {
  assert.match(seed, /createRequire\(new URL\('\.\.\/functions\/package\.json', import\.meta\.url\)\)/);
  assert.match(seed, /firebase-admin\/firestore/);
  assert.doesNotMatch(seed, /firestoreBase/);
});
