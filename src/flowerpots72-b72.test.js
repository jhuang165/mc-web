// Batch 72 flowerpots72: pot-sweep-reference.json (tools/probes/PotSweepProbe.java, tools/verify-pot-sweep.mjs), the unchanged 1.7.10
// BlockFlowerPot/TileEntityFlowerPot over every item id 1-2300 at damage 0-15, replayed against stone-utility.js, gen-world.js and the placement rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { itemFromOriginal } from './region-import.js';
import { fromOriginal } from './block-registry.js';
import { potUse, potPlantOf, potContentsOfMeta, potNbtOf, potFromNbt } from './stone-utility.js';
import { FLOWER_POT_CONTENTS } from './gen-world.js';
import { solidTopSurface } from './doors-panes.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/pot-sweep-reference.json', import.meta.url)));
const rows = (k) => ref.rows.filter((r) => r.kind === k);
const accepted = rows('potAccept'), survival = accepted.filter((r) => !r.creative);
const emptyPot = { get: () => 140, getMeta: () => 0, pots: undefined };
const key = (id, d) => `${id}:${d}`;
const nativeAccept = new Set(survival.map((r) => key(r.id, r.damage)));

test('the sweep covers 315 registered items at 16 damages and both game modes', () => {
  const [s] = rows('potSweep');
  assert.deepEqual([s.items, s.tried, s.accepted], [315, 10080, 226]);
  assert.equal(nativeAccept.size, 113);
});

test('native accepts only the explicit plants: sapling, flowers, mushrooms, cactus, dead bush, tall grass damage 2', () => {
  const ids = new Set(survival.map((r) => r.id));
  assert.deepEqual([...ids].sort((a, b) => a - b), [6, 31, 32, 37, 38, 39, 40, 81]);
  for (const r of survival) assert.ok(r.renderType === 1 || r.renderType === 13);
  assert.deepEqual(survival.filter((r) => r.id === 31).map((r) => r.damage), [2]);
  for (const r of survival) assert.deepEqual([r.meta, r.tile], [r.damage, [r.id, r.damage]]);
  for (const r of accepted) assert.deepEqual(r.nbt, r.tile);
});

test('replay: every item and damage the port can hold is accepted exactly when native accepts it', () => {
  let held = 0, unrepresentable = 0;
  for (let id = 1; id <= 2300; id++) for (let d = 0; d < 16; d++) {
    const stack = itemFromOriginal(id, d), want = nativeAccept.has(key(id, d));
    if (!stack) { if (want) unrepresentable++; continue; }
    const ins = potUse(emptyPot, 0, 0, 0, stack.id, stack.damage);
    assert.equal(!!ins, want, `item ${id}:${d} -> ${stack.id}:${stack.damage}`);
    if (ins) {
      held++;
      const r = survival.find((x) => x.id === id && x.damage === d);
      assert.equal(ins.meta, r.meta, `meta ${id}:${d}`);
      assert.deepEqual(potPlantOf(ins.content.id, ins.content.damage), r.tile, `tile ${id}:${d}`);
    }
  }
  assert.equal(held + unrepresentable, 113);
  assert.ok(held >= 20, `held ${held}`);
});

test('every accepted item breaks into its plant, the stack drops one outside Creative, NBT Item/Data match', () => {
  for (const r of survival) {
    assert.deepEqual(r.breakDrops, [`[${r.tile[0]},1,${r.tile[1]}]`]);
    assert.equal(r.left[1], 2);
    const stack = itemFromOriginal(r.id, r.damage);
    if (!stack) continue;
    const ins = potUse(emptyPot, 0, 0, 0, stack.id, stack.damage);
    assert.deepEqual(potNbtOf(ins.content), { Item: r.nbt[0], Data: r.nbt[1] }, `nbt ${r.id}:${r.damage}`);
  }
  for (const r of accepted.filter((x) => x.creative)) assert.equal(r.left[1], 3);
});

test('NBT import follows TileEntityFlowerPot.readFromNBT', () => {
  for (const r of rows('potNbt')) {
    const [item, data] = r.in, c = potFromNbt({ Item: item, Data: data });
    if (r.item === -1) { assert.equal(c, null, `empty ${item}`); continue; }
    assert.deepEqual(r.out, [item, data]);
    if (c) assert.ok(c.item === item || potPlantOf(c.id, c.damage)); // b81: an undrawn registered item is kept with its Item and Data
    if (nativeAccept.has(key(item, data)) && itemFromOriginal(item, data)) assert.ok(c, `${item}:${data} imports`);
  }
  assert.deepEqual(potFromNbt({ Item: 37, Data: 5 }), { id: 43, damage: 0, data: 5 }); // b79: the exact Data rides along
  assert.deepEqual(potFromNbt({ Item: 38, Data: 3 }), { id: 44, damage: 3 });
  assert.deepEqual(potFromNbt({ Item: 1, Data: 0 }), { id: 0, damage: 0, item: 1, data: 0 }); // b81: stone is kept, undrawn (no item resolver given here)
  assert.equal(potFromNbt({}), null);
  assert.equal(potFromNbt(null), null);
});

