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

// ---- Batch 37: health, hunger and effects in the shadow player ----
import { Survival } from "./survival.js";
import { Experience } from "./experience.js";
import { createCommandHost } from "./command-host.js";
import { replayPlayerCommands, applyPlayerDelta } from "./away-commands.js";
const tile = (command, x) => ({ x, y: 11, z: 3, command, successCount: 7, customName: "@", trackOutput: true, lastOutput: "old" });
const runTimed = async (blocks, trace, ticks = 200) => {
  const root = { ...base, player: { time: 6000 }, redstone: { version: 1, clock: 0, time: 0, pending: blocks.map(([, t], i) => [3 + i, 11, 3, 137, t, 0, 1 + i]), events: [] },
    commandBlocks: blocks.map(([c], i) => tile(c, 3 + i)) };
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, ticks, 2), chunks: floorChunks(cols), records: [], trace };
  for (let i = 0; i < blocks.length; i++) setBlock(plan.chunks, 3 + i, 11, 3, COMMAND_BLOCK);
  return runAway(plan);
};
const at = (r, x) => r.commandBlocks.find((t) => t.x === x);
const body = (health, effects = [], food = 20) => ({ ...(() => { const s = new Survival({ health, food, effects }, "survival"); return { state: JSON.parse(JSON.stringify(s.serialize())), experience: new Experience({}).serialize(), mode: 0, level: 0 }; })() });
const vit = (health, effects = [], food = 20, sat = 5, exh = 0) => [health, food, sat, exh, effects];
const live = (data) => { const survival = new Survival(data, "survival"); const env = { active: () => ({ mode: "survival", allowCommands: true }), world: () => null, weather: () => null, mobs: () => null, survival: () => survival, experience: () => new Experience(), position: () => ({ x: 0, y: 40, z: 0 }), seed: () => "x", stackName: () => "", giveDrop() {}, refreshInventory() {}, changed() {}, setTime() {}, updateBlock() {}, destroyBlock() {} }; return { survival, host: createCommandHost(env) }; };

test("a Regeneration the command gave heals the shadow tick by tick; the return gets the net health and the time the effect has left", async () => {
  const trace = { samples: [[0, -1, 0, 64, 0, vit(10)]], states: [[0, body(10)]] };
  const r = await runTimed([["effect @p 10 30 1", 10]], trace);
  assert.equal(at(r, 3).successCount, 1);
  assert.equal(r.playerDelta.health, 8, "Regeneration II heals every 25 ticks (duration % 25 == 0): 600 575 ... 425 over the 191 ticks left (a block due at time 10 fires on run tick 9)");
  assert.deepEqual(r.playerDelta.add, [{ id: 10, duration: 409, amplifier: 1 }]);
  assert.deepEqual(r.playerDelta.remove, []);
  const l = live({ health: 10 });
  const out = replayPlayerCommands(r.playerCommands, { host: l.host, records: r.commandBlocks, playerDelta: r.playerDelta, survival: l.survival });
  assert.equal(l.survival.health, 18);
  assert.deepEqual(l.survival.effects.get(10), { id: 10, duration: 409, amplifier: 1 });
  assert.deepEqual([out.applied, out.succeeded, out.byDelta], [1, 1, 1], "not re-run on the live player");
  assert.equal(at(r, 3).successCount, 1, "the fire-time SuccessCount stays");
});

test("an instant heal acts at the firing on the health the player had then (his own regeneration is added as a difference, capped at the maximum)", async () => {
  const trace = { samples: [[0, -1, 0, 64, 0, vit(10)], [100, -1, 0, 64, 0, vit(14)]], states: [[0, body(10)]] };
  const r = await runTimed([["effect @p 6 1 1", 150]], trace);
  assert.equal(r.playerDelta.health, 6, "14 + 8 is capped at 20: the command changed 6");
  assert.deepEqual(r.playerDelta.add, []);
  const l = live({ health: 14 });
  replayPlayerCommands(r.playerCommands, { host: l.host, records: r.commandBlocks, playerDelta: r.playerDelta, survival: l.survival });
  assert.equal(l.survival.health, 20);
  const dmg = await runTimed([["effect @p 7 1 0", 50]], { samples: [[0, -1, 0, 64, 0, vit(10)]], states: [[0, body(10)]] });
  assert.equal(dmg.playerDelta.health, -6, "Instant Damage 6 (magic)");
});

