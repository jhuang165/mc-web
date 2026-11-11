import { test } from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";
import { AwayBlockLight } from "./away-light.js";
import { World, WorldChunk } from "./world.js";

await populationBlockMapperReady;
const STONE = 3, COMMAND_BLOCK = 139, TORCH = 20;
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x, z, blocks, meta };
});
const setBlock = (chunks, x, y, z, b, m = 0) => {
  const c = chunks.find((k) => k.x === x >> 4 && k.z === z >> 4), i = ((x & 15) * 16 + (z & 15)) * 256 + y;
  c.blocks[i] = b; c.meta[i] = m;
};
const cellOf = (r, x, y, z) => {
  const col = r.columns.find((c) => c.x === x >> 4 && c.z === z >> 4), cell = ((x & 15) << 12) | ((z & 15) << 8) | y;
  const i = col ? [...col.cells].indexOf(cell) : -1;
  return i < 0 ? null : col.values[i] & 255;
};
const base = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], player: { time: 6000 } };
const tile = (command, extra = {}) => ({ x: 3, y: 11, z: 3, command, successCount: 7, customName: "@", trackOutput: true, lastOutput: "old", ...extra });
// A command block with a scheduled tick due on the first run tick (the shape a powered block leaves in the saved redstone queue).
const rootWith = (command, extra = {}) => ({ ...base, redstone: { version: 1, clock: 0, time: 0, pending: [[3, 11, 3, 137, 1, 0, 1]], events: [] }, commandBlocks: [tile(command, extra)] });
const run = (root, ticks = 20, edit = () => {}) => {
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, ticks, 2), chunks: floorChunks(cols), records: [] };
  setBlock(plan.chunks, 3, 11, 3, COMMAND_BLOCK);
  edit(plan.chunks);
  return runAway(plan);
};
const block = (r) => r.commandBlocks.find((t) => t.x === 3 && t.y === 11 && t.z === 3);

test("a due command block runs setblock on the run's world with no player", async () => {
  const r = await run(rootWith("setblock 5 11 5 minecraft:stone"));
  assert.equal(cellOf(r, 5, 11, 5), STONE);
  assert.equal(block(r).successCount, 1);
  assert.equal(r.commandStats.run, 1);
  assert.match(block(r).lastOutput, /Block placed/);
});

test("say, time and an unknown command: native SuccessCount and LastOutput", async () => {
  const say = await run(rootWith("say hi"));
  assert.equal(block(say).successCount, 1);
  assert.ok(say.chat.some((l) => /hi/.test(l)), "broadcast reaches the chat list");
  const time = await run(rootWith("time add 1000"), 20);
  assert.equal(time.timeShift, 1000);
  const bad = await run(rootWith("frobnicate"));
  assert.equal(block(bad).successCount, 0);
  assert.match(block(bad).lastOutput, /Unknown command|commands\.generic\.notFound/);
});

test("a world-restricted selector finds nobody: silent zero, LastOutput untouched; a plain @p finds the player and the command is queued for the return", async () => {
  for (const sel of ["@p[r=10]", "@p[x=0,y=70,z=0]", "@a[rm=1]"]) {
    const r = await run(rootWith(`give ${sel} minecraft:stone`));
    assert.equal(block(r).successCount, 0, sel);
    assert.equal(block(r).lastOutput, "old", sel);
    assert.equal(r.commandStats.silent, 1, sel);
  }
  const plain = await run(rootWith("give @p minecraft:stone"));
  assert.equal(block(plain).successCount, 1, "batch 35: the shadow player runs it at fire time, the replay repeats it at return");
  assert.match(JSON.parse(block(plain).lastOutput).text, /Given/);
  assert.equal(plain.commandStats.skipped, 0);
  assert.equal(plain.commandStats.queued, 1);
  assert.equal(plain.playerCommands[0].command, "give @p minecraft:stone");
  assert.equal((await run(rootWith("difficulty hard"))).difficulty, 3, "batch 35: applied and returned, not skipped");
  const test = await run(rootWith("testfor @p"));
  assert.equal(block(test).successCount, 1, "testfor finds the player in the other dimension");
  const mode = await run(rootWith("testfor @p[m=1]"));
  assert.equal(block(mode).successCount, 0, "the player is in survival: filter fails (found nobody, silent)");
});

