// Batch 91 tiles91: chest facing in block metadata, and the mob readers of skylightSubtracted. Notes: .shared-memory/notes/tiles91-b91-track.md.
//  * BlockChest (ajx) keeps its facing in metadata 2-5; the port's cell carries it (the record's `facing` is a save fallback).
//  * WorldServer.tick calculates skylightSubtracted before adding 1 to the clock, so the entity pass reads that value (sensorSky), not the scene's post-step one.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { populationBlockMapperReady } from "./population-world.js";
import { fromOriginal, toOriginal } from "./block-registry.js";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { createCommandHost } from "./command-host.js";
import { createCommandRunner } from "./commands.js";
import { CHEST, placeChest, settleFacing, chestFacing, migrateChestFacing, adoptChest, newChest } from "./chest.js";
import { sensorSky } from "./daylight-sensor-time.js";
import { skylightSubtracted, celestialAngle as sceneAngle } from "./lighting.js";
import { celestialAngle } from "./clock.js";

await populationBlockMapperReady;
const STONE = 3;
const flat = () => {
  const w = new World("tiles91", "meadow", 3);
  for (let x = 10; x < 20; x++) for (let z = 10; z < 20; z++) for (let y = 40; y < 44; y++) w.set(x, y, z, 0, false);
  return w;
};

test("placeChest writes the facing into the cell metadata, for a single chest and for both halves of a pair", () => {
  const w = flat(), chests = {};
  w.set(12, 40, 12, CHEST); placeChest(w, chests, 12, 40, 12, Math.PI / 2); // yaw east -> 5
  assert.equal(w.getMeta(12, 40, 12), 5);
  assert.equal(chests["12,40,12"].facing, 5, "the record keeps a fallback copy");
  w.set(13, 40, 12, CHEST); placeChest(w, chests, 13, 40, 12, 0); // pair along x, yaw south: both turn to 3
  assert.deepEqual([w.getMeta(12, 40, 12), w.getMeta(13, 40, 12)], [3, 3]);
  // settleFacing from an opaque neighbour: a wall to the south faces north (2), meta written
  w.set(16, 40, 15, STONE); w.set(16, 40, 14, CHEST); settleFacing(w, chests, 16, 40, 14);
  assert.equal(w.getMeta(16, 40, 14), 2);
});

test("a pair reads its partner's facing from the cell metadata (func_149954_e)", () => {
  const w = flat(), chests = {};
  w.set(12, 40, 12, CHEST); w.put(12, 40, 12, CHEST, 4, true); // partner already faces west, no record at all
  w.set(12, 40, 13, CHEST);
  settleFacing(w, chests, 12, 40, 13);
  assert.equal(w.getMeta(12, 40, 13), 4, "aligned with the partner's metadata");
});

test("old saves: the record's facing is the fallback and moves into the cell; a cell facing wins over a stale record", () => {
  const w = flat(), chests = { "14,40,14": newChest(5), "15,40,15": newChest(2) };
  w.set(14, 40, 14, CHEST); w.set(15, 40, 15, CHEST);
  assert.equal(w.getMeta(14, 40, 14), 0);
  assert.equal(chestFacing(w, chests, 14, 40, 14), 3, "b93: meta 0 no longer reads the record");
  assert.equal(migrateChestFacing(w, chests, 14, 40, 14), true);
  assert.equal(w.getMeta(14, 40, 14), 5);
  assert.equal(migrateChestFacing(w, chests, 14, 40, 14), false, "already migrated");
  w.put(15, 40, 15, CHEST, 4, true);
  assert.equal(chestFacing(w, chests, 15, 40, 15), 4);
  assert.equal(migrateChestFacing(w, chests, 15, 40, 15), false, "the cell is never overwritten from the record");
  assert.equal(chestFacing(w, {}, 18, 40, 18), 3, "neither decides: 3");
  // a block saved without tile data takes its cell's facing
  w.set(17, 40, 17, CHEST); w.put(17, 40, 17, CHEST, 5, true);
  const none = {}; adoptChest(w, none, 17, 40, 17);
  assert.equal(none["17,40,17"].facing, 5);
});

