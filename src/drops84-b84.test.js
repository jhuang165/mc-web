// Batch 84 drops84: BlockSkull.breakBlock on every setBlock, support-loss drops on the dedicated server, and drops in Creative worlds.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, LADDER } from "./world.js";
import { fromOriginal } from "./block-registry.js";
import { Skulls, SKULL, ITEM_SKULL, installSkullBreak, tryBuildWither } from "./skull.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { CARPET } from "./colored-blocks.js";

const src = (f) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
const internal = (o, m = 0) => fromOriginal(o, m).id;
function flat() {
  const world = new World("b84-drops");
  for (let x = 50; x <= 80; x++) for (let z = 55; z <= 75; z++) for (let y = 9; y <= 20; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  return world;
}
function server(gameMode) {
  const world = flat();
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world, gameMode, mobs: false });
}

test("world.set on a skull runs the breakBlock hook once, with the old metadata; bit 8 drops nothing", () => {
  const w = flat(), skulls = new Skulls(), got = [];
  installSkullBreak(w, () => skulls, (stacks, x, y, z) => got.push([stacks, x, y, z]));
  w.set(60, 10, 60, SKULL, true, 1); skulls.create(60, 10, 60, 3, 0, "Notch");
  w.set(60, 10, 60, 0, true, 0);
  assert.equal(got.length, 1);
  assert.equal(got[0][0][0].id, ITEM_SKULL); assert.equal(got[0][0][0].damage, 3);
  assert.equal(skulls.tile(60, 10, 60), null, "the tile goes with the block");
  w.set(61, 10, 60, SKULL, true, 9); skulls.create(61, 10, 60, 1);
  w.set(61, 10, 60, 0, true, 0);
  assert.equal(got.length, 1, "metadata bit 8 (a Creative harvest) drops nothing");
  w.set(62, 10, 60, SKULL, true, 1); skulls.create(62, 10, 60, 0);
  w.set(62, 10, 60, SKULL, true, 2); // same block, other metadata: no breakBlock
  assert.equal(got.length, 1);
  w.set(63, 10, 60, SKULL, true, 1); // no tile: nothing to drop
  w.set(63, 10, 60, 0, true, 0);
  assert.equal(got.length, 1);
});

test("the server drops a skull on /setblock-style removal, in Survival and Creative", () => {
  for (const mode of ["survival", "creative"]) {
    const s = server(mode);
    s.world.set(70, 10, 64, SKULL, true, 1); s.tileEntities.skulls.create(70, 10, 64, 1);
    s.world.set(70, 10, 64, 0, true, 0);
    const n = s.items.items.filter((e) => e.stack.id === ITEM_SKULL && e.stack.damage === 1).length;
    assert.equal(n, 1, `${mode}: one wither skull`);
    assert.equal(s.tileEntities.skulls.tile(70, 10, 64), null);
  }
});

test("the Wither's own build clears its skulls without dropping them", () => {
  const w = flat(), skulls = new Skulls(), got = [], SAND = 88;
  installSkullBreak(w, () => skulls, (...a) => got.push(a));
  for (let i = 0; i < 3; i++) w.set(60 + i, 12, 60, SAND, true, 0);
  w.set(61, 11, 60, SAND, true, 0); w.set(61, 12, 60, SAND, true, 0);
  for (let i = 0; i < 3; i++) { w.set(60 + i, 13, 60, SKULL, true, 1); skulls.create(60 + i, 13, 60, 1); }
  const r = tryBuildWither(w, skulls, 62, 13, 60, { difficulty: 2, spawn: () => true, soulSand: SAND });
  assert.ok(r, "the Wither was built");
  assert.equal(got.length, 0, "no skull drops from the build");
});

test("the server pops a floating carpet like single player; Creative worlds drop too", () => {
  for (const mode of ["survival", "creative"]) {
    const s = server(mode);
    s.world.set(70, 10, 64, 3, true, 0); s.world.set(70, 11, 64, CARPET, true, 5);
    s.world.set(70, 10, 64, 0, true, 0);
    assert.equal(s.world.get(70, 11, 64), 0, `${mode}: the carpet popped`);
    assert.equal(s.items.items.length, 1, `${mode}: one drop`);
    assert.equal(s.items.items[0].stack.damage, 5, "the carpet's colour");
  }
});

test("source: the away world's redstone drop hook takes the engine position as is, the server's drop paths have no Survival gate", () => {
  assert.match(src("away-world.js"), /drop: \(x, y, z, d\) => spill\(d, x, y, z\)/);
  assert.doesNotMatch(src("multiplayer/server-redstone-drops.js"), /serverItems\?\.survival\) return/);
  assert.doesNotMatch(src("multiplayer/server-items.js"), /get stacksDrop\(\) \{ return this\.survival/);
});
