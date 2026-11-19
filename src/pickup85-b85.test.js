// Batch 85 pickup85: Creative pickups on the server, the away world's skull tiles, a Nether player's skull break, and farmland under a solid block.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";
import { SKULL, ITEM_SKULL } from "./skull.js";

await populationBlockMapperReady;
const src = (f) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
const STONE = 3, COMMAND_BLOCK = 139;
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x: cols.length ? x : 0, z, blocks, meta };
});
const setBlock = (chunks, x, y, z, b, m = 0) => {
  const c = chunks.find((k) => k.x === x >> 4 && k.z === z >> 4), i = ((x & 15) * 16 + (z & 15)) * 256 + y;
  c.blocks[i] = b; c.meta[i] = m;
};
const root = (command, skulls) => ({ seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], player: { time: 6000 }, skulls,
  redstone: { version: 1, clock: 0, time: 0, pending: [[3, 11, 3, 137, 1, 0, 1]], events: [] },
  commandBlocks: [{ x: 3, y: 11, z: 3, command, successCount: 0, customName: "@", trackOutput: true, lastOutput: null }] });
const run = (r) => {
  const cols = stateColumns(r), plan = { ...awayPlan(r, cols, 20, 2), chunks: floorChunks(cols), records: [] };
  setBlock(plan.chunks, 3, 11, 3, COMMAND_BLOCK); setBlock(plan.chunks, 5, 11, 5, SKULL, 1);
  return runAway(plan);
};

test("away world: a skull replaced by /setblock drops its own type and the tile goes", async () => {
  const r = await run(root("setblock 5 11 5 minecraft:stone", [{ x: 5, y: 11, z: 5, type: 1, rot: 0, owner: "" }, { x: 9, y: 11, z: 9, type: 2, rot: 0, owner: "" }]));
  const got = (r.entities?.drops ?? r.drops).map((d) => d.stack ?? d).filter((s) => s.id === ITEM_SKULL);
  assert.equal(got.length, 1);
  assert.equal(got[0].damage, 1);
  assert.deepEqual(r.skulls.map((t) => t.x), [9], "only the consumed tile left the store");
});
test("away world: sources wire the store into the piston path and the result", () => {
  assert.match(src("away-world.js"), /skulls: \(\) => skullTiles/);
  assert.match(src("redstone-runtime.js"), /skulls: \(\) => game\.skulls\?\.\(\)/);
  assert.match(src("dimension-live.js"), /root\.skulls = r\.skulls/);
});
test("server pickup has no Creative gate and the client fit counts Creative", () => {
  assert.doesNotMatch(src("multiplayer/server-items.js"), /p\.dead \|\| p\.survival\.creative \|\| !Array/);
  assert.doesNotMatch(src("main.js"), /if \(survival\.creative \|\| !multiplayer\?\.ready\) return;/);
});

test("server: a Creative player collects an item (EntityItem.onCollideWithPlayer has no game-mode test); a full inventory still consumes it", async () => {
  const { World } = await import("./world.js"), { DedicatedSimulation } = await import("./multiplayer/simulation.js");
  const world = new World("pickup85");
  for (let x = 50; x <= 80; x++) for (let z = 55; z <= 75; z++) for (let y = 9; y <= 20; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "creative", mobs: false });
  const a = s.addPlayer("a", "Alice", "00000000-0000-0000-0000-000000000001"); a.position.copy({ x: 64.5, y: 10, z: 64.5 });
  const inv = a.survival.inventory, count = () => inv.main.reduce((n, t) => n + (t && t.id === 3 ? t.count : 0), 0), before = count();
  const e = s.items.spawn({ id: 3, count: 10, damage: 0 }, 64.5, 10.5, 64.5, { motion: [0, 0, 0] });
  for (let i = 0; i < 20; i++) s.tick();
  const eid = e.eid;
  assert.equal(s.pickup("a", [eid], [64]), true);
  assert.equal(count() - before, 10);
  assert.equal(s.itemList().length, 0);
  for (let i = 0; i < 36; i++) inv.main[i] = { id: 1, count: 64, damage: 0 };
  const f = s.items.spawn({ id: 3, count: 5, damage: 0 }, 64.5, 10.5, 64.5, { motion: [0, 0, 0] });
  for (let i = 0; i < 20; i++) s.tick();
  s.pickup("a", [f.eid], [0]);
  assert.equal(s.itemList().length, 0, "Creative addItemStackToInventory consumes the stack even with no room");
});

test("server: a Nether player's break reads the Nether's skull store, not the Overworld's (executed)", async () => {
  const { World } = await import("./world.js"), { DedicatedSimulation } = await import("./multiplayer/simulation.js"), { IDLE_INPUT } = await import("./multiplayer/protocol.js");
  const w0 = new World("pickup85-nether"); w0.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world: w0, gameMode: "survival", mobs: false });
  const a = s.addPlayer("a", "Alice", "00000000-0000-0000-0000-000000000001");
  s.dimensions.arrive(a, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  const n = s.dimensions.nether;
  for (let x = 58; x <= 70; x++) for (let z = 58; z <= 70; z++) for (let y = 66; y <= 74; y++) n.world.put(x, y, z, y === 69 ? 150 : 0, 0, false);
  s.input("a", { type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
  n.world.set(64, 70, 61, SKULL, true, 1); n.tileEntities.skulls.create(64, 70, 61, 1);
  s.tileEntities.skulls.create(64, 70, 61, 4); // the Overworld store holds a different tile at the same cell
  s.dimensions.within(a, () => s.breakDug(a, [64, 70, 61]));
  const drops = n.items.items.filter((e) => e.stack.id === ITEM_SKULL);
  assert.equal(drops.length, 1);
  assert.equal(drops[0].stack.damage, 1, "the Nether tile's type, not the Overworld's creeper");
  assert.ok(s.tileEntities.skulls.tile(64, 70, 61), "the Overworld's tile is untouched");
});

test("farmland set under a solid block stays until a neighbour changes (World.setBlock notifies neighbours, aky has no onBlockAdded)", async () => {
  const { World } = await import("./world.js"), { farmNeighbourChange } = await import("./farming.js");
  const w = new World("pickup85-farm");
  for (let x = 50; x <= 60; x++) for (let z = 50; z <= 60; z++) for (let y = 9; y <= 14; y++) w.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  w.put(55, 11, 55, 29, 0, false); w.put(55, 12, 55, 3, 0, false);
  assert.deepEqual(farmNeighbourChange(w, 55, 11, 55), [], "the farmland's own placement does not check itself");
  assert.equal(w.get(55, 11, 55), 29);
  const ch = farmNeighbourChange(w, 55, 12, 55); // a change of the block above notifies it
  assert.equal(ch.length, 1); assert.equal(w.get(55, 11, 55), 2);
});