test("a setblock outside the spawn area fails as native (out of world) and a gamerule command is returned", async () => {
  const far = await run(rootWith("setblock 900 11 5 minecraft:stone"));
  assert.equal(block(far).successCount, 0);
  const rule = await run(rootWith("gamerule doFireTick false"));
  assert.equal(rule.world.gameRules.doFireTick, "false");
});

test("an ender pearl in flight lands and dies with nobody to teleport; it ticks instead of freezing", async () => {
  const root = { ...base, projectiles: [{ kind: "enderPearl", owner: "player", x: 5.5, y: 20, z: 5.5, mx: 0.2, my: -0.3, mz: 0 }] };
  const r = await run(root, 200);
  assert.equal(r.entities.projectiles.length, 0);
});

test("block light: torches light the volume at the fixed point, walls stop it, and an edit re-floods after the throttle", () => {
  const world = new World("light", "javaStreamed", 15, "flat", "");
  world.chunks = new Map();
  for (const [x, z] of [[0, 0], [1, 0]]) { const c = new WorldChunk(x, z, world.height); world.chunks.set(`${x},${z}`, c); }
  world.set(5, 11, 5, TORCH, false, 5);
  const light = new AwayBlockLight(world, [{ x: 0, z: 0 }, { x: 1, z: 0 }]);
  assert.equal(light.blockAt(5, 11, 5), 14);
  assert.equal(light.blockAt(8, 11, 5), 11);
  assert.equal(light.blockAt(5, 11, 25), 0);
  for (let y = 0; y < 40; y++) world.set(7, y, 5, STONE, false);
  light.touch(0, STONE); light.refresh(100);
  assert.ok(light.blockAt(9, 11, 5) < 11, "the wall shadows the cells behind it");
  assert.equal(light.floods, 2);
  light.touch(0, STONE); light.refresh(101);
  assert.equal(light.floods, 2, "throttled");
});

// ---- Batch 34: player commands are queued by the run and replayed through the live command host ----
import { replayPlayerCommands } from "./away-commands.js";
import { createCommandHost } from "./command-host.js";
import { Survival } from "./survival.js";
import { Experience } from "./experience.js";
import { chat } from "./chat-ui.js";
const liveHost = () => {
  const survival = new Survival({}, "survival"), experience = new Experience(), active = { mode: "survival", allowCommands: true, seed: "x" }, drops = [];
  const env = { active: () => active, world: () => new World("x", "meadow", 1), weather: () => null, mobs: () => null, survival: () => survival, experience: () => experience, position: () => ({ x: 10.5, y: 40, z: 10.5 }), seed: () => "x",
    stackName: (s) => "Item" + s.id, giveDrop: (s) => drops.push(s), refreshInventory() {}, changed() {}, setTime() {}, teleport() { throw new Error("tp must not reach the live host"); }, setMode: (m) => { survival.mode = m; survival.inventory.creative = survival.creative; }, updateBlock() {}, destroyBlock() {} };
  return { survival, experience, drops, host: createCommandHost(env) };
};
const DIAMOND = 303;
test("give, xp, clear, tp and kill from a command block: queued or run, replayed in order with the native SuccessCount and LastOutput", async () => {
  chat.clear();
  const live = liveHost(), give = { ...tile("give @p minecraft:diamond 3"), x: 3, y: 11, z: 3 };
  const first = await run(rootWith("give @p minecraft:diamond 3"), 20);
  assert.deepEqual(first.playerCommands.map((e) => e.command), ["give @p minecraft:diamond 3"]);
  assert.equal(first.commandStats.skipped, 0);
  const out = replayPlayerCommands(first.playerCommands, { host: live.host, records: first.commandBlocks, giveStack: (s) => live.survival.inventory.add(s) });
  assert.deepEqual([out.applied, out.succeeded], [1, 1]);
  assert.equal(live.survival.count(DIAMOND), 3, "the diamond is in the inventory");
  assert.equal(block(first).successCount, 1);
  assert.match(JSON.parse(block(first).lastOutput).text, /^\[\d\d:\d\d:\d\d\] Given \[Item303\] \* 3 to Player$/);
  void give;
  // xp, clear (nothing to clear: failure 0 with the native text), a literal name, an @a, and tell
  const xp = await run(rootWith("xp 7 @p"));
  replayPlayerCommands(xp.playerCommands, { host: live.host, records: xp.commandBlocks });
  assert.equal(live.experience.total, 7); assert.equal(block(xp).successCount, 1);
  const clear = await run(rootWith("clear @p minecraft:emerald"));
  replayPlayerCommands(clear.playerCommands, { host: live.host, records: clear.commandBlocks });
  assert.equal(block(clear).successCount, 0); assert.match(block(clear).lastOutput, /Could not clear the inventory of Player/);
  const named = await run(rootWith("give Player minecraft:diamond"));
  assert.equal(named.commandStats.queued, 1, "a literal name finds the player in any dimension");
  const other = await run(rootWith("give Nobody minecraft:diamond"));
  assert.equal(other.commandStats.queued, 0); assert.match(block(other).lastOutput, /That player cannot be found/); assert.equal(block(other).successCount, 0);
  // tp: native success text, the move discarded, nothing queued
  const tp = await run(rootWith("tp @p 1 2 3"));
  assert.equal(tp.playerCommands.length, 0); assert.equal(tp.commandStats.tpDiscarded, 1);
  assert.equal(block(tp).successCount, 1); assert.match(block(tp).lastOutput, /Teleported Player to 1\.5,2\.5,3\.5/);
  // kill from a command block is PlayerNotFound natively
  const kill = await run(rootWith("kill"));
  assert.equal(block(kill).successCount, 0); assert.match(block(kill).lastOutput, /That player cannot be found/); assert.equal(kill.playerCommands.length, 0);
});