test('gen-world pot contents by metadata match all sixteen native createNewTileEntity answers', () => {
  const stone = JSON.parse(readFileSync(new URL('../public/research/stone-utility-reference.json', import.meta.url))).rows.filter((r) => r.kind === 'potTile');
  assert.equal(stone.length, 16);
  for (const r of stone) {
    const want = r.tile ?? [-1, 0], [item, data] = FLOWER_POT_CONTENTS[r.meta] ?? [-1, 0];
    assert.deepEqual([item, data], want, `gen-world meta ${r.meta}`);
    const c = potContentsOfMeta(r.meta);
    assert.deepEqual(c ? potPlantOf(c.id, c.damage) : [-1, 0], want, `runtime meta ${r.meta}`);
  }
});

test('placement: canPlaceBlockAt follows doesBlockHaveSolidTopSurface for every block and metadata below', () => {
  let checked = 0;
  for (const r of rows('potPlace')) for (let m = 0; m < 16; m++) {
    const b = fromOriginal(r.below, m);
    if (!b.exact) continue;
    const below = { get: () => b.id, getMeta: () => b.meta };
    assert.equal(solidTopSurface(below, 0, 0, 0), !!(r.mask >> m & 1), `below ${r.below}:${m}`);
    checked++;
  }
  assert.ok(checked > 1000);
});

test('a pot that holds a plant, or has no tile entity, refuses another plant', () => {
  assert.equal(rows('potFull')[0].ret, false);
  assert.equal(rows('potNoTile')[0].ret, false);
  const full = { get: () => 140, getMeta: () => 2, pots: new Map([['0,0,0', { id: 43, damage: 0 }]]) };
  assert.equal(potUse(full, 0, 0, 0, 44, 0), null);
});

// ---- Gap 2: legacy 64-high worlds grow the ported WorldGenBigTree on the one-in-ten oak roll ----
import { Trees } from './trees.js';
import { treeRegistryReady } from './tree-growth.js';
import { JavaRandom } from './java-random.js';
import { World } from './world.js';

test('a legacy 64-high oak sapling that rolls big grows a WorldGenBigTree (wide, tall canopy), not the ordinary stand-in', async () => {
  await treeRegistryReady;
  let bigs = 0, tallest = 0;
  for (let seed = 1; seed < 80 && bigs < 3; seed++) {
    const world = new World(1, 0, 8, false, 1, 1);
    if (world.height >= 256) break;
    // flat dirt/grass floor with sky above, sapling at the middle
    const sy = 20, cx = 64, cz = 64;
    for (let x = cx - 12; x <= cx + 12; x++) for (let z = cz - 12; z <= cz + 12; z++) { for (let y = 0; y < sy; y++) world.put(x, y, z, y === sy - 1 ? 1 : 2, 0, true); for (let y = sy; y < 64; y++) world.put(x, y, z, 0, 0, true); }
    world.put(cx, sy, cz, 48, 0, true);
    const t = new Trees(world, { random: new JavaRandom(seed), light: () => 15 });
    const r = t.growTree(cx, sy, cz);
    if (r !== 'big') continue;
    bigs++;
    let top = sy; for (let y = sy; y < 64; y++) if (world.get(cx, y, cz) === 4) top = y;
    tallest = Math.max(tallest, top - sy + 1);
    assert.equal(world.get(cx, sy, cz), 4, 'trunk replaces the sapling');
    let reach = 0;
    for (let x = cx - 8; x <= cx + 8; x++) for (let z = cz - 8; z <= cz + 8; z++) for (let y = sy; y < 64; y++) if (world.get(x, y, z) === 5) reach = Math.max(reach, Math.abs(x - cx), Math.abs(z - cz));
    assert.ok(reach >= 3, `canopy reach ${reach}`); // WorldGenTrees leaves reach 2; WorldGenBigTree branches reach further
  }
  assert.ok(bigs >= 1, 'a big roll occurred');
  assert.ok(tallest >= 5);
});
