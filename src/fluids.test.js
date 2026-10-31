import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { ItemEntities } from "./item-entities.js";
import { SCENARIOS, replay, compare } from "../tools/fluid-scenarios.mjs";
import { Fluids, TICK_RATE, MAX_TICKS, flowVector, flowAngle, liquidHeight, liquidHeightPercent, waterAcceleration, entityWaterBox } from "./fluids.js";

const WATER = 10, STONE = 3, TORCH = 20, GRASS = 39, X0 = 20, Z0 = 20, FLOOR = 10;
// A 40 x 40 arena of air over a stone floor at y = 10; water stands on y = 11.
function clear(w) {
  for (let x = X0; x < X0 + 40; x++)
    for (let z = Z0; z < Z0 + 40; z++) for (let y = 1; y < 30; y++) w.set(x, y, z, y <= FLOOR ? STONE : 0, false);
  return w;
}
const arena = () => {
  const w = clear(new World("fluids"));
  return { w, fl: new Fluids(w) };
};
const run = (fl, n) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push(...fl.tick());
  return out;
};
const level = (w, x, z, y = 11) => (w.get(x, y, z) === WATER ? w.getMeta(x, y, z) : -1);

test("a source spreads one level per five ticks and stops at level 7", () => {
  const { w, fl } = arena(), cx = 40, cz = 40;
  w.set(cx, 11, cz, WATER);
  run(fl, TICK_RATE - 1);
  assert.equal(level(w, cx + 1, cz), -1);
  run(fl, 1);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) assert.equal(level(w, cx + dx, cz + dz), 1);
  assert.equal(level(w, cx + 1, cz + 1), -1);
  run(fl, TICK_RATE * 10);
  for (let d = 1; d <= 7; d++) assert.equal(level(w, cx + d, cz), d);
  assert.equal(level(w, cx + 8, cz), -1);
  // The level is the walking distance from the source, so the shape is a diamond.
  assert.equal(level(w, cx + 3, cz + 3), 6);
  assert.equal(level(w, cx + 4, cz + 4), -1);
  assert.equal(level(w, cx + 2, cz + 2), 4);
  assert.equal(fl.heap.length, 0);
});

test("water settles: no ticks stay pending once the spread is complete", () => {
  const { w, fl } = arena();
  w.set(40, 11, 40, WATER);
  run(fl, 200);
  assert.equal(fl.pending.size, 0);
  assert.deepEqual(run(fl, 20), []);
});

test("removing the source drains flowing water", () => {
  const { w, fl } = arena();
  w.set(40, 11, 40, WATER);
  run(fl, 100);
  w.set(40, 11, 40, 0);
  run(fl, 400);
  for (let x = 30; x < 50; x++) for (let z = 30; z < 50; z++) assert.equal(w.get(x, 11, z), 0, `${x},${z}`);
});

test("two flowing neighbours of a source pair over a solid floor make a source", () => {
  const { w, fl } = arena();
  w.set(40, 11, 40, WATER);
  w.set(42, 11, 40, WATER);
  run(fl, TICK_RATE * 2);
  assert.equal(level(w, 41, 40), 0);
  // One source alone never does: the far end of a one-wide trough stays flowing.
  const b = arena();
  b.w.set(40, 11, 40, WATER);
  run(b.fl, 200);
  assert.equal(level(b.w, 41, 40), 1);
});

test("two adjacent sources do not make a source over flowing water that is not level 0", () => {
  const { w, fl } = arena();
  for (const x of [40, 42]) {
    w.set(x, 11, 40, STONE, false);
    w.set(x, 12, 40, WATER, false);
  }
  w.set(41, 11, 40, WATER, false, 3);
  w.set(41, 12, 40, WATER, false, 1);
  fl.schedule(41, 12, 40);
  run(fl, 10);
  assert.equal(level(w, 41, 40, 12), 1);
});