test("a clock firing a give keeps firing order and a bounded chat; the queue is capped and counted", async () => {
  // Three due command ticks of the same block are not needed: three blocks fire in the same tick in tree order.
  const root = { ...base, redstone: { version: 1, clock: 0, time: 0, pending: [[3, 11, 3, 137, 1, 0, 1], [4, 11, 3, 137, 1, 0, 2], [5, 11, 3, 137, 1, 0, 3]], events: [] },
    commandBlocks: ["give @p minecraft:diamond 1", "give @p minecraft:diamond 2", "give @p minecraft:diamond 4"].map((c, i) => ({ ...tile(c), x: 3 + i })) };
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, 20, 2), chunks: floorChunks(cols), records: [] };
  for (const x of [3, 4, 5]) setBlock(plan.chunks, x, 11, 3, COMMAND_BLOCK);
  const r = await runAway(plan);
  assert.deepEqual(r.playerCommands.map((e) => e.command.slice(-1)), ["1", "2", "4"]);
  const live = liveHost(), lines = [];
  live.host.print = (t) => lines.push(t);
  const out = replayPlayerCommands(r.playerCommands, { host: live.host, records: r.commandBlocks, chatCap: 2, giveStack: (s) => live.survival.inventory.add(s) });
  assert.equal(live.survival.count(DIAMOND), 7);
  assert.equal(out.muted > 0, true, "feedback lines beyond the cap are dropped");
});

test("a burning furnace emits block light 13 in the away run; a cold one does not, and lighting it re-floods", () => {
  const FURNACE = 14;
  const world = new World("light2", "javaStreamed", 15, "flat", "");
  world.chunks = new Map(); world.chunks.set("0,0", new WorldChunk(0, 0, world.height));
  world.set(5, 11, 5, FURNACE, false, 2);
  let burning = [];
  const light = new AwayBlockLight(world, [{ x: 0, z: 0 }], () => burning);
  assert.equal(light.blockAt(6, 11, 5), 0, "cold");
  burning = ["5,11,5"]; light.refresh(100);
  assert.equal(light.blockAt(6, 11, 5), 12, "lit: 13 at the furnace, one less beside it");
  assert.equal(light.blockAt(5, 11, 5), 13);
  burning = []; light.refresh(200);
  assert.equal(light.blockAt(6, 11, 5), 0, "out again");
});

