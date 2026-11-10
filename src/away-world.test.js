import { test } from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan, inSpawnArea, AWAY_ENTITY_TICKS, SPAWN_RADIUS, MAX_AWAY_TICKS } from "./away-world.js";

await populationBlockMapperReady;
const STONE = 3, WATER = 10, ORE = 15, FUEL = 4, INGOT = 301;
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x, z, blocks, meta };
});
const setBlock = (chunks, x, y, z, b, m = 0) => {
  const c = chunks.find((k) => k.x === x >> 4 && k.z === z >> 4), i = ((x & 15) * 16 + (z & 15)) * 256 + y;
  c.blocks[i] = b; c.meta[i] = m;
};
const base = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0] };
const furnace = (n) => ({ items: [{ id: ORE, count: n, damage: 0 }, { id: FUEL, count: 64, damage: 0 }, null], burn: 0, burnTotal: 0, cook: 0 });
const run = (root, ticks, edit = () => {}) => {
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, ticks), chunks: floorChunks(cols), records: [] };
  edit(plan.chunks);
  return runAway(plan);
};
const cellOf = (r, x, y, z) => {
  const col = r.columns.find((c) => c.x === x >> 4 && c.z === z >> 4), cell = ((x & 15) << 12) | ((z & 15) << 8) | y;
  const i = col ? [...col.cells].indexOf(cell) : -1;
  return i < 0 ? null : col.values[i] & 255;
};

test("the spawn area is the chunks whose centre lies within 128 blocks of the world spawn", () => {
  const spawn = [0, 64, 0];
  assert.equal(SPAWN_RADIUS, 128);
  assert.ok(inSpawnArea(spawn, 7, 7) && inSpawnArea(spawn, -8, -8), "chunk 7 centre is 120, chunk -8 centre is -120");
  assert.ok(!inSpawnArea(spawn, 8, 0) && !inSpawnArea(spawn, 0, -9), "centre 136 and -136 unload");
  assert.ok(inSpawnArea([100, 64, 100], 13, 13) && !inSpawnArea([100, 64, 100], 24, 0));
});

test("only spawn-area work needs columns, and a quiet world needs none", () => {
  assert.deepEqual(stateColumns(base), []);
  const root = { ...base, player: { furnaces: { "3,70,3": furnace(1), "1000,70,3": furnace(1) } } };
  const cols = stateColumns(root);
  assert.equal(cols.length, 9, "one working column plus its halo; the far furnace is outside the spawn area");
  assert.ok(cols.every(([x, z]) => inSpawnArea(base.worldSpawn, x, z)));
});

test("a furnace smelts for the 1200 entity ticks after the player leaves and then freezes", async () => {
  const root = { ...base, player: { furnaces: { "3,11,3": furnace(20) } } };
  for (const ticks of [1300, 5000]) {
    const r = await run(root, ticks);
    assert.equal(AWAY_ENTITY_TICKS, 1200);
    const f = r.tiles.furnaces["3,11,3"];
    assert.equal(f.items[2]?.id, INGOT);
    assert.equal(f.items[2].count + f.cook / 200, 6, `${ticks} ticks: 1200 / 200 smelts, no more`);
  }
  assert.equal((await run(root, 1000)).tiles.furnaces["3,11,3"].items[2].count, 5);
});

test("a scheduled water tick still runs long after the entity gate", async () => {
  const root = { ...base, fluidTicks: { version: 1, time: 0, entries: [{ x: 5, y: 11, z: 5, block: WATER, delay: 1500 }] } };
  const water = (chunks) => setBlock(chunks, 5, 11, 5, WATER, 0);
  const early = await run(root, 1400, water);
  assert.equal(cellOf(early, 6, 11, 5), null, "not due yet");
  const late = await run(root, 2000, water);
  assert.equal(cellOf(late, 6, 11, 5), WATER, "the source spread after tick 1500");
  assert.equal(cellOf(late, 5, 11, 6), WATER);
  assert.equal(late.stats.ran, 2000);
  assert.equal(late.fluidTicks.version, 1);
});

