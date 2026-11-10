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
