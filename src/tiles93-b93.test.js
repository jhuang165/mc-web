// Batch 93 tiles93: the away clock follows /time and doDaylightCycle at the native point of the tick; the chest record `facing` fallback is gone after a load migration.
// Notes: .shared-memory/notes/tiles93-b93-track.md.
//  * WorldServer.tick (mt.b, bytecode-read): skylightSubtracted from the time, then the +1 (only while doDaylightCycle is on, read at that moment), then tickUpdates (command
//    blocks: /time, /gamerule), entities, tile entities. A shift or rule change anywhere in tick n first reaches tick n + 1's begin.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";
import { awayEntities } from "./away-entities.js";
import { Weather } from "./weather.js";
import { plain } from "./legacy-ai-replay.js";
import { skylightSubtracted, celestialAngle } from "./lighting.js";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { CHEST, chestFacing, migrateChestFacing } from "./chest.js";

await populationBlockMapperReady;
const src = (f) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
const run = (plan, opts = {}) => {
  const tiles = { furnaces: {}, chests: {}, dispensers: {}, brewing: {}, hoppers: {} };
  return awayEntities({ entities: {}, editSequence: 0, idBase: 1, ...plan }, { world: plain([]), weather: new Weather(), tiles, ticking: () => true, entityTicks: () => true,
    rt: { redstone: { collide() {} }, flush() {}, fluidChanges() {} }, fire: { ignite() {} }, readStack: (s) => s, maxStack: () => 64, ...opts });
};
const native = (preStep) => skylightSubtracted(celestialAngle(preStep + 1), 0, 0);
let step = 0;
for (let t = 11000; t < 14000; t++) if (native(t) !== native(t - 1)) { step = t; break; }
const sky = (ents) => ents.mobs.lightAt(0, 100, 0);
const lightFor = (pre) => Math.max(0, 15 - native(pre));

test("entity clock: a /time shift after the entity tick (the tile pass) reaches the next tick's darkness", () => {
  const ents = run({ time: step + 20, ticks: 20 }); // starts at `step`
  ents.beginTick(); const first = sky(ents); ents.tick();
  assert.equal(first, lightFor(step));
  ents.shiftTime(-5000); // from the tile pass of tick 0
  assert.equal(sky(ents), first, "still the darkness this tick computed");
  ents.endTick(); ents.beginTick();
  assert.equal(sky(ents), lightFor(step + 1 - 5000), "tick 1 starts from the shifted time");
});

test("entity clock: a /time shift before the entity tick (a command block) leaves this tick's darkness alone", () => {
  const ents = run({ time: step + 20, ticks: 20 });
  ents.beginTick(); const first = sky(ents);
  ents.shiftTime(-5000);
  assert.equal(sky(ents), first);
  ents.tick(); ents.endTick(); ents.beginTick();
  assert.equal(sky(ents), lightFor(step + 1 - 5000));
});

test("entity clock: doDaylightCycle turned off in a tick freezes the clock from the next tick", () => {
  let on = true;
  const ents = run({ time: step + 20, ticks: 20 }, { cycling: () => on });
  ents.beginTick(); ents.tick(); on = false; ents.endTick(); // the rule was on when the tick began: it still moved
  ents.beginTick(); assert.equal(sky(ents), lightFor(step + 1));
  ents.tick(); ents.endTick(); ents.beginTick();
  assert.equal(sky(ents), lightFor(step + 1), "frozen");
});

// ---- the whole run: the saved time shift carries a mid-run rule change ----
const STONE = 3, COMMAND_BLOCK = 139;
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x, z, blocks, meta };
});
const base = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], player: { time: 6000 } };
const runTimed = (blocks, ticks = 100) => {
  const root = { ...base, redstone: { version: 1, clock: 0, time: 0, pending: blocks.map(([, t], i) => [3 + i, 11, 3, 137, t, 0, 1 + i]), events: [] },
    commandBlocks: blocks.map(([c], i) => ({ x: 3 + i, y: 11, z: 3, command: c, successCount: 0, customName: "@", trackOutput: true, lastOutput: "" })) };
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, ticks, 2), chunks: floorChunks(cols), records: [] };
  for (let i = 0; i < blocks.length; i++) { const c = plan.chunks.find((k) => k.x === 0 && k.z === 0), j = (((3 + i) & 15) * 16 + 3) * 256 + 11; c.blocks[j] = COMMAND_BLOCK; }
  return runAway(plan);
};

test("away run: a /gamerule doDaylightCycle false at tick n leaves the clock short by the ticks after it", async () => {
  const off = await runTimed([["gamerule doDaylightCycle false", 30]]), on = await runTimed([["say x", 30]]);
  assert.equal(on.timeShift, 0);
  const n = 30; // fires in tick 30 (index), which still increments; ticks 31..99 stand still
  assert.ok(off.timeShift <= -(99 - n - 1) && off.timeShift >= -(99 - n + 1), `shift ${off.timeShift}`);
});

test("away run: a /time set after a rule change is measured against the frozen clock", async () => {
  const r = await runTimed([["gamerule doDaylightCycle false", 20], ["time set 5000", 40]]);
  const frozen = r.timeShift; // clock stops at the end of tick 20, /time set 5000 then lands the clock on 5000
  // the saved clock end is plan.time + shift = 5000, the frozen clock does not move after the set
  assert.equal(6000 + frozen, 5000);
});

// ---- the chest record facing fallback ----
test("old save: the record's facing migrates into the cell on load, then the cell alone decides", () => {
  const data = { chests: { "14,40,14": { facing: 5, items: [] }, "15,40,15": { facing: 2, items: [] } } };
  const sv = new Survival(data, "survival");
  const w = new World("tiles93", "meadow", 3);
  for (let x = 10; x < 20; x++) for (let z = 10; z < 20; z++) for (let y = 40; y < 44; y++) w.set(x, y, z, 0, false);
  w.set(14, 40, 14, CHEST); w.set(15, 40, 15, CHEST); w.put(15, 40, 15, CHEST, 4, true);
  assert.equal(chestFacing(w, sv.chests, 14, 40, 14), 3, "no runtime fallback to the record");
  for (const key of Object.keys(sv.chests)) migrateChestFacing(w, sv.chests, ...key.split(",").map(Number)); // main.js's load loop
  assert.equal(w.getMeta(14, 40, 14), 5);
  assert.equal(chestFacing(w, sv.chests, 14, 40, 14), 5);
  assert.equal(w.getMeta(15, 40, 15), 4, "a cell with 2-5 metadata is never overwritten by a stale record");
  assert.match(src("main.js"), /for \(const key of Object\.keys\(survival\.chests\)\) migrateChestFacing\(world, survival\.chests/);
});
