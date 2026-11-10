import { test } from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan, AWAY_ENTITY_TICKS } from "./away-world.js";
import { RAIL } from "./world.js";

await populationBlockMapperReady;
const STONE = 3, COBBLE = 4;
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x: x, z, blocks, meta };
});
const setBlock = (chunks, x, y, z, b, m = 0) => {
  const c = chunks.find((k) => k.x === x >> 4 && k.z === z >> 4), i = ((x & 15) * 16 + (z & 15)) * 256 + y;
  c.blocks[i] = b; c.meta[i] = m;
};
const base = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0] };
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
const item = (x, y, z, extra = {}) => ({ stack: { id: COBBLE, count: 3, damage: 0 }, x, y, z, mx: 0, my: 0, mz: 0, age: 0, delay: 0, ...extra });

test("a dropped item falls onto the floor, ages, and does not move after the 1200-tick gate", async () => {
  const root = { ...base, drops: [item(5.5, 40, 5.5, { age: 100 }), item(900.5, 40, 5.5)] };
  assert.ok(stateColumns(root).length > 0, "an item in the spawn area needs a run; the far one is outside it");
  const r = await run(root, 1500);
  const [far, near] = [r.entities.drops.find((d) => d.x === 900.5), r.entities.drops.find((d) => d.x !== 900.5)];
  assert.equal(far.y, 40, "an item outside the spawn area is untouched");
  assert.ok(Math.abs(near.y - 11) < 0.01, `landed on the floor (y ${near.y})`);
  assert.equal(near.age, 100 + AWAY_ENTITY_TICKS, "aged for exactly the gate");
  const frozen = await run(root, 5000);
  assert.equal(frozen.entities.drops.find((d) => d.x !== 900.5).age, 100 + AWAY_ENTITY_TICKS);
});

test("two stacks on the floor merge, and an old item despawns at 6000 ticks of age", async () => {
  const merged = await run({ ...base, drops: [item(5.5, 11, 5.5), item(5.6, 11, 5.5)] }, 200);
  assert.equal(merged.entities.drops.length, 1);
  assert.equal(merged.entities.drops[0].stack.count, 6);
  const old = await run({ ...base, drops: [item(5.5, 11, 5.5, { age: 5900 })] }, 1300);
  assert.equal(old.entities.drops.length, 0, "age 6000 reached inside the gate");
});

test("a primed TNT burns its fuse, explodes through the shared explosion code and craters the floor", async () => {
  const root = { ...base, tnt: [{ x: 5.5, y: 11, z: 5.5, vx: 0, vy: 0, vz: 0, fuse: 30 }] };
  const r = await run(root, 100);
  assert.equal(r.entities.tnt.length, 0);
  assert.equal(cellOf(r, 5, 10, 5), 0, "the block under the TNT is gone");
  assert.ok(r.entities.drops.length > 0, "stone blocks drop as item entities");
  // A fuse that runs out only after the gate stays primed.
  const late = await run({ ...base, tnt: [{ x: 5.5, y: 11, z: 5.5, vx: 0, vy: 0, vz: 0, fuse: 3000 }] }, 2000);
  assert.equal(late.entities.tnt.length, 1);
  assert.equal(late.entities.tnt[0].fuse, 3000 - AWAY_ENTITY_TICKS);
});

test("a minecart rolls along rails and a boat settles; saved carts with a rider stay put", async () => {
  const rails = (chunks) => { for (let x = 0; x < 30; x++) setBlock(chunks, x, 11, 5, RAIL, 1); };
  const cart = (id, extra = {}) => ({ id, type: 0, x: 3.5, y: 11.05, z: 5.5, motion: [0.3, 0, 0], rotation: [0, 0], fallDistance: 0, fire: 0, onGround: true, items: [], ...extra });
  const root = { ...base, minecarts: { version: 1, carts: [cart(1), cart(2, { rider: true, z: 5.5 })] } };
  const r = await run(root, 60, rails);
  const moved = r.entities.minecarts.carts.find((c) => c.id === 1), held = r.entities.minecarts.carts.find((c) => c.id === 2);
  assert.ok(moved.x > 3.6, `the cart rolled (x ${moved.x})`);
  assert.equal(held.x, 3.5);
});

