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

test("a world-restricted selector finds nobody: silent zero, LastOutput untouched; a plain @p finds the player and the command is skipped", async () => {
  for (const sel of ["@p[r=10]", "@p[x=0,y=70,z=0]", "@a[rm=1]"]) {
    const r = await run(rootWith(`give ${sel} minecraft:stone`));
    assert.equal(block(r).successCount, 0, sel);
    assert.equal(block(r).lastOutput, "old", sel);
    assert.equal(r.commandStats.silent, 1, sel);
  }
  const plain = await run(rootWith("give @p minecraft:stone"));
  assert.equal(block(plain).successCount, 7, "skipped: unchanged");
  assert.equal(block(plain).lastOutput, "old");
  assert.equal(plain.commandStats.skipped, 1);
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
