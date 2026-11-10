import { test } from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";
import { World, WorldChunk, WATER, SAND, FIRE } from "./world.js";
import { Fluids } from "./fluids.js";
import { Fire } from "./fire.js";
import { FallingBlocks } from "./falling.js";
import { Weather } from "./weather.js";
import { createRedstoneRuntime } from "./redstone-runtime.js";
import { attachTickTree } from "./tile-ticks.js";
import { tickWorldSystems } from "./world-tick.js";

await populationBlockMapperReady;
const STONE = 3, TORCH = 76;
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x, z, blocks, meta };
});
const put = (chunks, x, y, z, b, m = 0) => { const c = chunks.find((k) => k.x === x >> 4 && k.z === z >> 4), i = ((x & 15) * 16 + (z & 15)) * 256 + y; c.blocks[i] = b; c.meta[i] = m; };
// A mixed set due together: water, falling sand, fire and a redstone torch tick, with different delays and priorities.
const root = {
  seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], player: { time: 6000 },
  fluidTicks: { version: 1, time: 0, entries: [{ x: 5, y: 11, z: 5, block: WATER, delay: 2 }, { x: 5, y: 11, z: 9, block: WATER, delay: 1 }] },
  fireTicks: { version: 1, time: 0, entries: [{ x: 9, y: 11, z: 9, block: FIRE, delay: 2 }] },
  fallingTicks: { version: 1, time: 0, entries: [{ x: 7, y: 12, z: 7, block: SAND, delay: 1 }, { x: 8, y: 12, z: 7, block: SAND, delay: 3 }] },
  redstone: { version: 1, clock: 0, time: 0, pending: [[3, 11, 3, TORCH, 2, 0, 1], [3, 11, 4, TORCH, 1, 0, 2]], events: [] },
};
const blocks = (chunks) => { put(chunks, 5, 11, 5, WATER); put(chunks, 5, 11, 9, WATER); put(chunks, 9, 11, 9, FIRE); put(chunks, 7, 12, 7, SAND); put(chunks, 8, 12, 7, SAND); put(chunks, 3, 11, 3, TORCH, 5); put(chunks, 3, 11, 4, TORCH, 5); };
const where = (e) => `${e.x},${e.y},${e.z}`;

test("the away run takes fluid, fire, falling and redstone ticks from one shared tree in the same order as a live-style tick", async () => {
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, 6, 2), chunks: floorChunks(cols), records: [] };
  blocks(plan.chunks);
  const away = [];
  await runAway(plan, { trace: (kind, e) => away.push(`${kind}@${where(e)}`) });

  // The live-style run: the same systems on the same blocks, one attachTickTree, driven by world-tick.js as main.js does.
  const world = new World(plan.seed, "javaStreamed", 15, "flat", "");
  world.chunks = new Map(); world.lastChunk = null;
  for (const c of plan.chunks) { const ch = new WorldChunk(c.x, c.z, world.height); ch.blocks.set(c.blocks); ch.meta.set(c.meta); world.chunks.set(`${c.x},${c.z}`, ch); }
  world.isTicking = () => true;
  const weather = new Weather(), fluids = new Fluids(world, { seed: 1 }), fire = new Fire(world, { weather: () => weather }), falling = new FallingBlocks(world, { drop() {} }, []);
  const game = { sound() {}, markUnsaved() {}, drop() {}, primeTnt() {}, player: () => null, mobs: () => null, items: () => [], arrows: () => [], orbs: () => [], primed: () => [], commandHost: () => null };
  const rt = createRedstoneRuntime({ world, scene: null, game });
  fluids.load(plan.fluidTicks); fire.load(plan.fireTicks); falling.load(plan.fallingTicks); rt.restore({ redstone: plan.redstone, pistons: plan.pistons, commandBlocks: [] });
  fire.watch(); falling.watch(); fire.sharedRandomTicks = true;
  const tree = attachTickTree({ fluids, fire, falling, redstone: rt }), live = [];
  for (const src of tree.sources) { const run = src.run; src.run = (e) => { live.push(`${src.name}@${where(e)}`); return run(e); }; }
  for (let t = 0; t < 6; t++) {
    tickWorldSystems({ farming: { tick: () => [] }, fluids, fire, tickTree: tree, redstone: rt }, { time: t, daylight: 1, x: 0, z: 0 }, { farming() {}, fluids() {}, fire() {} });
  }
  assert.ok(away.length >= 6, `all six entries ran (${away.length})`);
  assert.ok(away.some((x) => x.startsWith("fire@")), "fire ran too");
  assert.deepEqual(away, live);
  // Delay 1 entries come first whatever their kind, then delay 2, then 3: one tree, not one list after another.
  const first = away.slice(0, 3).map((s) => s.split("@")[0]).sort();
  assert.deepEqual(first, ["falling", "fluids", "redstone"]);
});
