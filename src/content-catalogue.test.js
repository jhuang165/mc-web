import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// The item catalogue generator asserts that every browser Creative search entry (SEARCH_ORDER) maps to an
// original subtype by the same rule as creative.test.js. Running it here keeps a Creative addition that has no
// original mapping from silently breaking `node tools/build-content-catalogue.mjs`.
test('the content catalogue generator accepts every browser Creative search entry', () => {
  const script = fileURLToPath(new URL('../tools/build-content-catalogue.mjs', import.meta.url));
  const out = execFileSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
  assert.match(out, /^Checked \d+ item audit rows \(315 registrations, 606 Creative entries, \d+ browser mappings\)/);
});