test("water falls as level 8+, spreads from the landing, and a source above spreads sideways", () => {
  const { w, fl } = arena();
  w.set(40, 15, 40, WATER);
  run(fl, TICK_RATE * 12);
  for (let y = 11; y <= 14; y++) assert.equal(w.getMeta(40, y, 40), 8, `y ${y}`);
  // A falling cell at the floor spreads at level 1; the flowing neighbours of the
  // source fall as 8 + their own level.
  assert.equal(level(w, 41, 40, 15), 1);
  assert.equal(level(w, 41, 40, 14), 9);
  assert.equal(level(w, 42, 40, 11), 1);
  assert.equal(level(w, 43, 40, 11), 2);
});

test("spreading water takes the shortest path to a drop", () => {
  const { w, fl } = arena();
  w.set(43, FLOOR, 40, 0, false); // a hole three blocks east of the source
  w.set(40, 11, 40, WATER);
  run(fl, TICK_RATE);
  assert.equal(level(w, 41, 40), 1);
  assert.equal(level(w, 39, 40), -1);
  assert.equal(level(w, 40, 41), -1);
  assert.equal(level(w, 40, 39), -1);
  // A hole five blocks east of the source is still found (depth 4 from the neighbour); six is not.
  const far = arena();
  far.w.set(46, FLOOR, 40, 0, false);
  far.w.set(40, 11, 40, WATER);
  run(far.fl, TICK_RATE);
  assert.equal(level(far.w, 41, 40), 1, "a drop beyond the four-block search is ignored, so it spreads every way");
  assert.equal(level(far.w, 39, 40), 1);
  const near = arena();
  near.w.set(45, FLOOR, 40, 0, false);
  near.w.set(40, 11, 40, WATER);
  run(near.fl, TICK_RATE);
  assert.equal(level(near.w, 41, 40), 1);
  assert.equal(level(near.w, 39, 40), -1);
});

test("flowing water washes away torches and tall grass and reports them", () => {
  const w = new World("wash");
  const seen = [];
  const fl = new Fluids(w, { wash: (x, y, z, b) => seen.push([x, y, z, b]) });
  for (let x = 30; x < 50; x++) for (let z = 30; z < 50; z++) for (let y = 1; y < 25; y++) w.set(x, y, z, y <= FLOOR ? STONE : 0, false);
  w.set(41, 11, 40, TORCH, false);
  w.set(40, 11, 41, GRASS, false);
  w.set(40, 11, 40, WATER);
  run(fl, TICK_RATE);
  assert.deepEqual(seen.sort((a, b) => a[3] - b[3]), [[41, 11, 40, TORCH], [40, 11, 41, GRASS]].sort((a, b) => a[3] - b[3]));
  assert.equal(level(w, 41, 40), 1);
  assert.equal(level(w, 40, 41), 1);
});

test("a settled pool starts flowing when a wall block is removed", () => {
  const { w, fl } = arena();
  for (let x = 38; x <= 42; x++) for (let z = 38; z <= 42; z++) if (x === 38 || x === 42 || z === 38 || z === 42) w.set(x, 11, z, STONE, false);
  for (let x = 39; x <= 41; x++) for (let z = 39; z <= 41; z++) w.set(x, 11, z, WATER);
  run(fl, 100);
  assert.equal(fl.pending.size, 0);
  assert.equal(level(w, 43, 40), -1);
  w.set(42, 11, 40, 0);
  run(fl, 20);
  assert.equal(level(w, 42, 40), 1);
  assert.equal(level(w, 43, 40), 2);
});

test("placing a block against water wakes it and the source above falls again", () => {
  const { w, fl } = arena();
  w.set(40, 11, 40, WATER);
  run(fl, 100);
  w.set(41, 11, 40, STONE);
  assert.ok(fl.pending.size > 0);
  run(fl, 100);
  assert.equal(w.get(41, 11, 40), STONE);
});

