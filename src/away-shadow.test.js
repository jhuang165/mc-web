import { test } from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";

await populationBlockMapperReady;
const STONE = 3, COBBLE = 4, TORCH = 76, COMMAND_BLOCK = 139;
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

// Batch 37: a scheduled tick in a column that unloads mid-run is kept with the delay it had (the chunk save holds it; a load re-queues it), not run against refused writes.
const parked = async (command, { ticks = 2000 } = {}) => {
  const root = { ...base,
    redstone: { version: 1, clock: 0, time: 0, pending: [[3, 11, 3, 137, 5, 0, 1], [3, 11, 4, TORCH, 1500, 0, 2]], events: [] },
    commandBlocks: [{ x: 3, y: 11, z: 3, command, successCount: 0, customName: "@", trackOutput: true, lastOutput: null }] };
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, ticks, 2), chunks: floorChunks(cols), records: [], tickBase: 0 };
  setBlock(plan.chunks, 3, 11, 3, COMMAND_BLOCK); setBlock(plan.chunks, 3, 11, 4, TORCH, 5);
  return runAway(plan);
};
test("a redstone tick in a column the autosave unloads keeps its remaining delay instead of running against refused writes", async () => {
  const gone = await parked("setworldspawn 3000 64 3000");
  assert.equal(gone.world.worldSpawn[0], 3000);
  const tick = gone.redstone.pending.find((e) => e[0] === 3 && e[2] === 4);
  assert.ok(tick, "the torch tick is still pending");
  assert.equal(tick[4] - gone.redstone.time, 600, "due at 1500, held from the unload at 900: 600 ticks left");
  assert.ok(gone.stats.commands.heldTicks > 0);
  const stays = await parked("say hi");
  assert.equal(stays.redstone.pending.find((e) => e[2] === 4), undefined, "with the column loaded it ran at tick 1500");
});

test("a run whose only work is held back in unloaded columns stops as idle after the entity gate", async () => {
  const gone = await parked("setworldspawn 3000 64 3000", { ticks: 5000 });
  assert.equal(gone.stats.stopped, "idle");
  const tick = gone.redstone.pending.find((e) => e[2] === 4);
  assert.equal(tick[4] - gone.redstone.time, 600, "the delay it was held with");
});

// Batch 37: World.updateEntityWithOptionalForce is asked every tick: an entity that flies to within 32 blocks of the loaded area's edge stops there.
test("an item that moves off the loaded area's 32-block margin freezes where it is; with a wider area it keeps going", async () => {
  const item = { stack: { id: COBBLE, count: 3, damage: 0 }, x: 80.5, y: 60, z: 5.5, mx: 1, my: 0, mz: 0, age: 0, delay: 0 };
  const go = (spawn) => {
    const root = { ...base, worldSpawn: spawn, drops: [{ ...item }] };
    const cols = [4, 5, 6, 7, 8, 9, 10].flatMap((cx) => [-1, 0, 1].map((cz) => [cx, cz])), plan = { ...awayPlan(root, cols, 100), chunks: floorChunks(cols), records: [] }; // columns past the item's own halo, so the area (not the copy) decides
    return runAway(plan);
  };
  const edge = (await go([0, 64, 0])).entities.drops[0], wide = (await go([100, 64, 5])).entities.drops[0];
  assert.ok(edge.x >= 96 && edge.x < 100, `stopped just past x 96 (${edge.x})`);
  assert.ok(edge.age > 0 && edge.age < 100, `its age stopped counting (${edge.age})`);
  assert.equal(wide.age, 100);
  assert.ok(wide.x > edge.x + 5, `the same item in a wider area kept flying (${wide.x})`);
  assert.equal(wide.y, 11, "and landed");
});
