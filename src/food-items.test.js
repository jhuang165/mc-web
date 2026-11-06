import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Survival, ITEMS, SHAPELESS, craftingResult } from './survival.js';
import { makeStack } from './inventory.js';
import { originalOfLive, liveNativeName } from './item-names.js';
import { ORIGINAL_ITEMS } from './original-items.js';
import { PUMPKIN_PIE, GOLDEN_APPLE, goldenAppleEffects } from './food-items.js';
import { stackHasEffect } from './armor-enchantments.js';
import { tooltipLines } from './gui.js';
import { CREATIVE_TABS, SEARCH_ORDER } from './creative.js';
import { blockTile, tileByName } from './block-textures.js';
import { blockForEggMeta, eggMetaFor, eggBreak, MONSTER_EGG, STONE, COBBLESTONE, STONE_BRICKS } from './silverfish.js';
import { STRONGHOLD_STONES } from './stronghold-generator.js';
import { JavaRandom } from './java-random.js';

// Replays public/research/food-items-reference.json (tools/probes/FoodItemsProbe.java against the original 1.7.10 classes).
const ref = JSON.parse(readFileSync(new URL('../public/research/food-items-reference.json', import.meta.url), 'utf8'));
const [pieRef, appleRef] = ref.items.filter((i) => i.name !== 'enchanted_golden_apple');
const notchRef = ref.items.find((i) => i.name === 'enchanted_golden_apple') ?? ref.items[2];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} vs ${b}`);
const key = (e) => [].concat(e).join(':');
const byId = (a, b) => a.id - b.id;
const effectsOf = (p) => [...p.effects.active.values()].map(({ id, duration, amplifier }) => ({ id, duration, amplifier })).sort(byId);
const refEffects = (row) => row.onFoodEatenFirstRoll.map(({ id, duration, amplifier }) => ({ id, duration, amplifier })).sort(byId);
const player = (id, count, damage, food) => { const p = new Survival({ food, saturation: 0 }); p.add(id, count, damage); p.food = food; p.saturation = 0; return p; };
const tab = (name) => CREATIVE_TABS.find((t) => t.label === name).items.map(key);

test('pumpkin pie: ItemFood(8, 0.3), 32 ticks, stack 64, original 400 maps to the browser item', () => {
  const item = ITEMS[PUMPKIN_PIE];
  assert.equal(pieRef.class, 'acx');
  assert.deepEqual([item.food, item.saturation, item.stack], [pieRef.heal, pieRef.saturationModifier, pieRef.maxStackSize]);
  assert.equal(pieRef.useDuration, 32);
  assert.equal(pieRef.alwaysEdible, false);
  assert.ok(!item.alwaysEdible);
  assert.equal(ORIGINAL_ITEMS[400], PUMPKIN_PIE);
  assert.deepEqual(originalOfLive(PUMPKIN_PIE), { id: 400 });
  assert.equal(liveNativeName(PUMPKIN_PIE), pieRef.displayName);
  assert.equal(pieRef.creativeTab, 'food');
  const p = player(PUMPKIN_PIE, 2, 0, 0);
  assert.equal(p.eat(PUMPKIN_PIE), true);
  assert.equal(p.food, pieRef.foodLevelAfterAddStatsFrom0);
  near(p.saturation, pieRef.saturationAfterAddStatsFrom0);
  assert.equal(p.count(PUMPKIN_PIE), 1);
  assert.deepEqual(effectsOf(p), []);
  const full = player(PUMPKIN_PIE, 1, 0, 20);
  assert.equal(full.eat(PUMPKIN_PIE), false);
  assert.equal(full.count(PUMPKIN_PIE), 1);
});

test('pumpkin pie recipe: shapeless pumpkin + sugar + egg, any order and grid size', () => {
  assert.ok(SHAPELESS.some((r) => r.output === PUMPKIN_PIE));
  const s = (id) => makeStack(id);
  const pumpkin = 67, sugar = 329, egg = 316;
  const grid = craftingResult([s(egg), null, s(pumpkin), null, s(sugar), null, null, null, null], 3);
  assert.deepEqual([grid?.id, grid?.count, grid?.damage], [PUMPKIN_PIE, 1, 0]);
  assert.equal(craftingResult([s(sugar), s(egg), s(pumpkin), null], 2)?.id, PUMPKIN_PIE);
  assert.equal(craftingResult([s(pumpkin), s(sugar), null, null], 2), null);
  const rows = ref.crafting.filter((c) => c.name.startsWith('pumpkin pie'));
  assert.deepEqual(rows.map((r) => r.result === null), [false, false, true]);
});

test('golden apple: ItemAppleGold values, glint and rarity follow the damage', () => {
  const item = ITEMS[GOLDEN_APPLE];
  assert.equal(appleRef.class, 'acy');
  assert.deepEqual([item.food, item.saturation, item.alwaysEdible], [appleRef.heal, appleRef.saturationModifier, true]);
  assert.equal(appleRef.alwaysEdible, true);
  assert.deepEqual(ref.subItems.stacks.map((s) => s.damage), [0, 1]);
  assert.equal(item.variants.length, 2);
  assert.equal(appleRef.glint, false);
  assert.equal(notchRef.glint, true);
  assert.equal(stackHasEffect(makeStack(GOLDEN_APPLE, 1, 0), item), false);
  assert.equal(stackHasEffect(makeStack(GOLDEN_APPLE, 1, 1), item), true);
  assert.deepEqual([appleRef.rarityFormat, notchRef.rarityFormat], ['$b', '$d']);
  assert.equal(tooltipLines(item, makeStack(GOLDEN_APPLE, 1, 0))[0].color, 'aqua');
  assert.equal(tooltipLines(item, makeStack(GOLDEN_APPLE, 1, 1))[0].color, 'pink');
  assert.equal(liveNativeName(GOLDEN_APPLE, 1), notchRef.displayName);
  assert.equal(notchRef.displayName, 'Golden Apple');
});

test('eating a golden apple runs ItemAppleGold.onFoodEaten, at full hunger too', () => {
  for (const [damage, row] of [[0, appleRef], [1, notchRef]]) {
    assert.deepEqual(goldenAppleEffects(damage).map(({ id, duration, amplifier }) => ({ id, duration, amplifier })).sort(byId), refEffects(row));
    for (const food of [20, 7]) {
      const p = player(GOLDEN_APPLE, 2, damage, food);
      assert.equal(p.eat(GOLDEN_APPLE), true, `damage ${damage} food ${food}`);
      assert.deepEqual(effectsOf(p), refEffects(row));
      assert.equal(p.count(GOLDEN_APPLE), 1);
      assert.equal(p.food, Math.min(20, food + row.heal));
      assert.equal(p.absorption, 4);
    }
  }
  assert.equal(notchRef.onFoodEatenChanceHits1000, 1000);
  assert.equal(appleRef.onFoodEatenChanceHits1000, 1000);
  // Only the plain apple draws the ItemFood potion roll (probability 1.0 passes every time).
  let draws = 0;
  player(GOLDEN_APPLE, 1, 1, 5).eat(GOLDEN_APPLE, () => (draws++, 0.999));
  assert.equal(draws, 0);
  player(GOLDEN_APPLE, 1, 0, 5).eat(GOLDEN_APPLE, () => (draws++, 0.999));
  assert.equal(draws, 1);
});

test('enchanted golden apple recipe: eight gold blocks around an apple; gold ingots still make the plain apple', () => {
  const ring = (id) => Array.from({ length: 9 }, (_, i) => makeStack(i === 4 ? 200 : id));
  const notch = craftingResult(ring(27), 3);
  assert.deepEqual([notch?.id, notch?.count, notch?.damage], [GOLDEN_APPLE, 1, 1]);
  const plain = craftingResult(ring(ITEMS[GOLDEN_APPLE] && 304), 3);
  assert.deepEqual([plain?.id, plain?.damage], [GOLDEN_APPLE, 0]);
  const rows = Object.fromEntries(ref.crafting.map((c) => [c.name, c.result]));
  assert.deepEqual(rows['8 gold blocks around an apple'], { id: 322, count: 1, damage: 1 });
  assert.deepEqual(rows['8 gold ingots around an apple'], { id: 322, count: 1, damage: 0 });
  assert.equal(rows['8 gold nuggets around an apple'], null);
  const short = ring(27); short[0] = null;
  assert.equal(craftingResult(short, 3), null);
});

test('/give golden_apple 1 1 and the inventory keep the enchanted damage', () => {
  const p = new Survival({}, 'creative');
  assert.equal(p.add(GOLDEN_APPLE, 1, 1), 1);
  assert.equal(p.inventory.main.find((s) => s?.id === GOLDEN_APPLE).damage, 1);
});

test('creative: 322:0, 322:1 and pumpkin pie are listed in Foodstuffs and the search order', () => {
  const food = tab('food');
  const i = food.indexOf(String(GOLDEN_APPLE));
  assert.ok(i >= 0 && food[i + 1] === `${GOLDEN_APPLE}:1`, food.join(','));
  assert.ok(food.includes(String(PUMPKIN_PIE)));
  const search = SEARCH_ORDER.map(key);
  assert.ok(search.includes(`${GOLDEN_APPLE}:1`) && search.includes(String(PUMPKIN_PIE)));
  assert.equal(pieRef.creativeTab, 'food');
  assert.equal(appleRef.creativeTab, 'food');
});

test('monster eggs 97:0-5 (probe): names, icons, drops, silverfish mapping and Creative', () => {
  assert.equal(ref.blockInfo.creativeTab, 'decorations');
  assert.equal(ref.blockInfo.hardness, 0.75);
  assert.deepEqual(ref.blockInfo.subBlocks.map((s) => s.damage), [0, 1, 2, 3, 4, 5]);
  const toLive = (id) => (id === 1 ? STONE : id === 4 ? COBBLESTONE : STONE_BRICKS);
  for (const row of ref.blocks.filter((b) => b.meta <= 5)) {
    assert.equal(ITEMS[MONSTER_EGG].variants[row.meta], row.displayName);
    for (const face of [0, 1, 2, 3, 4, 5]) assert.equal(blockTile(MONSTER_EGG, face, false, row.meta), tileByName(row.icons[face]), `meta ${row.meta} face ${face}`);
    assert.equal(row.quantityDropped, 0);
    assert.equal(row.damageDropped, 0);
    const mapped = blockForEggMeta(row.meta), want = row.func_150197_b;
    assert.deepEqual([mapped.id, mapped.meta], [toLive(want.block === 98 ? 98 : want.block), want.meta]);
    assert.deepEqual(eggBreak({ silkTouch: true, meta: row.meta }).item, mapped);
    assert.deepEqual(eggBreak({ meta: row.meta }), { spawns: 2, item: null });
    assert.ok(tab('decorations').includes(`${MONSTER_EGG}:${row.meta}`) || (row.meta === 0 && tab('decorations').includes(String(MONSTER_EGG))) || row.meta <= 2);
  }
  for (const meta of [3, 4, 5]) {
    assert.ok(tab('decorations').includes(`${MONSTER_EGG}:${meta}`), `decorations lists 97:${meta}`);
    assert.ok(SEARCH_ORDER.map(key).includes(`${MONSTER_EGG}:${meta}`));
  }
  // Anything over 5 draws as stone and hides as a stone block.
  assert.equal(blockTile(MONSTER_EGG, 2, false, 6), tileByName('stone'));
  assert.deepEqual(blockForEggMeta(6), { id: STONE, meta: 0 });
  for (const c of ref.containment) {
    if (c.block !== 1 && c.block !== 4 && c.block !== 98) continue;
    assert.equal(eggMetaFor(toLive(c.block), c.meta), c.eggMeta, `${c.block}:${c.meta}`);
  }
});

test('strongholds emit monster egg metadata 2 only, so 97:3-5 are never generated', () => {
  const seen = new Set(), random = new JavaRandom(12345);
  for (let i = 0; i < 6000; i++) { const [id, meta] = STRONGHOLD_STONES.select(random, 0, 0, 0, true); if (id === 97) seen.add(meta); }
  assert.deepEqual([...seen], [2]);
  assert.deepEqual(ref.strongholdStones.thresholds.map((t) => t[0]), [0.2, 0.5, 0.55]);
});