test("scheduled ticks: a repeat keeps the first time, order is time then creation, 1000 per tick", () => {
  const { w, fl } = arena();
  const seen = [];
  fl.updateTick = (x, y, z) => seen.push([x, z]);
  for (let i = 0; i < 4; i++) w.set(30 + i, 11, 30, WATER, false);
  fl.schedule(32, 11, 30, 3);
  fl.schedule(30, 11, 30, 5);
  fl.schedule(31, 11, 30, 5);
  fl.schedule(30, 11, 30, 1); // already pending: ignored
  fl.schedule(33, 11, 30, 5);
  run(fl, 2);
  assert.deepEqual(seen, []);
  run(fl, 1);
  assert.deepEqual(seen, [[32, 30]]);
  run(fl, 2);
  assert.deepEqual(seen.slice(1), [[30, 30], [31, 30], [33, 30]]);
  // 1,500 entries due together: 1,000 run, the rest wait one tick.
  const many = arena();
  let count = 0;
  many.fl.updateTick = () => count++;
  for (let i = 0; i < 1500; i++) {
    const x = 20 + (i % 40), z = 20 + Math.floor(i / 40);
    many.w.set(x, 11, z, WATER, false);
    many.fl.schedule(x, 11, z, 1);
  }
  many.fl.tick();
  assert.equal(count, MAX_TICKS);
  many.fl.tick();
  assert.equal(count, 1500);
});

test("a tick whose block is no longer water is skipped", () => {
  const { w, fl } = arena();
  let count = 0;
  fl.updateTick = () => count++;
  w.set(30, 11, 30, WATER, false);
  fl.schedule(30, 11, 30, 1);
  w.set(30, 11, 30, STONE, false);
  fl.tick();
  assert.equal(count, 0);
});

test("flow vector and angle follow the level gradient", () => {
  const { w } = arena();
  w.set(40, 11, 40, WATER, false);
  w.set(41, 11, 40, WATER, false, 1);
  w.set(42, 11, 40, WATER, false, 2);
  assert.deepEqual(flowVector(w, 41, 11, 40), [1, 0, 0]);
  assert.ok(Math.abs(flowAngle(w, 41, 11, 40) + Math.PI / 2) < 1e-12);
  assert.equal(flowAngle(w, 40, 11, 44), -1000);
  // A lone source has no neighbours: no direction.
  assert.equal(flowAngle(w, 50, 11, 50), -1000);
  w.set(50, 11, 50, WATER, false);
  assert.equal(flowAngle(w, 50, 11, 50), -1000);
  // Falling water beside a wall points down.
  w.set(60, 12, 60, STONE, false);
  w.set(59, 12, 60, WATER, false, 8);
  assert.equal(flowVector(w, 59, 12, 60)[1], -1);
});

test("surface height follows BlockLiquid.getLiquidHeightPercent and the four-cell average", () => {
  assert.equal(liquidHeightPercent(0), Math.fround(1 / 9));
  assert.equal(liquidHeightPercent(7), Math.fround(8 / 9));
  assert.equal(liquidHeightPercent(8), Math.fround(1 / 9));
  const { w } = arena();
  w.set(40, 11, 40, WATER, false);
  const lone = Math.fround(1 - Math.fround(Math.fround(Math.fround(Math.fround(Math.fround(1 / 9) * 10) + Math.fround(1 / 9)) + 3) / 14));
  assert.equal(liquidHeight(w, 40, 11, 40), lone);
  w.set(40, 12, 40, WATER, false);
  assert.equal(liquidHeight(w, 40, 11, 40), 1);
  const flowing = arena();
  flowing.w.set(40, 11, 40, WATER, false, 3);
  // Level 3 weighs (3 + 1) / 9 once; the three air cells add 1 each.
  assert.ok(Math.abs(liquidHeight(flowing.w, 40, 11, 40) - (1 - (4 / 9 + 3) / 4)) < 1e-6);
});

test("the water box that pushes entities is the body shrunk 0.4 top and bottom", () => {
  const b = entityWaterBox([0, 0, 0, 0.6, 1.8, 0.6]);
  assert.ok(Math.abs(b[1] - 0.401) < 1e-8 && Math.abs(b[4] - 1.399) < 1e-8 && Math.abs(b[0] - 0.001) < 1e-12);
});

