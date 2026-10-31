// Falling sand and gravel, replayed against public/research/plant-reference.json (BlockFalling,
// BlockSand, BlockGravel and EntityFallingBlock from the unchanged 1.7.10 classes).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { World, SAND, GRAVEL, CACTUS, WATER, HEIGHT } from "./world.js";
import { JRandom } from "./lakes.js";
import { FallingBlocks, canFallBelow, gravelDrop, FALL_DELAY, FALLING_Y_OFFSET, isFallingBlock, spawnFalling } from "./falling.js";
import { MockWorld, toGame } from "../tools/plant-fixtures.mjs";

const reference = JSON.parse(await readFile(new URL("../public/research/plant-reference.json", import.meta.url)));
const records = (name) => reference.records.filter((r) => r.case === name);
const MC_ITEM = { [SAND]: 12, [GRAVEL]: 13, 313: 318 };

test("BlockFalling.func_149831_e: air, fire, water and lava", () => {
  for (const [id, meta, expected] of records("canFallBelow")[0].results) assert.equal(canFallBelow(toGame([id, meta])[0]), expected, `${id}:${meta}`);
  assert.ok(isFallingBlock(SAND) && isFallingBlock(GRAVEL) && !isFallingBlock(CACTUS));
});

test("BlockGravel.getItemDropped: flint 1 in 10 - 3 * fortune (fortune capped at 3)", () => {
  for (const r of records("gravelDrops")) {
    const rand = new JRandom(r.seed);
    assert.deepEqual(Array.from({ length: 60 }, () => MC_ITEM[gravelDrop(rand, r.fortune)]), r.drops, `fortune ${r.fortune}`);
  }
});

// PlantProbe's fall fixtures: a stone floor below y 1 and something at (0, 1, 0).
function fixture(r) {
  const at = { torch: [50, 5], tallgrass: [31, 1], flower: [37, 0], snow3: [78, 2], snow0: [78, 0], lava: [11, 0], cactus: [81, 0], web: [30, 0], reeds: [83, 0], "gravel-torch": [50, 5], "red-sand-torch": [50, 5], sapling: [6, 0], wheat: [59, 7] }[r.name];
  return (x, y, z) => {
    if (y < 1) return [1, 0];
    if (r.name === "supported") return y === 4 && x === 0 && z === 0 ? [1, 0] : [0, 0];
    if (r.name === "fire-below") return y === 4 && x === 0 && z === 0 ? [51, 0] : [0, 0];
    if (r.name === "water") return x === 0 && z === 0 && y <= 3 ? [9, 0] : [0, 0];
    if (r.name === "ladder") return x === 0 && z === 1 && y <= 2 ? [1, 0] : x === 0 && z === 0 && y === 1 ? [65, 2] : [0, 0];
    if (!at) return [0, 0];
    return x === 0 && z === 0 && y === 1 ? at : [0, 0];
  };
}

test("EntityFallingBlock: every tick of 20 falls matches the original", () => {
  const rs = records("fall");
  assert.equal(rs.length, 20);
  for (const r of rs) {
    const w = new MockWorld(fixture(r)), items = [], block = r.block === 12 ? SAND : GRAVEL;
    w.put(0, r.top, 0, block, r.meta);
    const fb = new FallingBlocks(w, { drop: (s, x, y, z) => items.push(s) });
    // onBlockAdded: one update in tickRate 2.
    fb.schedule(0, r.top, 0, block);
    const [due] = fb.pending.values();
    assert.equal(`0,${r.top},0,${r.block},${due.time - fb.time}`, r.scheduled, r.name);
    assert.equal(FALL_DELAY, 2);
    const e = fb.fall(0, r.top, 0);
    if (!r.start) {
      assert.equal(e, null, r.name);
      assert.equal(r.ticks.length, 0);
      continue;
    }
    assert.deepEqual([e.x, e.y + FALLING_Y_OFFSET, e.z, e.y, FALLING_Y_OFFSET], [...r.start.slice(0, 4), Math.fround(r.start[4])], r.name); // yOffset is a float
    r.ticks.forEach(([posY, motionY, onGround, dead], t) => {
      fb.tickEntity(e);
      const m = `${r.name} tick ${t + 1}`;
      assert.equal(e.y + FALLING_Y_OFFSET, posY, m);
      assert.equal(e.vy + 0, motionY + 0, m); // the landing bounce's -0.0 is printed as 0 by the probe
      assert.equal(e.onGround, onGround, m);
      assert.equal(e.dead, dead, m);
    });
    assert.ok(e.dead, r.name);
    assert.deepEqual(w.sets, r.sets.map((s) => s.slice(0, 5)), r.name);
    assert.deepEqual(items.map((s) => [MC_ITEM[s.id], s.count, s.damage]), r.items, r.name);
  }
});