test("work in a column that was not copied waits, and quiet worlds stop early", async () => {
  const root = { ...base, fluidTicks: { version: 1, time: 0, entries: [{ x: 5, y: 11, z: 5, block: WATER, delay: 10 }] } };
  const plan = { ...awayPlan(root, stateColumns(root), 200), chunks: [], records: [] };
  assert.equal(await runAway(plan), null, "no copied columns, nothing runs");
  const r = await run({ ...base, player: { furnaces: { "3,11,3": furnace(0) } } }, MAX_AWAY_TICKS);
  assert.equal(r.stats.stopped, "idle");
  assert.ok(r.stats.ms < 4000);
});

test("DimensionLive carries the departure state through a worker run and patches the root record", async () => {
  const { DimensionLive } = await import("./dimension-live.js");
  const root = { ...base, id: "w1", player: { furnaces: { "3,11,3": furnace(20) } } };
  let tick = 100, written = null, dirty = 0;
  const host = { ticks: () => tick, chunks: (cols) => floorChunks(cols), dirty: () => dirty++ };
  const dims = new DimensionLive(host);
  dims.readColumns = async () => [];
  dims.writeColumns = async (id, cols) => { written = [id, cols.length]; };
  dims.makeAwayWorker = () => {
    const w = { terminate() { this.dead = true; } };
    queueMicrotask(() => w.onmessage?.({ data: { type: "ready" } }));
    w.postMessage = (plan) => runAway(plan).then((result) => setTimeout(() => w.onmessage({ data: { type: "result", result } }), 0));
    return w;
  };
  await dims.beginAway(root);
  assert.equal(dims.away.rootId, "w1");
  tick += 600; dims.away.tripMs = 20000; // 600 ticks away + a 20 s loading screen (400 ticks)
  const log = await dims.finishAway(root);
  assert.equal(log.ticks, 1000);
  assert.equal(root.player.furnaces["3,11,3"].items[2].count, 5);
  assert.equal(dims.away, null);
  assert.ok(dirty > 0);
  assert.equal(await dims.finishAway(root), null, "one run per trip");
});

// Batch 35: the 1200-tick idle gate against the executed WorldServer.updateEntities (public/research/idle-counter-reference.json, tools/probes/IdleCounterProbe.java).
import { readFileSync } from "node:fs";
import { AWAY_ENTITY_TICKS as GATE } from "./away-plan.js";
test("the entity gate matches the native idle counter: P = 0..1199 runs, 1200 onward stops, a player present resets it", () => {
  const rec = JSON.parse(readFileSync(new URL("../public/research/idle-counter-reference.json", import.meta.url), "utf8"));
  assert.ok(rec.cases.length >= 10);
  for (const c of rec.cases) {
    if (c.players) { assert.equal(c.result, "past"); assert.equal(c.pAfter, 0, "mt.i() resets the counter"); continue; }
    assert.equal(c.result === "past", c.p < GATE, `P=${c.p}`);
    assert.equal(c.pAfter, c.p + 1);
  }
});