test("an effect the command removes stays removed on the return; one the player drank again later is his", async () => {
  const speed = (duration, amplifier = 0) => [{ id: 1, duration, amplifier }];
  const trace = { samples: [[0, -1, 0, 64, 0, vit(20, speed(1000))], [100, -1, 0, 64, 0, vit(20, speed(900))]], states: [[0, body(20, speed(1000))]] };
  const r = await runTimed([["effect @p 1 0", 20], ["effect @p 1 0", 150]], trace);
  assert.deepEqual([3, 4].map((x) => at(r, x).successCount), [1, 0], "the first removes Speed, the second finds none");
  assert.deepEqual(r.playerDelta.remove, [1]);
  const l = live({ effects: speed(800) });
  replayPlayerCommands(r.playerCommands, { host: l.host, records: r.commandBlocks, playerDelta: r.playerDelta, survival: l.survival });
  assert.equal(l.survival.effects.has(1), false);
  const drank = { samples: [[0, -1, 0, 64, 0, vit(20, speed(1000))], [100, -1, 0, 64, 0, vit(20, speed(3000))]], states: [[0, body(20, speed(1000))]] };
  const again = await runTimed([["effect @p 1 0", 20], ["effect @p 1 0", 150]], drank);
  assert.deepEqual([3, 4].map((x) => at(again, x).successCount), [1, 1], "the potion he drank at tick 100 is removable at 150");
  assert.deepEqual(again.playerDelta.remove, [1]);
});

test("the player's own effects only count down in the shadow: a poison he has does not hurt the shadow twice", async () => {
  const poison = (d) => [{ id: 19, duration: d, amplifier: 0 }];
  const trace = { samples: [[0, -1, 0, 64, 0, vit(20, poison(300))], [100, -1, 0, 64, 0, vit(17, poison(200))]], states: [[0, body(20, poison(300))]] };
  const r = await runTimed([["effect @p 10 5 0", 120]], trace, 200);
  // Regeneration I (interval 50) for 100 ticks from run tick 119, 81 ticks left: it heals at duration 100 and 50 (the first tick it runs), so exactly 2; the 3 points the poison took
  // between the samples are the player's own difference (-3 applied to the shadow, not to the command's net).
  assert.equal(r.playerDelta.health, 2);
  assert.equal(r.playerDelta.add.length, 1);
});

test("applyPlayerDelta: hunger, effects and a lethal total through Survival.damage", () => {
  const l = live({ health: 5, food: 10, saturation: 3, exhaustion: 1 });
  applyPlayerDelta(l.survival, { health: 4, food: 15, saturation: 4, exhaustion: 2, add: [{ id: 1, duration: 100, amplifier: 0 }], remove: [] });
  assert.deepEqual([l.survival.health, l.survival.food, l.survival.saturation, l.survival.exhaustion], [9, 20, 7, 3], "food caps at 20, saturation at the food level");
  assert.equal(l.survival.effects.get(1).duration, 100);
  applyPlayerDelta(l.survival, { health: -30, food: 0, saturation: 0, exhaustion: 0, add: [], remove: [1] });
  assert.equal(l.survival.health, 0);
  assert.equal(l.survival.died, true);
  assert.equal(l.survival.effects.has(1), false);
});

test("the trace samples carry the body and a vitals-only change does not fill the snapshot list", async () => {
  const { DimensionLive } = await import("./dimension-live.js");
  const root = { ...base, id: "w3", player: {} };
  let tick = 0, health = 20;
  const host = { ticks: () => tick, chunks: () => [], dirty() {}, player: () => ({ x: 0, y: 70, z: 0 }), awayPlayer: () => ({ state: { health, food: 18, saturation: 2, exhaustion: 0.5, timer: tick, air: 300, time: tick, effects: [{ id: 1, duration: 500 - tick, amplifier: 0 }], slots: [] }, experience: {}, mode: 0, level: 0 }) };
  const dims = new DimensionLive(host);
  dims.away = { rootId: root.id, ticks0: 0, tripMs: 0, chunks: [], records: [], columns: [], trace: { samples: [], states: [] }, lastTrace: -20, traceKey: null };
  for (let i = 0; i < 100; i++) { tick++; if (i === 40) health = 17; dims.traceAway(-1, { x: 0, y: 70, z: 0 }); }
  const { samples, states } = dims.away.trace;
  assert.equal(samples.length, 5);
  assert.deepEqual(samples[0][5].slice(0, 4), [20, 18, 2, 0.5]);
  assert.equal(samples[0][5][4][0].id, 1);
  assert.equal(samples[4][5][0], 17);
  assert.equal(states.length, 1, "health, timers and effect durations moved, but nothing the shadow reads from a snapshot");
});
