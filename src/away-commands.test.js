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