test("a running world: placed sand falls after 2 ticks, a column follows, saves keep entities", () => {
  const w = new World("falling", "meadow", 7);
  for (let x = 20; x < 26; x++) for (let z = 20; z < 26; z++) for (let y = 1; y < HEIGHT; y++) w.put(x, y, z, y < 10 ? 3 : 0, 0, false);
  const changes = [], fb = new FallingBlocks(w, { apply: (c) => changes.push(...c) }).watch();
  // A column of three in mid-air, placed bottom first.
  w.set(22, 20, 22, SAND);
  w.set(22, 21, 22, SAND);
  w.set(22, 22, 22, GRAVEL);
  assert.equal(fb.pending.size, 3);
  fb.tick();
  assert.equal(fb.entities.length, 0);
  fb.tick();
  // The bottom update spawns its entity, which takes its source block away on its first tick, in
  // the same tick (entities update after the scheduled ticks). The blocks above were still
  // supported at their own update, so the removal reschedules them: the column follows 2 ticks apart.
  assert.equal(fb.entities.length, 1);
  assert.deepEqual([20, 21, 22].map((y) => w.get(22, y, 22)), [0, SAND, GRAVEL]);
  fb.tick();
  fb.tick();
  assert.equal(fb.entities.length, 2);
  assert.deepEqual([20, 21, 22].map((y) => w.get(22, y, 22)), [0, 0, GRAVEL]);
  fb.tick();
  fb.tick();
  assert.equal(fb.entities.length, 3);
  const saved = fb.serialize();
  assert.equal(saved.length, 3);
  const restored = new FallingBlocks(w, {}, JSON.parse(JSON.stringify(saved)));
  assert.equal(restored.entities.length, 3);
  for (let t = 0; t < 40; t++) fb.tick();
  assert.equal(fb.entities.length, 0);
  assert.deepEqual([10, 11, 12].map((y) => w.get(22, y, 22)), [SAND, SAND, GRAVEL]);
  // Sand already resting on the ground stays; taking the ground away makes it fall.
  w.set(24, 10, 24, SAND);
  for (let t = 0; t < 5; t++) fb.tick();
  assert.equal(w.get(24, 10, 24), SAND);
  w.set(24, 9, 24, 0);
  for (let t = 0; t < 30; t++) fb.tick();
  assert.equal(w.get(24, 9, 24), SAND);
  assert.equal(w.get(24, 10, 24), 0);
  // Sand falls into water and settles on the bed, replacing the water cell.
  w.set(21, 9, 21, 0);
  w.set(21, 9, 21, WATER, false);
  w.set(21, 10, 21, SAND);
  for (let t = 0; t < 30; t++) fb.tick();
  assert.equal(w.get(21, 9, 21), SAND);
  assert.ok(changes.length > 0);
  // Bad saves are ignored.
  assert.equal(new FallingBlocks(w, {}, [{ block: 3, x: 1, y: 1, z: 1, vx: 0, vy: 0, vz: 0, ticks: 1 }, null, { block: SAND }]).entities.length, 0);
  assert.equal(spawnFalling(SAND, 0, 1, 2, 3).y, 2.5 - FALLING_Y_OFFSET);
});

test("wake: edited sand left unsupported in a save falls once loaded", () => {
  const w = new World("falling", "meadow", 7);
  for (let y = 1; y < HEIGHT; y++) w.put(40, y, 40, y < 10 ? 3 : 0, 0, false);
  w.set(40, 15, 40, SAND);
  const fb = new FallingBlocks(w).watch();
  fb.wake();
  for (let t = 0; t < 40; t++) fb.tick();
  assert.equal(w.get(40, 10, 40), SAND);
});