// ---- Batch 35: shadow player (fire-time effect), /spawnpoint, /difficulty, sky light under cover ----
// Three command blocks due in the same tick fire in tree order (x = 3, 4, 5).
const runBlocks = async (commands, ticks = 20, player = {}) => {
  const root = { ...base, redstone: { version: 1, clock: 0, time: 0, pending: commands.map((_, i) => [3 + i, 11, 3, 137, 1, 0, 1 + i]), events: [] },
    commandBlocks: commands.map((c, i) => ({ ...tile(c), x: 3 + i })) };
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, ticks, 2), chunks: floorChunks(cols), records: [] };
  plan.player = { ...plan.player, ...player };
  for (let i = 0; i < commands.length; i++) setBlock(plan.chunks, 3 + i, 11, 3, COMMAND_BLOCK);
  return runAway(plan);
};
const at = (r, x) => r.commandBlocks.find((t) => t.x === x);
test("a later command in the run sees an earlier one: give then clear, xp then a level filter, gamemode then a mode filter (fire-time shadow player)", async () => {
  const r = await runBlocks(["give @p minecraft:diamond 3", "clear @p minecraft:diamond", "clear @p minecraft:diamond"]);
  assert.equal(at(r, 3).successCount, 1, "the give succeeded at fire time");
  assert.match(JSON.parse(at(r, 3).lastOutput).text, /Given \[.*\] \* 3 to Player/);
  assert.equal(at(r, 4).successCount, 1, "the clear found the diamonds the give put in");
  assert.match(JSON.parse(at(r, 4).lastOutput).text, /Cleared the inventory of Player, removing 3 items/);
  assert.equal(at(r, 5).successCount, 0, "and the second clear finds nothing");
  assert.equal(r.commandStats.shadow, 3);
  assert.deepEqual(r.playerCommands.map((e) => e.command.split(" ")[0]), ["give", "clear", "clear"], "all three still replay at return");
  const lv = await runBlocks(["testfor @p[lm=5]", "xp 5L @p", "testfor @p[lm=5]"]);
  assert.equal(at(lv, 3).successCount, 0); assert.equal(at(lv, 4).successCount, 1); assert.equal(at(lv, 5).successCount, 1, "level 5 is visible to the next block");
  const mode = await runBlocks(["testfor @p[m=1]", "gamemode 1 @p", "testfor @p[m=1]"]);
  assert.deepEqual([3, 4, 5].map((x) => at(mode, x).successCount), [0, 1, 1]);
});

test("the shadow player starts from the state the player returns with, and the replayed result matches", async () => {
  const state = new Survival({}, "survival"); state.inventory.add({ id: DIAMOND, count: 2, damage: 0 });
  const r = await runBlocks(["clear @p minecraft:diamond", "give @p minecraft:diamond 1"], 20, { state: JSON.parse(JSON.stringify(state.serialize())) });
  assert.equal(at(r, 3).successCount, 1, "the returning player's own 2 diamonds are cleared");
  assert.match(JSON.parse(at(r, 3).lastOutput).text, /removing 2 items/);
});

test("/spawnpoint with four absolute integers sets the respawn point; without coordinates it is skipped; /difficulty is applied and returned", async () => {
  const sp = await runBlocks(["spawnpoint @p 7 70 -9", "spawnpoint @p ~ 70 4", "spawnpoint @p", "difficulty hard"]);
  assert.deepEqual(sp.world.playerSpawn, [7, 70, -9]);
  assert.equal(at(sp, 3).successCount, 1); assert.match(JSON.parse(at(sp, 3).lastOutput).text, /Set Player's spawn point to \(7, 70, -9\)/);
  assert.equal(at(sp, 4).successCount, 0, "~ is not an integer natively (CommandBase.a(sender, s, min, max))");
  assert.equal(at(sp, 5).successCount, 7, "no coordinates: the player's position in the other dimension is unknown, skipped");
  assert.equal(sp.commandStats.skipped, 1);
  assert.equal(sp.difficulty, 3); assert.equal(at(sp, 6).successCount, 1);
  const none = await runBlocks(["spawnpoint @p[r=5] 1 2 3"]);
  assert.equal(none.world, undefined, "a world-restricted selector finds nobody");
});

test("sky light under cover: a roof shades the cells beneath it by distance from open sky, open sky stays 15, an unheld column answers null", () => {
  const world = new World("sky", "javaStreamed", 15, "flat", "");
  world.chunks = new Map();
  for (const [x, z] of [[0, 0], [1, 0]]) world.chunks.set(`${x},${z}`, new WorldChunk(x, z, world.height));
  for (let x = 3; x <= 13; x++) for (let z = 3; z <= 13; z++) world.set(x, 20, z, STONE, false);
  const light = new AwayBlockLight(world, [{ x: 0, z: 0 }, { x: 1, z: 0 }]);
  assert.equal(light.skyAt(8, 19, 8), 9, "six cells in from the roof edge: 15 - 6");
  assert.equal(light.skyAt(3, 19, 8), 14);
  assert.equal(light.skyAt(16, 19, 8), 15, "open sky");
  assert.equal(light.skyAt(8, 30, 8), 15, "above the roof");
  assert.equal(light.skyAt(100, 19, 8), null);
  // an edit under the roof's opacity re-floods after the throttle: remove the roof, the cell is open sky
  for (let x = 3; x <= 13; x++) for (let z = 3; z <= 13; z++) { world.set(x, 20, z, 0, false); light.touch(STONE, 0); }
  light.refresh(1000);
  assert.equal(light.skyAt(8, 19, 8), 15);
});

// ---- Batch 36: the shadow player follows the trip's trace ----
// Blocks due at the given ticks (redstone `time` is absolute with clock 0), the player's trace as the main thread records it.
const runTimed = async (blocks, trace, ticks = 200) => {
  const root = { ...base, redstone: { version: 1, clock: 0, time: 0, pending: blocks.map(([, t], i) => [3 + i, 11, 3, 137, t, 0, 1 + i]), events: [] },
    commandBlocks: blocks.map(([c], i) => ({ ...tile(c), x: 3 + i })) };
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, ticks, 2), chunks: floorChunks(cols), records: [], trace };
  for (let i = 0; i < blocks.length; i++) setBlock(plan.chunks, 3 + i, 11, 3, COMMAND_BLOCK);
  return runAway(plan);
};
const snapshot = (n) => { const s = new Survival({}, "survival"); if (n) s.inventory.add({ id: DIAMOND, count: n, damage: 0 }); return { state: JSON.parse(JSON.stringify(s.serialize())), experience: new Experience({}).serialize(), mode: 0, level: 0 }; };

