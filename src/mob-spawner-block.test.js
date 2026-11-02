// The monster spawner block (BlockMobSpawner, original 52) against
// public/research/fence-rail-reference.json; the spawning logic is tested in mob-spawner.test.js.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLOCKS, MOB_SPAWNER, opaqueCube, normalCube, solidBlock, collisionBoxes } from "./world.js";
import { SPAWNER_HARDNESS, spawnerXp, spawnerRecord, placeSpawner, watchSpawnerBlocks } from "./spawner-block.js";
import { MobSpawners } from "./mob-spawner.js";
import { JavaRandom } from "./java-random.js";
import { toOriginal, fromOriginal } from "./block-registry.js";
import { lightOpacity } from "./lighting.js";
import { MATERIALS } from "./survival.js";
import { miningState, digSpeed } from "./mining.js";
import { CREATIVE_TABS, SEARCH_ORDER, entryId } from "./creative.js";
import { ORIGINAL_ITEMS } from "./region-import.js";
import { breakPlayerBlock } from "./block-break-simulation.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/fence-rail-reference.json", import.meta.url)));
const record = (c, block) => ref.records.find((r) => r.case === c && (!block || r.block === block));

function grid(cells = {}) {
  const map = new Map(Object.entries(cells)), metas = new Map();
  const w = {
    get: (x, y, z) => map.get(`${x},${y},${z}`) ?? 0,
    getMeta: (x, y, z) => metas.get(`${x},${y},${z}`) ?? 0,
    set(x, y, z, b, track = true, meta = 0) {
      const k = `${x},${y},${z}`, old = w.get(x, y, z);
      if (b) map.set(k, b); else map.delete(k);
      metas.set(k, meta);
      if (track) w.onChange?.(x, y, z, old, b);
      return true;
    },
    solid(x, y, z) { return solidBlock(this.get(x, y, z)); },
  };
  return w;
}

test("spawner block facts match BlockMobSpawner", () => {
  const f = record("facts", "mob_spawner");
  assert.equal(BLOCKS[MOB_SPAWNER].name, "Monster spawner");
  assert.deepEqual(toOriginal(MOB_SPAWNER, 0), [52, 0]);
  assert.deepEqual(fromOriginal(52, 0), { id: MOB_SPAWNER, meta: 0, exact: true });
  assert.equal(lightOpacity(MOB_SPAWNER), f.opacity);
  assert.equal(opaqueCube(MOB_SPAWNER), f.opaque);
  assert.equal(normalCube(MOB_SPAWNER), f.normalCube);
  assert.equal(solidBlock(MOB_SPAWNER), f.blocksMovement);
  assert.deepEqual(collisionBoxes(grid({ "0,0,0": MOB_SPAWNER }), 0, 0, 0), [[0, 0, 0, 1, 1, 1]]);
  assert.equal(SPAWNER_HARDNESS, f.hardness);
  assert.equal(MATERIALS[MOB_SPAWNER].hardness, f.hardness);
  assert.equal(f.drop, null);
  assert.equal(MATERIALS[MOB_SPAWNER].drop, 0);
  assert.equal(f.requiresTool, true);
  assert.equal(miningState(MOB_SPAWNER, MATERIALS[MOB_SPAWNER], null).harvest, false);
  assert.equal(miningState(MOB_SPAWNER, MATERIALS[MOB_SPAWNER], { kind: "pickaxe", tier: 0, speed: 2 }).harvest, true);
  assert.equal(digSpeed(MOB_SPAWNER, { kind: "pickaxe", speed: 2 }), 2);
  // No item: no creative listing, no pick-block item and no original item mapping.
  assert.equal(record("spawnerXp").pick, null);
  assert.ok(BLOCKS[MOB_SPAWNER].hidden);
  assert.ok(!CREATIVE_TABS.some((t) => t.items.some((e) => entryId(e) === MOB_SPAWNER)));
  assert.ok(!SEARCH_ORDER.some((e) => entryId(e) === MOB_SPAWNER));
  assert.equal(ORIGINAL_ITEMS[52], undefined);
});

test("experience is 15 + rand(15) + rand(15) from World.rand", () => {
  const r = record("spawnerXp");
  assert.deepEqual(Array.from({ length: r.seeds }, (_, seed) => spawnerXp(new JavaRandom(seed))), r.xp);
  assert.equal(MATERIALS[MOB_SPAWNER].xp, spawnerXp);
  // A Math.random-style function works too, always within 15..43.
  for (let i = 0; i < 100; i++) {
    const v = spawnerXp(Math.random);
    assert.ok(v >= 15 && v <= 43);
  }
});

function breakWorld(tool, creative = false) {
  const world = grid({ "4,4,4": MOB_SPAWNER }), orbs = [], drops = [];
  const state = {
    world,
    survival: { mining: (b, t) => miningState(b, MATERIALS[b], t), count: () => 0, furnaces: {}, chests: {}, exhaust() {}, wearBlock() {} },
    items: { dropBlock: (s) => drops.push(...s), spill() {} },
    xpOrbs: { spawn: (value, p) => orbs.push([value, p]) },
    farming: { observe() {} },
    trees: { random: Math.random },
    heldTool: tool,
  };
  return { state, world, orbs, drops };
}

test("breaking a spawner drops experience only when harvested in Survival", () => {
  const pick = { kind: "pickaxe", tier: 0, speed: 2 };
  const seeded = (seed) => { const r = new JavaRandom(seed); return () => r.nextInt(15) / 15 + 1e-9; };
  let { state, world, orbs, drops } = breakWorld(pick);
  assert.equal(breakPlayerBlock(state, [4, 4, 4], { random: seeded(0) }), true);
  assert.equal(world.get(4, 4, 4), 0);
  assert.deepEqual(drops, []);
  assert.deepEqual(orbs, [[28, { x: 4.5, y: 4.5, z: 4.5 }]]);
  ({ state, world, orbs, drops } = breakWorld(null));
  breakPlayerBlock(state, [4, 4, 4]);
  assert.deepEqual([orbs, drops, world.get(4, 4, 4)], [[], [], 0]);
  ({ state, world, orbs, drops } = breakWorld(pick));
  breakPlayerBlock(state, [4, 4, 4], { creative: true });
  assert.deepEqual([orbs, drops], [[], []]);
});

test("placing a spawner registers its tile record; removing the block drops it", () => {
  const world = grid(), spawners = new MobSpawners();
  watchSpawnerBlocks(world, spawners);
  const rec = spawnerRecord(3, 10, -2, "CaveSpider", { delay: 40 });
  assert.deepEqual(rec, { delay: 40, x: 3, y: 10, z: -2, entityId: "CaveSpider" });
  assert.equal(placeSpawner(world, rec, spawners), true);
  assert.equal(world.get(3, 10, -2), MOB_SPAWNER);
  assert.equal(spawners.get(3, 10, -2).entityId, "CaveSpider");
  assert.equal(spawners.get(3, 10, -2).delay, 40);
  // Rewriting the cell with a spawner keeps the record; any other block removes it.
  world.set(3, 10, -2, MOB_SPAWNER);
  assert.equal(spawners.size, 1);
  world.set(3, 10, -2, 0);
  assert.equal(spawners.get(3, 10, -2), null);
  assert.equal(spawners.size, 0);
  // Placement still works without a spawner registry (generation-only callers).
  assert.equal(placeSpawner(world, spawnerRecord(0, 5, 0), null, false), true);
  assert.equal(world.get(0, 5, 0), MOB_SPAWNER);
});