test("running water pushes by 0.014 along the summed flow; still water does not", () => {
  const { w } = arena();
  w.set(40, 11, 40, WATER, false);
  w.set(41, 11, 40, WATER, false, 1);
  const flow = waterAcceleration(w, [41.2, 11, 40.2, 41.4, 11.25, 40.4]);
  assert.equal(flow.wet, true);
  assert.ok(Math.abs(flow.push[0] - 0.014) < 1e-12 && flow.push[1] === 0 && flow.push[2] === 0);
  const still = waterAcceleration(w, [50.2, 11, 50.2, 50.4, 11.25, 50.4]);
  assert.equal(still.wet, false);
  assert.deepEqual(still.push, [0, 0, 0]);
  assert.deepEqual(waterAcceleration(w, [41.2, 11, 40.2, 41.4, 11.25, 40.4], false).push, [0, 0, 0]);
  // Only cells the box reaches count, and a cell is wet once the box top's block row reaches it.
  assert.equal(waterAcceleration(w, [41.2, 12.1, 40.2, 41.4, 12.3, 40.4]).wet, false);
});

test("a dropped item is carried along by flowing water", () => {
  const { w, fl } = arena();
  w.set(40, 11, 40, WATER);
  run(fl, 30);
  const items = new ItemEntities(() => 0.5);
  const e = items.spawn({ id: 3, count: 1 }, 42.5, 11.2 + 0.125, 40.5, { motion: [0, 0, 0] });
  const x0 = e.x;
  for (let i = 0; i < 20; i++) items.tick(w);
  assert.ok(e.x > x0 + 0.05, `moved ${e.x - x0}`);
  assert.ok(Math.abs(e.z - 40.5) < 1e-6);
});

test("meta saves and loads; old saves without it load as sources; bad meta is refused", () => {
  const { w, fl } = arena();
  w.set(40, 11, 40, WATER);
  run(fl, 30);
  assert.ok(w.getMeta(43, 11, 40) === 3);
  const saved = JSON.parse(JSON.stringify([...w.edits]));
  const r = clear(new World("fluids"));
  r.restore(saved);
  assert.deepEqual(r.data, w.data);
  assert.deepEqual(r.meta, w.meta);
  const old = clear(new World("fluids"));
  old.restore([["40,11,40", WATER]]);
  assert.equal(old.get(40, 11, 40), WATER);
  assert.equal(old.getMeta(40, 11, 40), 0);
  assert.throws(() => old.restore([["40,11,41", WATER | (16 << 8)]]));
  assert.throws(() => old.restore([["40,11,41", -1]]));
  assert.equal(old.put(40, 11, 41, WATER, 16), false);
});

test("a loaded world wakes the water that touches edits and settles again", () => {
  const { w, fl } = arena();
  w.set(40, 11, 40, WATER);
  run(fl, 100);
  const r = clear(new World("fluids"));
  r.restore([...w.edits]);
  const f2 = new Fluids(r);
  f2.wake();
  assert.ok(f2.pending.size > 0);
  run(f2, 200);
  assert.deepEqual(r.data, w.data);
  assert.deepEqual(r.meta, w.meta);
});

// public/research/fluids-reference.json holds what the unchanged original
// BlockDynamicLiquid / BlockStaticLiquid / BlockLiquid did in each scenario
// (tools/verify-fluids.mjs): the block-and-level grid after every tick, the
// pending tick count, and getFlowVector / getFlowDirection of every water cell.
const reference = JSON.parse(readFileSync(new URL("../public/research/fluids-reference.json", import.meta.url)));
test("the reference scenarios are the ones this build replays", () => {
  assert.equal(reference.scenarios.length, SCENARIOS.length);
  reference.scenarios.forEach((r, i) => assert.deepEqual({ ...SCENARIOS[i] }, { name: r.name, dims: r.dims, ticks: r.ticks, grid: r.grid, events: r.events }));
});
for (const r of reference.scenarios)
  test(`water matches the original classes tick for tick: ${r.name}`, () => {
    compare(r, { hashes: r.hashes, grid: r.final, pending: r.pending, flows: r.flows }, replay(r), reference.percent);
  });