test("/spawnpoint @p takes the player's own block position at the firing (floor x, floor(y + 0.5), floor z) from the trace", async () => {
  const trace = { samples: [[0, -1, 0.5, 64, 0.5], [40, -1, 10.7, 70.6, -5.2], [100, -1, 50, 65, 50]], states: [[0, snapshot(0)]] };
  const early = await runTimed([["spawnpoint @p", 10]], trace);
  assert.deepEqual(early.world.playerSpawn, [0, 64, 0]);
  const later = await runTimed([["spawnpoint @p", 10], ["spawnpoint @p", 50], ["spawnpoint Player", 120]], trace);
  assert.match(JSON.parse(at(later, 4).lastOutput).text, /Set Player's spawn point to \(10, 71, -6\)/, "y 70.6 + 0.5 floors to 71, z -5.2 floors to -6");
  assert.match(JSON.parse(at(later, 5).lastOutput).text, /\(50, 65, 50\)/, "the sample in force at tick 120 is the one from tick 100");
  assert.deepEqual(later.world.playerSpawn, [50, 65, 50], "the last firing wins; not queued for the replay");
  assert.equal(later.commandStats.shadowSpawn, 3);
  assert.equal(later.playerCommands.length, 0);
  const bare = await runTimed([["spawnpoint", 10]], trace);
  assert.equal(at(bare, 3).successCount, 0, "no argument: a command block is not a player (CommandBase.b(sender) throws)");
  assert.equal(bare.world, undefined);
  const untraced = await runTimed([["spawnpoint @p", 10]], undefined);
  assert.equal(untraced.commandStats.skipped, 1, "without a trace the position is unknown: skipped, as in batch 35");
});

test("each firing starts from the player's state at its own tick: what he picked up in the Nether is added to the shadow, which keeps the effects of earlier commands", async () => {
  const trace = { samples: [[0, -1, 0, 64, 0]], states: [[0, snapshot(0)], [60, snapshot(3)]] };
  const r = await runTimed([["clear @p minecraft:diamond", 30], ["give @p minecraft:diamond 2", 40], ["clear @p minecraft:diamond", 100]], trace);
  assert.equal(at(r, 3).successCount, 0, "tick 30: the player has no diamonds yet (he finds three at tick 60)");
  assert.equal(at(r, 4).successCount, 1);
  assert.equal(at(r, 5).successCount, 1);
  assert.match(JSON.parse(at(r, 5).lastOutput).text, /removing 5 items/, "the 3 he picked up plus the 2 the earlier command gave");
  assert.equal(r.commandStats.traceChanges, 1);
  const level = { samples: [[0, -1, 0, 64, 0]], states: [[0, snapshot(0)], [50, { ...snapshot(0), experience: (() => { const x = new Experience({}); x.add(200); return x.serialize(); })(), level: 11 }]] };
  const lv = await runTimed([["testfor @p[lm=5]", 20], ["testfor @p[lm=5]", 80]], level);
  assert.deepEqual([3, 4].map((x) => at(lv, x).successCount), [0, 1], "@p[lm=5] sees the level at firing");
});

test("the return applies give and clear as one net inventory change from the trace, not as re-runs on the return state", async () => {
  // He finds 2 diamonds at tick 60. A clear at tick 30 finds none (fails, takes nothing); a give of 4 at tick 40 and a clear of everything at tick 100 net to taking the 2 he found.
  const trace = { samples: [[0, -1, 0, 64, 0]], states: [[0, snapshot(0)], [60, snapshot(2)]] };
  const r = await runTimed([["clear @p minecraft:diamond", 30], ["give @p minecraft:diamond 4", 40], ["clear @p minecraft:diamond", 100]], trace);
  assert.deepEqual([3, 4, 5].map((x) => at(r, x).successCount), [0, 1, 1]);
  assert.deepEqual(r.inventoryDelta.map((d) => [d.stack.id, d.count]), [[DIAMOND, -2]], "net: the 2 he picked up are cleared; the 4 given were cleared too");
  const live = liveHost(); live.survival.inventory.add({ id: DIAMOND, count: 2, damage: 0 }); // the live player at return has what he found
  const out = replayPlayerCommands(r.playerCommands, { host: live.host, records: r.commandBlocks, delta: r.inventoryDelta, inventory: live.survival.inventory, giveStack: (s) => live.survival.inventory.add(s) });
  assert.equal(live.survival.count(DIAMOND), 0);
  assert.deepEqual([out.applied, out.succeeded, out.failed, out.byDelta], [3, 2, 1, 3]);
  assert.equal(at(r, 3).successCount, 0, "the fire-time SuccessCount stays (the replay does not rewrite it)");
  const keep = await runTimed([["give @p minecraft:diamond 4", 40]], trace);
  const live2 = liveHost(); live2.survival.inventory.add({ id: DIAMOND, count: 2, damage: 0 });
  replayPlayerCommands(keep.playerCommands, { host: live2.host, records: keep.commandBlocks, delta: keep.inventoryDelta, inventory: live2.survival.inventory, giveStack: (s) => live2.survival.inventory.add(s) });
  assert.equal(live2.survival.count(DIAMOND), 6, "a give adds to what he found");
});

test("batch 42: /xp from a command block acts on the shadow at its firing and goes back as net xpOps, not as a re-run on the live player", async () => {
  const trace = { samples: [[0, -1, 0, 64, 0]], states: [[0, snapshot(0)]] };
  const r = await runTimed([["xp 7 @p", 30], ["xp 2L @p", 60]], trace);
  assert.deepEqual([3, 4].map((x) => at(r, x).successCount), [1, 1], "fire-time SuccessCount from the shadow");
  assert.deepEqual(r.xpOps, [["points", 7], ["levels", 2]]);
  const live = liveHost(); live.experience.add(10); // what he picked up in the Nether meanwhile
  const out = replayPlayerCommands(r.playerCommands, { host: live.host, records: r.commandBlocks, xpOps: r.xpOps });
  assert.deepEqual([out.applied, out.succeeded, out.byDelta], [2, 2, 2]);
  assert.equal(live.experience.total, 17, "his 10 plus the 7 points, applied once");
  assert.equal(live.experience.level, 2 + 1, "level 1 at 17 points, then two levels");
  assert.equal(at(r, 3).successCount, 1);
});

test("batch 42: the clock a command block sees at run tick n is T0 + n + 1 (WorldServer.tick adds the total time before tickUpdates), so the last tick sees the saved time", async () => {
  const a = await runTimed([["time set 5000", 30]], null, 100), b = await runTimed([["give @p minecraft:diamond 1", 30]], null, 100);
  const n = b.playerCommands[0].tick; // the same block at the same scheduled time fires in the same tick
  const T0 = (base.player?.time ?? 0) - 100;
  assert.ok(n >= 29 && n <= 31, `fired near tick 30, index ${n}`);
  assert.equal(a.timeShift, 5000 - (T0 + n + 1), "time set measured against T0 + n + 1");
});
