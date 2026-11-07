import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { auditRecipes, auditSpecials, SPECIAL_RECIPES } from '../tools/recipe-audit.mjs';

const reference = JSON.parse(await readFile(new URL('../public/research/recipe-registry-reference.json', import.meta.url)));
const audit = auditRecipes(reference);

test('mapped fixed recipes match original manager results at every sampled offset and mirror', () => {
  assert.equal(reference.clientSha1, 'e80d9b3bf5085002218d4be59e668bac718abbc6');
  assert.equal(reference.crafting.length, 317);
  assert.equal(audit.crafting.filter(r => r.checked).length, 308); // batch 19: +5 wooden slab variants and the mossy cobblestone wall (audit-side mapping), then: 1 pumpkin pie + 1 enchanted golden apple (food-items.js; the 322:1 grid goes through foodCraftingResult, outside RECIPES) + 1 Book and Quill (books.js) + 1 carrot on a stick (pig-saddle) + 1 beacon (pyramid.js) + 1 clock (maps-clock-live.js) + 3 furnace/TNT/hopper minecart recipes (cart-variants.js) + 1 lead + 2 fire charge (spawn-eggs.js) + 1 eye of ender shapeless + 1 ender chest + 1 chests.js trapped chest + 1 cake (stems-cake.js) + 212 + 9 nether-blocks.js + 57 colored-blocks.js + 2 note-jukebox + 1 sign + 5 shaped-blocks.js recipes
  assert.equal(audit.crafting.reduce((n, r) => n + r.checked, 0), 2744);
  for (const [i, row] of audit.crafting.entries()) assert.deepEqual(row.mismatches, [], `native recipe ${i}`);
  // Ensure the two regressions cannot disappear through a mapping/filter change.
  for (const id of [151, 201, 202, 203, 204, 205]) assert(audit.crafting[id].checked > 0, `recipe ${id}`);
  // Only the four fire-block chainmail recipes stay unreplayed.
  assert.deepEqual(audit.crafting.flatMap((r, i) => !r.checked && reference.crafting[i].type !== 'special' ? [i] : []).length, 4);
  for (const id of [173, 192]) assert(audit.crafting[id].checked > 0);
});

test('mapped native furnace registry inputs match outputs and float32 XP', () => {
  assert.equal(reference.smelting.length, 22);
  const checked = audit.smelting.filter(r => r.checked);
  assert.equal(checked.length, 22);
  for (const row of checked) {
    assert.deepEqual(row.actual, row.expected);
    assert(row.xpMatches, JSON.stringify(row));
  }
});

test('the five dynamic recipe handlers replay their native probe fixtures', () => {
  const specials = auditSpecials();
  assert.deepEqual(Object.keys(SPECIAL_RECIPES).map(Number), reference.crafting.flatMap((r, i) => r.type === 'special' ? [i] : []));
  assert.deepEqual(Object.fromEntries(Object.entries(specials).map(([i, r]) => [i, r.checked])), { 0: 324, 1: 78, 65: 13, 66: 17, 67: 17 });
  for (const [i, r] of Object.entries(specials)) assert.deepEqual(r.mismatches, [], `special recipe ${i}`);
});