test("block registry: the chest cell carries the facing both ways", () => {
  const f = fromOriginal(54, 4);
  assert.equal(f.meta, 4);
  assert.equal(f.exact, true);
  assert.equal(f.state, undefined);
  assert.deepEqual(toOriginal(f.id, 5, { facing: 2 }), [54, 5], "cell metadata beats a record's facing");
  assert.deepEqual(toOriginal(f.id, 0, { facing: 2 }), [54, 2], "record facing fills a cell without 2-5");
  assert.deepEqual(toOriginal(f.id, 0), [54, 3]);
  const stray = fromOriginal(54, 0);
  assert.equal(stray.exact, false);
  assert.equal(stray.meta, 0);
  const trapped = fromOriginal(146, 5);
  assert.equal(trapped.meta, 5);
  assert.deepEqual(toOriginal(trapped.id, trapped.meta), [146, 5]);
});

test("/setblock chest: the cell metadata is the settled facing and blockAt reads it", () => {
  const world = flat(), survival = new Survival({}, "creative");
  const env = { world: () => world, survival: () => survival, active: () => ({ mode: "creative", allowCommands: true }), position: () => ({ x: 15, y: 41, z: 15 }),
    changed() {}, refreshInventory() {}, stackName: () => "stack", updateBlock() {}, destroyBlock(x, y, z) { world.set(x, y, z, 0); }, spillTile() {}, closeTile() {} };
  const h = createCommandHost(env); h.print = () => {};
  const run = (s) => createCommandRunner(h).run(s);
  world.set(12, 41, 13, STONE); // wall south of the chest: faces north
  run("/setblock 12 41 12 chest 5");
  assert.equal(world.getMeta(12, 41, 12), 2);
  assert.deepEqual(h.blockAt(12, 41, 12), { id: 54, meta: 2 });
  assert.equal(survival.chests["12,41,12"].facing, 2);
  // the same facing again is "no change" (Chunk.func_150807_a), a different one replaces the chest
  assert.equal(run("/setblock 12 41 12 chest 2") !== undefined, true);
});

test("mob readers of skylightSubtracted use the native pre-step value (it matches the scene while the clock moves, and leads it by one tick when frozen)", () => {
  let step = -1;
  for (let t = 1000; t < 24000 && step < 0; t++) if (skylightSubtracted(celestialAngle(t + 1, 0), 0, 0) !== skylightSubtracted(celestialAngle(t, 0), 0, 0)) step = t;
  assert.ok(step > 0);
  const scene = (t) => skylightSubtracted(sceneAngle(t), 0, 0); // Scene.setTime: lighting.celestialAngle(ticks) with partial 0
  // moving clock: post-step time T reads the same value in both conventions
  for (let t = step - 3; t <= step + 3; t++) assert.equal(sensorSky(t, true, 0, 0).subtracted, scene(t), `cycling, t=${t}`);
  // frozen clock: native samples (T+1)/24000, the scene's T/24000 is one tick behind exactly at a step
  assert.equal(sensorSky(step, false, 0, 0).subtracted, scene(step + 1));
  assert.notEqual(sensorSky(step, false, 0, 0).subtracted, scene(step), "the frozen-clock tick where the old scene value was stale");
  const src = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  for (const hook of ["mobs.lightAt =", "mobs.isDaytime =", "mobs.lightSubtracted ="]) {
    const line = src.split("\n").find((l) => l.includes(hook));
    assert.ok(line.includes("entitySubtracted()"), hook);
    assert.ok(!/scene\.subtracted/.test(line), hook + " must not read the scene value");
  }
  assert.match(src, /tickSurvival\(inWater, oldPosition, inLavaNow\);\s*entitySub = world\.dimension \? null : sensorSky\(survival\.time, !survival\.timeFrozen/);
  assert.match(src, /wrapMobHooks\(mobs, mobs\.ring, \(\) => entitySubtracted\(\)\)/);
  assert.match(src, /lightValue: \(x, y, z\) => level\(x, y, z, entitySubtracted\(\)\)/);
});
