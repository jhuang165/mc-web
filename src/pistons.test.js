import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  replayScenario,
  blockProperties,
  pistonBlockProperties,
  pistonOrientation,
  RedstoneWorld,
  PORTED_BLOCKS,
  PISTON,
  STICKY_PISTON,
  PISTON_HEAD,
  PISTON_MOVING,
  OBSIDIAN,
  BEDROCK,
} from "./redstone.js";

// Recorded by tools/verify-pistons.mjs from the unchanged 1.7.10 piston classes
// (BlockPistonBase, BlockPistonExtension, BlockPistonMoving, TileEntityPiston, World, WorldServer, Chunk).
const reference = JSON.parse(readFileSync(new URL("../public/research/piston-reference.json", import.meta.url)));
const byName = (n) => reference.scenarios.find((s) => s.name === n);
const cell = (s, x, y, z) => s.final.split(",")[(x * s.size[1] + y) * s.size[2] + z];

test("block property tables and Blocks ids match the original registry", () => {
  assert.deepEqual(blockProperties(), reference.blocks.props);
  assert.deepEqual(pistonBlockProperties(), reference.blocks.pistonProps);
  const f = reference.blocks.fields;
  assert.deepEqual([f.J, f.F, f.K, f.M, f.Z], [PISTON, STICKY_PISTON, PISTON_HEAD, PISTON_MOVING, OBSIDIAN]);
  for (const id of [PISTON, STICKY_PISTON, PISTON_HEAD, PISTON_MOVING]) assert.ok(PORTED_BLOCKS.includes(id), `block ${id} has behaviour`);
  assert.equal(BEDROCK, 7);
});

test("reference records the original class digests and the tick order it replays", () => {
  for (const c of ["app", "apq", "apr", "aps", "ahb", "mt", "apx"]) assert.match(reference.classes[c].sha256, /^[0-9a-f]{64}$/, c);
  assert.equal(reference.scenarios.length, 30);
});

for (const s of reference.scenarios)
  test(`native replay: ${s.name}`, () => {
    const mine = replayScenario(s);
    for (let t = 0; t < s.ticks; t++) {
      assert.equal(mine.calls[t], s.calls[t], `call log at tick ${t + 1}`);
      assert.deepEqual(mine.frames[t], s.frames[t], `block changes at tick ${t + 1}`);
      assert.deepEqual(mine.te[t], s.te[t], `piston tile entities at tick ${t + 1}`);
    }
    assert.equal(mine.final, s.final);
    assert.deepEqual(mine.pending, s.pending);
    assert.deepEqual(mine.queued, s.queued);
    assert.deepEqual(
      mine.sounds,
      s.sounds.map(([t, x, y, z, name, volume, pitch]) => [t, x, y, z, name, Math.fround(volume), Math.fround(pitch)]),
    );
    assert.deepEqual(mine.drops, s.drops);
    assert.equal(mine.rng, s.rng);
  });

test("reference covers the required behaviours", () => {
  const names = reference.scenarios.map((s) => s.name);
  for (const n of [
    "push-single", "sticky-pull-single", "push-12", "push-13-fails", "push-12-race-13th", "immovable-blocks", "push-drops",
    "normal-pulses", "sticky-pulses", "sticky-pull-exceptions", "quasi-connectivity", "piston-redstone-circuits",
    "double-extender", "double-extender-blocked", "clock-drives-pistons", "bounds-top", "bounds-bottom",
    "event-order-four", "event-order-chain", "placement-orientation", "head-and-base-removal",
  ])
    assert.ok(names.includes(n), n);
  const sounds = reference.scenarios.flatMap((s) => s.sounds);
  assert.ok(sounds.some((x) => x[4] === "tile.piston.out") && sounds.some((x) => x[4] === "tile.piston.in"));
  for (const x of sounds.filter((v) => v[4] === "tile.piston.out")) assert.ok(x[6] >= 0.6 && x[6] < 0.85, "out pitch is rand*0.25+0.6");
  for (const x of sounds.filter((v) => v[4] === "tile.piston.in")) assert.ok(x[6] >= 0.6 && x[6] < 0.75, "in pitch is rand*0.15+0.6");
  const progress = new Set(reference.scenarios.flatMap((s) => s.te.flat()).map((t) => t[8]));
  assert.deepEqual([...progress].sort(), [0.5, 1], "moving blocks are recorded at progress 0.5 and 1");
  const dropped = new Set(reference.scenarios.flatMap((s) => s.drops).map((d) => d[4]));
  for (const item of [37, 38, 331, 69, 356, 76, 77]) assert.ok(dropped.has(item), `item ${item} dropped by a pushed block`);
});

