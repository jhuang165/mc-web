import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ITEMS } from './survival.js';
import { itemFromOriginal } from './region-import.js';
import { ITEM_NAMES } from './item-names-data.js';
import { stackName, nativeName, originalOfLive, liveNativeName, titleCase, applyNativeNames } from './item-names.js';
import { potionName } from './potions.js';
import { makeStack } from './inventory.js';

const reference = JSON.parse(await readFile(new URL('../public/research/item-names-reference.json', import.meta.url)));
const creative = JSON.parse(await readFile(new URL('../public/research/creative-reference.json', import.meta.url)));
const refName = (id, damage) => {
  if (id === 373) return reference.potion.names[reference.potion.byDamage[damage]];
  const names = reference.items[id].names;
  return names[Math.min(damage, names.length - 1)];
};

test('the generated name table is the unchanged 1.7.10 client probe output', () => {
  assert.equal(reference.clientSha1, 'e80d9b3bf5085002218d4be59e668bac718abbc6');
  assert.ok(Object.keys(reference.items).length >= 300);
  assert.deepEqual(Object.fromEntries(Object.entries(reference.items).map(([id, e]) => [id, e.names])), Object.fromEntries(Object.entries(ITEM_NAMES).map(([id, n]) => [id, n])));
  for (const [id, e] of Object.entries(reference.items)) for (let d = 0; d < e.range; d++) assert.equal(nativeName(+id, d), e.names[Math.min(d, e.names.length - 1)], `${id}:${d}`);
});

test('the lead examples are the en_US display names', () => {
  assert.equal(ITEMS[100].name, 'Wooden Pickaxe');
  assert.equal(stackName({ id: 126, damage: 0 }, ITEMS), 'Flint and Steel');
  assert.equal(liveNativeName(1123), 'Block of Redstone');
  assert.equal(liveNativeName(1120), 'Redstone Torch');
  assert.equal(liveNativeName(372), 'Golden Apple');
  assert.equal(liveNativeName(1100), 'Glass Pane');
  assert.equal(stackName({ id: 7, damage: 0 }, ITEMS), 'Oak Wood Planks');
  assert.equal(stackName({ id: 19, damage: 3 }, ITEMS), 'Light Blue Wool');
  assert.equal(stackName({ id: 19, damage: 0 }, ITEMS), 'Wool');
  assert.equal(stackName({ id: 44, damage: 0 }, ITEMS), 'Poppy');
  assert.equal(stackName({ id: 44, damage: 1 }, ITEMS), 'Blue Orchid');
  assert.equal(stackName({ id: 4, damage: 1 }, ITEMS), 'Spruce Wood');
  assert.equal(stackName({ id: 1103, damage: 0 }, ITEMS), 'Stone Slab');
  assert.equal(stackName({ id: 48, damage: 0 }, ITEMS), 'Oak Sapling');
});

test('every creative-inventory stack of the original shows the exact original name', () => {
  let checked = 0, internal = 0;
  const seen = new Set();
  for (const tab of creative.tabs) for (const [id, damage] of tab.items) {
    const key = id + ':' + damage;
    if (seen.has(key)) continue;
    seen.add(key);
    const mapped = itemFromOriginal(id, damage);
    if (!mapped) { internal++; continue; }
    assert.equal(stackName({ id: mapped.id, damage: mapped.damage }, ITEMS), refName(id, damage), `original ${key} -> internal ${mapped.id}:${mapped.damage}`);
    checked++;
  }
  assert.ok(checked >= 379, `${checked} stacks checked, ${internal} without a browser item`);
});

test('every variant of every browser item with an original counterpart uses its native name', () => {
  let checked = 0;
  for (const item of Object.values(ITEMS)) {
    const o = originalOfLive(item.id);
    if (!o || item.id === 385 || !reference.items[o.id]) continue;
    const variants = o.damage === undefined ? item.variants?.length ?? 1 : 1;
    for (let d = 0; d < variants; d++) {
      const expected = refName(o.id, o.damage ?? d);
      assert.equal(item.variants && o.damage === undefined ? item.variants[d] : item.name, expected, `item ${item.id} (${o.id}) damage ${d}`);
      assert.equal(stackName({ id: item.id, damage: d }, ITEMS), expected);
      checked++;
    }
  }
  assert.ok(checked > 280);
});

test('potion names match ItemPotion.getItemStackDisplayName for all 32768 damage values', () => {
  assert.equal(reference.potion.byDamage.length, 32768);
  for (let d = 0; d < 32768; d++) assert.equal(potionName(d), reference.potion.names[reference.potion.byDamage[d]], 'damage ' + d);
  for (const d of [0, 16, 8193, 16385, 16421, 8261, 16453]) assert.equal(stackName({ id: 385, damage: d }, ITEMS), potionName(d));
  assert.equal(stackName({ id: 385, damage: 0 }, ITEMS), 'Water Bottle');
  assert.equal(stackName({ id: 385, damage: 16 }, ITEMS), 'Awkward Potion');
  assert.equal(stackName({ id: 385, damage: 16421 }, ITEMS), 'Splash Potion of Healing');
});

test('anvil and book names stay as the stack carries them', () => {
  assert.equal(stackName(makeStack(103, 1, 0, undefined, { displayName: 'my pick' }), ITEMS), 'my pick');
  assert.equal(stackName({ id: 103, damage: 5, displayName: '' }, ITEMS), '');
  assert.equal(stackName({ id: 365, damage: 0 }, ITEMS), 'Enchanted Book');
  assert.equal(stackName(null, ITEMS), '');
});

// Items the build has that 1.7.10 does not register as items: kept in Title Case, listed in public/research/item-names.md.
// Wheat stages 31-38, sugar cane 54, lit redstone ore 65 (no ItemBlock), door blocks 97/98 (the items are 470/471), powered comparator 128,
// moving piston 130, the brewing stand block 134 (item 1134) and the bed block 138 (item 355 maps once the bed item exists).
const INTERNAL_ONLY = [31, 32, 33, 34, 35, 36, 37, 38, 54, 65, 97, 98, 128, 130, 134, 138];
test('browser-only items keep their own name in 1.7.10 Title Case', () => {
  const clone = structuredClone(ITEMS);
  const fallback = applyNativeNames(clone).filter((id) => !INTERNAL_ONLY.includes(id));
  assert.deepEqual(fallback, [], 'unexpected items without a 1.7.10 counterpart');
  assert.equal(titleCase('Powered redstone comparator'), 'Powered Redstone Comparator');
  assert.equal(titleCase('Minecart with chest'), 'Minecart with Chest');
  assert.equal(titleCase('Flint and steel'), 'Flint and Steel');
  assert.equal(titleCase('Block of redstone'), 'Block of Redstone');
});

test('no item or variant name has a lower-case word start (1.7.10 capitalisation)', () => {
  const small = new Set(['of', 'and', 'with', 'the', 'in', 'on', 'a', 'an']);
  const bad = [];
  for (const item of Object.values(ITEMS)) {
    if (!item.id) continue;
    for (const name of [item.name, ...(item.variants ?? [])]) {
      const words = String(name).split(/\s+/);
      words.forEach((w, i) => { if (/^[a-z]/.test(w) && !(i && small.has(w))) bad.push(`${item.id}: ${name}`); });
    }
  }
  assert.deepEqual(bad, []);
});
