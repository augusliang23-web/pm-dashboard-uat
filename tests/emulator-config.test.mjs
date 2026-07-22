import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dashboard = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const seed = await readFile(new URL('../scripts/seed-v2.2t-emulator.mjs', import.meta.url), 'utf8');
const starter = await readFile(new URL('../scripts/start-v2.2t-emulator.cmd', import.meta.url), 'utf8');
const starterScript = await readFile(new URL('../scripts/start-v2.2t-emulator.ps1', import.meta.url), 'utf8');

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

test('the local emulator starter bypasses the workstation PowerShell script policy', () => {
  assert.match(starter, /powershell\.exe -NoProfile -ExecutionPolicy Bypass -File/);
  assert.match(starter, /start-v2\.2t-emulator\.ps1/);
});

test('the starter writes emulator errors separately and preserves an existing local preview', () => {
  assert.match(starterScript, /\$emulatorErrorLog\s*=\s*Join-Path \$repoRoot 'tmp\\v2\.2t-emulator-error\.log'/);
  assert.match(starterScript, /-RedirectStandardOutput \$emulatorLog -RedirectStandardError \$emulatorErrorLog/);
  assert.match(starterScript, /if \(-not \(Test-NetConnection -ComputerName '127\.0\.0\.1' -Port 4173 -InformationLevel Quiet\)\)/);
});

test('the starter seeds Auth and Firestore into the isolated emulator only', () => {
  assert.match(starterScript, /\$env:FIREBASE_AUTH_EMULATOR_HOST\s*=\s*'127\.0\.0\.1:9099'/);
  assert.match(starterScript, /\$env:FIRESTORE_EMULATOR_HOST\s*=\s*'127\.0\.0\.1:8080'/);
});