test("push limit: twelve blocks move, thirteen do not", () => {
  const ok = byName("push-12"), bad = byName("push-13-fails");
  assert.ok(ok.sounds.some((x) => x[4] === "tile.piston.out"));
  assert.ok(!bad.sounds.some((x) => x[4] === "tile.piston.out"), "canExtend refuses 13 blocks");
  assert.equal(bad.te.flat().length, 0, "nothing starts moving");
  assert.ok(!byName("push-12-race-13th").sounds.some((x) => x[4] === "tile.piston.out"), "the delivered event re-checks the line");
});

test("immovable and tile-entity blocks stay put; obsidian and bedrock are refused", () => {
  const s = byName("immovable-blocks");
  // Lanes run along z at x 1..3: obsidian (1), bedrock (4), chest (7), extended piston (10), stone behind obsidian (13),
  // retracted piston (16), lone head (19), plain stone (22).
  assert.equal(cell(s, 2, 1, 1), "49", "obsidian does not move");
  assert.equal(cell(s, 2, 1, 4), "7", "bedrock does not move");
  assert.equal(cell(s, 2, 1, 7), "54", "a tile-entity block (chest) does not move");
  assert.equal(cell(s, 2, 1, 10), "33:13", "an extended piston base does not move");
  assert.equal(cell(s, 2, 1, 13), "1", "stone behind obsidian does not move");
  assert.equal(cell(s, 3, 1, 13), "49");
  assert.equal(cell(s, 3, 1, 16), "33:5", "a retracted piston can be pushed");
  assert.equal(cell(s, 3, 1, 22), "1", "plain stone is the control");
  assert.deepEqual(s.sounds.filter((x) => x[4] === "tile.piston.out").map((x) => x[3]), [16.5, 22.5]);
});

test("sticky pull: normal piston leaves the block, sticky takes it back", () => {
  const n = byName("push-single"), st = byName("sticky-pull-single");
  assert.equal(cell(n, 3, 1, 1), "1", "normal piston leaves the stone pushed one cell");
  assert.equal(cell(n, 2, 1, 1), "0");
  assert.equal(cell(st, 3, 1, 1), "0");
  assert.equal(cell(st, 2, 1, 1), "1", "sticky piston pulls the stone back");
  assert.equal(st.sounds.find((x) => x[4] === "tile.piston.in")[1], 2.5, "the retract sound uses the pulled position");
});

test("placement orientation follows BlockPistonBase.determineOrientation", () => {
  const eye = (x, y, z, yaw) => ({ x, y, z, yaw });
  assert.equal(pistonOrientation(5, 2, 5, eye(5.5, 8, 5.5, 0)), 1, "placed far below the placer faces up");
  assert.equal(pistonOrientation(5, 12, 5, eye(5.5, 4, 5.5, 0)), 0, "placed far above the placer faces down");
  for (const [yaw, facing] of [[0, 2], [90, 5], [180, 3], [270, 4], [-90, 4], [45, 5], [44, 2]])
    assert.equal(pistonOrientation(5, 5, 8, eye(5.5, 5, 5.5, yaw)), facing, `yaw ${yaw}`);
  assert.equal(pistonOrientation(5, 5, 20, eye(5.5, 20, 5.5, 0)), 2, "far placers use yaw even when above");
  assert.deepEqual(byName("placement-orientation").sounds, []);
});

test("block events de-duplicate in the list being filled", () => {
  const w = new RedstoneWorld({ seed: 1 });
  assert.equal(w.queuedBlockEvents().length, 0);
  w.setRaw(0, 1, 0, PISTON, 1);
  w.addBlockEvent(0, 1, 0, PISTON, 0, 1);
  w.addBlockEvent(0, 1, 0, PISTON, 0, 1);
  assert.equal(w.queuedBlockEvents().length, 1, "identical events are de-duplicated");
  w.addBlockEvent(0, 1, 0, PISTON, 1, 1);
  assert.equal(w.queuedBlockEvents().length, 2);
  w.sendQueuedBlockEvents();
  assert.equal(w.queuedBlockEvents().length, 0, "delivery drains the list");
});
