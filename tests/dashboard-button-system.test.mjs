import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dashboard = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('v2.2T defines a shared semantic button system', () => {
  assert.match(dashboard, /\.btn,\s*\.btn-primary,\s*\.btn-ghost,\s*\.btn-danger\s*\{[\s\S]*?font-size:12px;[\s\S]*?border-radius:6px;[\s\S]*?cursor:pointer;/);
  assert.match(dashboard, /\.btn-primary\s*\{[\s\S]*?background:var\(--accent\);[\s\S]*?color:#fff;/);
  assert.match(dashboard, /\.btn-ghost,\s*\.btn\s*\{[\s\S]*?background:var\(--s1\);/);
  assert.match(dashboard, /\.btn-danger\s*\{[\s\S]*?border-color:#E39A9A;[\s\S]*?color:#B35858;/);
});

test('reported confirmation and milestone controls use semantic variants', () => {
  assert.match(dashboard, /class="btn btn-ghost" onclick="keepEditing\(\)"/);
  assert.match(dashboard, /class="btn btn-danger" onclick="confirmDiscardEditorChanges\(\)"/);
  assert.match(dashboard, /class="btn btn-ghost" id="executiveRenameChangeBtn"/);
  assert.match(dashboard, /class="btn btn-danger" id="executiveDeleteChangeBtn"/);
});