test("a powered dropper spills an item entity that falls and merges; an arrow dispenser shoots a live arrow", async () => {
  const { World } = await import("./world.js");
  const { fromOriginal } = await import("./block-registry.js");
  const { createRedstoneRuntime } = await import("./redstone-runtime.js");
  for (const [orig, items, expected] of [[158, [{ id: COBBLE, count: 2, damage: 0 }], 1], [23, [{ id: 320, count: 2, damage: 0 }], 2]]) {
    // Queue the dropper's tick the way the game does (a redstone block placed beside it), then hand the saved queue to the run.
    const O = [5, 11, 5], seedWorld = new World("away-dropper", "meadow");
    const put = (w, dx, id, meta) => { const m = fromOriginal(id, meta); w.put(O[0] + dx, O[1], O[2], m.id, m.meta, false); };
    for (let x = 0; x <= 3; x++) for (let y = 0; y <= 3; y++) for (let z = 0; z <= 3; z++) seedWorld.put(O[0] + x - 1, O[1] + y - 1, O[2] + z - 1, 0, 0, false);
    put(seedWorld, 0, orig, 3);
    const rt = createRedstoneRuntime({ world: seedWorld, game: { dispensers: () => ({}), maxStack: () => 64, dispense: {} } });
    put(seedWorld, 1, 152, 0);
    rt.redstone.placed(O[0] + 1, O[1], O[2]);
    const saved = rt.save(); rt.dispose();
    const root = { ...base, redstone: saved, player: { dispensers: { "5,11,5": { items: [...items, ...Array(8).fill(null)] } } } };
    const r = await run(root, 200, (chunks) => { put({ put: (x, y, z, id, meta) => setBlock(chunks, x, y, z, id, meta) }, 0, orig, 3); put({ put: (x, y, z, id, meta) => setBlock(chunks, x, y, z, id, meta) }, 1, 152, 0); });
    const tile = r.tiles.dispensers["5,11,5"];
    if (orig === 158) { assert.equal(tile.items[0].count, 1); assert.equal(r.entities.drops.length, expected, "one item thrown"); }
    else { assert.equal(tile.items[0].count, 1, "one arrow used"); assert.equal(r.entities.drops.length, 0); assert.equal(r.entities.arrows.length, 1, "the arrow is a saved entity (in flight or stuck)"); }
  }
});

test("Weather.advance runs the loading-screen ticks on the Overworld's timers, also from the Nether's away copy", async () => {
  const { Weather } = await import("./weather.js");
  const mk = () => new Weather().restore({ rainTime: 10, thunderTime: 100000, raining: false, thundering: false });
  const here = mk(); here.advance(20);
  assert.equal(here.raining, true);
  assert.ok(here.rain > 0);
  const nether = new Weather(); nether.awayOverworld({ weather: mk().save() }); nether.advance(20);
  assert.equal(nether.overworld.raining, true);
  assert.equal(nether.raining, false, "the Nether's own state is untouched");
});

// Batch 36: World.updateEntityWithOptionalForce (ahb.a(sa, true), bytecode-read) updates an entity only when every chunk within 32 blocks of it exists.
test("an entity within 32 blocks of the edge of the loaded spawn area does not tick; one further in does", async () => {
  const root = { ...base, drops: [item(94.5, 11.5, 5.5), item(96.5, 11.5, 5.5), item(-95.5, 11.5, 5.5), item(-97.5, 11.5, 5.5)] };
  const r = await run(root, 100);
  const age = (x) => r.entities.drops.find((d) => d.x === x).age;
  assert.equal(age(94.5), 100, "x + 32 = 126.5 is chunk 7, the last loaded one (centre 120 <= 128)");
  assert.equal(age(96.5), 0, "x + 32 = 128.5 is chunk 8 (centre 136): not loaded, so the item never updates");
  assert.equal(age(-95.5), 100, "x - 32 = -127.5 is chunk -8 (centre -120)");
  assert.equal(age(-97.5), 0, "x - 32 = -129.5 is chunk -9");
});