// ---- Batch 36: /setworldspawn mid-run and per-write fluid notification ----
const COMMAND_BLOCK = 139;
const moveSpawn = async (delay, tickBase, command = "setworldspawn 3000 64 3000", ticks = 2000) => {
  const root = { ...base, fluidTicks: { version: 1, time: 0, entries: [{ x: 5, y: 11, z: 5, block: WATER, delay }] },
    redstone: { version: 1, clock: 0, time: 0, pending: [[3, 11, 3, 137, 5, 0, 1]], events: [] },
    commandBlocks: [{ x: 3, y: 11, z: 3, command, successCount: 0, customName: "@", trackOutput: true, lastOutput: null }] };
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, ticks, 2), chunks: floorChunks(cols), records: [], tickBase };
  setBlock(plan.chunks, 3, 11, 3, COMMAND_BLOCK); setBlock(plan.chunks, 5, 11, 5, WATER, 0);
  return runAway(plan);
};
test("/setworldspawn mid-run: nothing reloads, and the next autosave (tickCounter % 900 == 0) unloads the columns outside the new area", async () => {
  const before = await moveSpawn(700, 0);
  assert.deepEqual(before.world.worldSpawn, [3000, 64, 3000]);
  assert.equal(cellOf(before, 6, 11, 5), WATER, "due at tick 700, before the autosave at tick 900: the old area is still loaded");
  const after = await moveSpawn(1500, 0);
  assert.equal(cellOf(after, 6, 11, 5), null, "due at tick 1500: the column was unloaded at tick 900, the spread is refused");
  assert.equal(after.stats.commands.areaMoves, 1);
  const phase = await moveSpawn(700, 400);
  assert.equal(cellOf(phase, 6, 11, 5), null, "the autosave follows the server's tick counter: with 400 ticks already counted it comes at run tick 499");
  const stays = await moveSpawn(1500, 0, "setworldspawn 10 64 10");
  assert.equal(cellOf(stays, 6, 11, 5), WATER, "a new spawn that still covers the column keeps it loaded");
  assert.equal(stays.stats.commands.areaMoves, 1);
  const none = await moveSpawn(1500, 0, "say hi");
  assert.equal(none.stats.commands.areaMoves, undefined);
  assert.equal(cellOf(none, 6, 11, 5), WATER);
});

test("every fluid write of the away run goes through Fluids.written, whose writers list notifies redstone per write (as main.js does)", async () => {
  const { Fluids } = await import("./fluids.js");
  let seen = null;
  const proto = Fluids.prototype.written;
  const log = [];
  Fluids.prototype.written = function (...a) { log.push(a.slice(0, 3).join(",")); return proto.apply(this, a); };
  try {
    const r = await run({ ...base, fluidTicks: { version: 1, time: 0, entries: [{ x: 5, y: 11, z: 5, block: WATER, delay: 1 }] } }, 40, (chunks) => setBlock(chunks, 5, 11, 5, WATER, 0));
    seen = cellOf(r, 6, 11, 5);
  } finally { Fluids.prototype.written = proto; }
  assert.equal(seen, WATER);
  assert.ok(log.length >= 4, "every placement of the spread went through Fluids.written, which calls the writers list");
});

test("DimensionLive records the player's trace while away (position about each second, a snapshot only when his state changed) and hands it to the run", async () => {
  const { DimensionLive } = await import("./dimension-live.js");
  const root = { ...base, id: "w2", player: { furnaces: { "3,11,3": furnace(20) } } };
  let tick = 100, inv = 0, pos = { x: 1, y: 64, z: 2 }, plan = null;
  const host = { ticks: () => tick, chunks: (cols) => floorChunks(cols), dirty() {}, player: () => pos, awayPlayer: () => ({ state: { slots: inv ? [{ id: 303, count: inv, damage: 0 }] : [] }, experience: {}, mode: 0, level: 0 }) };
  const dims = new DimensionLive(host);
  dims.readColumns = async () => [];
  dims.writeColumns = async () => {};
  dims.makeAwayWorker = () => {
    const w = { terminate() {} };
    queueMicrotask(() => w.onmessage?.({ data: { type: "ready" } }));
    w.postMessage = (p) => { plan = p; setTimeout(() => w.onmessage({ data: { type: "result", result: null } }), 0); };
    return w;
  };
  await dims.beginAway(root);
  for (let i = 0; i < 100; i++) { tick++; pos = { x: 10 + i, y: 70, z: 5 }; if (i === 50) inv = 3; dims.traceAway(-1, pos); }
  await dims.finishAway(root);
  assert.equal(plan.tickBase, 100);
  assert.equal(plan.trace.samples[0][1], 0, "the first sample is the departure, in the Overworld");
  assert.ok(plan.trace.samples.length >= 5 && plan.trace.samples.length <= 7, `${plan.trace.samples.length} samples for 100 ticks`);
  assert.deepEqual(plan.trace.samples.at(-1).slice(1, 3), [-1, plan.trace.samples.at(-1)[2]]);
  assert.equal(plan.trace.states.length, 2, "the departure state and the one after he picked something up; unchanged states add nothing");
  assert.ok(plan.trace.states[1][0] >= 50 && plan.trace.states[1][0] <= 70);
});
