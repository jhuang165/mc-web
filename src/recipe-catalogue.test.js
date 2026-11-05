import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { auditRecipes } from '../tools/recipe-audit.mjs';

const reference = JSON.parse(await readFile(new URL('../public/research/recipe-registry-reference.json', import.meta.url)));
const audit = auditRecipes(reference);

test('mapped fixed recipes match original manager results at every sampled offset and mirror', () => {
  assert.equal(reference.clientSha1, 'e80d9b3bf5085002218d4be59e668bac718abbc6');
  assert.equal(reference.crafting.length, 317);
  assert.equal(audit.crafting.filter(r => r.checked).length, 269); // 212 + 57 stained glass, pane, carpet, hay, storage block and jack o'lantern recipes (colored-blocks.js)
  assert.equal(audit.crafting.reduce((n, r) => n + r.checked, 0), 2478);
  for (const [i, row] of audit.crafting.entries()) assert.deepEqual(row.mismatches, [], `native recipe ${i}`);
  // Ensure the two regressions cannot disappear through a mapping/filter change.
  for (const id of [173, 192]) assert(audit.crafting[id].checked > 0);
});

test('mapped native furnace registry inputs match outputs and float32 XP', () => {
  assert.equal(reference.smelting.length, 22);
  const checked = audit.smelting.filter(r => r.checked);
  assert.equal(checked.length, 20);
  for (const row of checked) {
    assert.deepEqual(row.actual, row.expected);
    assert(row.xpMatches, JSON.stringify(row));
  }
});
