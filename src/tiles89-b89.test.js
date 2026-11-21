// Batch 89 tiles89: tile entities after tiles88. Notes: .shared-memory/notes/tiles89-b89-track.md.
//  * Chunk.func_150807_a (apx.a(IIILaji;I)Z, bytecode-read): early return only when the block and the metadata are both unchanged; otherwise, server side,
//    breakBlock of the old block (no id test), onBlockAdded of the new one (no id test), then a fresh tile for a container without one. Single player is
//    an integrated server, so its world edits now share the server's rule (container-tiles.js swapTiles / installTileSwaps).
//  * /setblock compares the original id and metadata of chests (facing in the record) and furnaces (lit = burning, facing in the cell); BlockFurnace.onBlockAdded
//    (ale.e) settles the furnace's facing whatever the command wrote.
//  * WorldServer.tick (mt.b): calculateSkylightSubtracted before the clock's step; executed values: Tiles88Probe (tiles88-reference.json).
//  * BlockFurnace.updateFurnaceBlockState (ale.a(ZLahb;III)V): keepInventory around setBlock, then the old tile is put back: a lit/unlit flip keeps the tile.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { populationBlockMapperReady } from "./population-world.js";
import { itemFromOriginal } from "./region-import.js";
import { swapTiles as sharedSwap, installTileSwaps, swapChestRecord, furnaceAddedFacing, heldTiles, tilesReplaced } from "./container-tiles.js";
import { swapTiles as serverSwap } from "./multiplayer/server-tile-swaps.js";
import { fromOriginal } from "./block-registry.js";
import { World, SIGN_POST, WALL_SIGN } from "./world.js";
import { Signs } from "./signs.js";
import { Survival, smeltingResult } from "./survival.js";
import { createCommandHost } from "./command-host.js";
import { createCommandRunner } from "./commands.js";
import { celestialAngle, skylightSubtracted } from "./lighting.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";

await populationBlockMapperReady;
const src = (f) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
const reference = JSON.parse(readFileSync(new URL("../public/research/tiles88-reference.json", import.meta.url), "utf8"));
const internal = (orig) => fromOriginal(orig).id;
const CHEST = internal(54), TRAPPED = internal(146), FURNACE = internal(61), STONE = 3;
const DIAMOND_ID = itemFromOriginal(264).id, COAL_ID = itemFromOriginal(263).id; // browser item ids
const DIAMOND = { id: DIAMOND_ID, count: 40, damage: 0 }, COAL = { id: COAL_ID, count: 3, damage: 0 };
const total = (stacks) => stacks.reduce((n, s) => n + s.count, 0);
const ofId = (stacks, id) => total(stacks.flat().filter((s) => s?.id === id));

// ---- 1. one rule for both hosts ----

test("swapTiles: the server module re-exports the shared rule; installTileSwaps reads the cell only for sign and chest writes", () => {
  assert.equal(serverSwap, sharedSwap, "multiplayer/server-tile-swaps.js and container-tiles.js are one function");
  const world = new World("tiles89-wrap", "meadow", 1);
  const calls = [];
  installTileSwaps(world, { signs: { remove: (...a) => calls.push(["remove", ...a]), create: (...a) => calls.push(["create", ...a]) }, containers: { swapChest: (...a) => calls.push(["swap", ...a]) } });
  world.set(3, 52, 3, CHEST); world.set(3, 52, 3, TRAPPED); world.set(3, 52, 3, TRAPPED);
  world.set(4, 52, 4, SIGN_POST, true, 2); world.set(4, 52, 4, SIGN_POST, true, 6); world.set(4, 52, 4, SIGN_POST, true, 6);
  world.put(5, 52, 5, CHEST, 0, false); world.put(5, 52, 5, TRAPPED, 0, false); // untracked writes are World.setBlock too (the server's put wrapper sees them)
  assert.deepEqual(calls, [["swap", 3, 52, 3], ["remove", 4, 52, 4], ["create", 4, 52, 4], ["swap", 5, 52, 5]]);
  let reads = 0; const get = world.get.bind(world); world.get = (...a) => { reads++; return get(...a); };
  world.set(6, 52, 6, STONE); world.put(6, 52, 6, 0, 0, false);
  const statReads = reads; reads = 0;
  world.put(7, 52, 7, CHEST, 0, false);
  assert.ok(reads >= 1 && statReads <= 2, `other blocks pass through (World.set's own reads only: ${statReads})`);
});

// The single-player host as main.js wires it (watchFlowers): signs, survival.chests, the spill into a list.
function singlePlayer() {
  const world = new World("tiles89-sp", "meadow", 1), survival = new Survival({}, "creative"), signs = new Signs(), spilled = [], closed = [];
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 50; y <= 55; y++) world.set(x, y, z, 0);
  installTileSwaps(world, { get signs() { return signs; }, containers: { swapChest: (x, y, z) => swapChestRecord(world, survival.chests, x, y, z, (stacks) => spilled.push(stacks)) }, own: () => true });
  const env = { world: () => world, survival: () => survival, active: () => ({ mode: "creative", allowCommands: true }), position: () => ({ x: 8, y: 52, z: 8 }),
    changed() {}, refreshInventory() {}, stackName: () => "stack", updateBlock() {}, destroyBlock(x, y, z) { world.set(x, y, z, 0); }, signs: () => signs,
    spillTile: (stacks, x, y, z) => spilled.push(stacks), closeTile: (k) => closed.push(k) };
  const h = createCommandHost(env); h.print = () => {};
  const runner = createCommandRunner(h);
  return { world, survival, signs, spilled, closed, run: (s) => runner.run(s), host: h };
}

test("single player world edit: a chest <-> trapped chest swap spills, closes the screen and settles a fresh tile; a meta-only sign rewrite starts an empty sign", () => {
  const g = singlePlayer();
  g.world.set(4, 52, 4, CHEST); g.world.set(4, 52, 3, STONE); // an opaque north side: func_149954_e faces the lone chest south (3)... and the south one decides 2
  g.survival.chests["4,52,4"] = { items: [{ ...DIAMOND }, null, { ...COAL }], facing: 5, users: 0, lid: 0, prevLid: 0 };
  const held = heldTiles(g.survival, "chest", "4,52,4", ["4,52,4"]);
  g.world.set(4, 52, 4, TRAPPED);
  assert.equal(ofId(g.spilled, DIAMOND_ID), 40); assert.equal(ofId(g.spilled, COAL_ID), 3);
  const fresh = g.survival.chests["4,52,4"];
  assert.ok(fresh && fresh.items.every((s) => !s), "BlockChest.onBlockAdded: the new block's tile is empty");
  assert.equal(fresh.facing, 3, "func_149954_e: opaque north, open south -> 3 (not the old record's 5)");
  assert.equal(tilesReplaced(g.survival, held), true, "isUseableByPlayer fails: the screen closes (main.js tickChests)");
  g.spilled.length = 0;
  g.world.set(4, 52, 4, TRAPPED);
  assert.equal(g.survival.chests["4,52,4"], fresh, "an unchanged write keeps the tile");
  // A large chest: the half that becomes a trapped chest leaves its partner, which keeps its own tile.
  g.world.set(8, 52, 8, CHEST); g.world.set(9, 52, 8, CHEST);
  g.survival.chests["8,52,8"] = { items: [{ ...COAL }], facing: 2 }; const partner = g.survival.chests["9,52,8"] = { items: [{ ...DIAMOND }], facing: 2 };
  g.world.set(9, 52, 8, TRAPPED);
  assert.equal(ofId(g.spilled, DIAMOND_ID), 40); assert.equal(ofId(g.spilled, COAL_ID), 0, "only the swapped half's slots");
  assert.equal(g.survival.chests["8,52,8"].items[0].id, COAL_ID);
  assert.notEqual(g.survival.chests["9,52,8"], partner);
  // Signs: the same id with another metadata (World.setBlock, not setBlockMetadataWithNotify) is a new TileEntitySign.
  g.world.set(6, 52, 6, SIGN_POST, true, 0); const old = g.signs.create(6, 52, 6); old.text = ["old", "", "", ""]; old.editable = false;
  g.world.set(6, 52, 6, SIGN_POST, true, 0);
  assert.equal(g.signs.tile(6, 52, 6), old);
  g.world.set(6, 52, 6, SIGN_POST, true, 8);
  const sign = g.signs.tile(6, 52, 6);
  assert.ok(sign && sign !== old);
  assert.deepEqual([sign.text, sign.editable], [["", "", "", ""], true]);
  g.world.set(7, 52, 6, WALL_SIGN, true, 2); g.signs.create(7, 52, 6).text = ["w", "", "", ""];
  g.world.set(7, 52, 6, WALL_SIGN, true, 3);
  assert.equal(g.signs.tile(7, 52, 6).text[0], "", "a wall sign's facing too");
});

test("single player /setblock trapped_chest with the world hook: the slots spill once and the new chest is empty", () => {
  const g = singlePlayer();
  g.world.set(4, 52, 4, CHEST); g.survival.chests["4,52,4"] = { items: [{ ...DIAMOND }], facing: 3 };
  assert.equal(g.run("/setblock 4 52 4 minecraft:trapped_chest"), true);
  assert.equal(ofId(g.spilled, DIAMOND_ID), 40, "the hook spilled, the command host's loop then found an empty record");
  assert.ok(g.survival.chests["4,52,4"].items.every((s) => !s));
});

test("hosts: main.js installs the shared hook (single player only), the away run too; the server's wrappers keep calling it", () => {
  const main = src("main.js");
  assert.match(main, /installTileSwaps\(w, \{ get signs\(\) \{ return signs; \}, containers: \{ swapChest: \(x, y, z\) => swapChestRecord\(w, survival\.chests, x, y, z, \(stacks\) => items\.spill\(stacks\.map\(copyStack\), x, y, z\)\) \}, own: \(\) => !active\?\.remote \}\);/);
  assert.match(src("away-world.js"), /installTileSwaps\(world, \{ signs: null, containers: \{ swapChest: \(x, y, z\) => swapChestRecord\(world, \(tiles\.chests \?\?= \{\}\), x, y, z, \(stacks\) => spillTile\(stacks, x, y, z\)\) \} \}\);/);
  for (const f of ["multiplayer/simulation.js", "multiplayer/server-dimensions.js", "multiplayer/server-end.js"]) assert.match(src(f), /if \(result\) swapTiles\(swaps, x, y, z, old, meta, b, m\);/, f);
});

// ---- away run helpers (tiles87-b87.test.js) ----
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x, z, blocks, meta };
});
const setChunkBlock = (chunks, x, y, z, b, m = 0) => {
  const c = chunks.find((k) => k.x === x >> 4 && k.z === z >> 4), i = ((x & 15) * 16 + (z & 15)) * 256 + y;
  c.blocks[i] = b; c.meta[i] = m;
};
const awayRoot = (commands, extra = {}) => ({ seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], player: { time: 6000 },
  redstone: { version: 1, clock: 0, time: 0, pending: commands.map((_, i) => [3 + 2 * i, 11, 3, 137, i + 1, 0, i + 1]), events: [] },
  commandBlocks: commands.map((command, i) => ({ x: 3 + 2 * i, y: 11, z: 3, command, successCount: 0, customName: "@", trackOutput: true, lastOutput: null })), ...extra });
const awayRun = (r, ticks = 20, edit = () => {}) => {
  const cols = stateColumns(r), plan = { ...awayPlan(r, cols, ticks, 2), chunks: floorChunks(cols), records: [] };
  r.commandBlocks.forEach((c) => setChunkBlock(plan.chunks, c.x, c.y, c.z, 139));
  edit(plan.chunks);
  return runAway(plan);
};

test("away run: /setblock trapped_chest over a chest spills the slots once (the hook, then an empty record for the command host)", async () => {
  const chests = { "5,11,9": { items: [{ ...DIAMOND }], facing: 3 } };
  const r = await awayRun(awayRoot(["setblock 5 11 9 minecraft:trapped_chest"], { player: { time: 6000, chests } }), 20, (ch) => setChunkBlock(ch, 5, 11, 9, CHEST));
  const drops = (r.entities?.drops ?? r.drops).map((d) => d.stack ?? d);
  assert.equal(ofId(drops, DIAMOND_ID), 40);
  assert.ok(r.tiles.chests["5,11,9"]?.items.every((s) => !s), "the trapped chest's tile is a new, empty one");
});

// ---- 2. /setblock over a chest or furnace compares the facing (and the lit state) ----

test("/setblock chest over a chest of another facing spills (func_150807_a sees another metadata); the same facing is no change", () => {
  const g = singlePlayer();
  g.world.set(4, 52, 4, CHEST); g.survival.chests["4,52,4"] = { items: [{ ...DIAMOND }], facing: 2 }; // a placed chest facing the player (onBlockPlacedBy)
  assert.equal(g.host.blockAt(4, 52, 4).meta, 2);
  assert.equal(g.run("/setblock 4 52 4 minecraft:chest 2"), false, "same block, same metadata: no change");
  assert.equal(g.spilled.length, 0);
  assert.equal(g.run("/setblock 4 52 4 minecraft:chest"), true, "metadata 0 against 2: breakBlock spills");
  assert.equal(ofId(g.spilled, DIAMOND_ID), 40);
  assert.equal(g.survival.chests["4,52,4"].facing, 3, "onBlockAdded settled the new chest (no opaque side: 3)");
  assert.equal(g.run("/setblock 4 52 4 minecraft:chest 3"), false);
});

test("/setblock furnace: the facing is the cell's metadata, onBlockAdded settles it, and lit_furnace over an unlit furnace is a block change", () => {
  const g = singlePlayer();
  g.world.set(4, 52, 4, FURNACE, true, 5); g.survival.furnaces["4,52,4"] = { items: [null, { ...COAL }, null], burn: 0, burnTotal: 0, cook: 0 };
  assert.deepEqual(g.host.blockAt(4, 52, 4), { id: 61, meta: 5 }, "blockAt reports the placed facing (it read the chest store: always 3)");
  assert.equal(g.run("/setblock 4 52 4 minecraft:furnace 5"), false, "unchanged: no spill");
  assert.equal(g.spilled.length, 0);
  g.world.set(4, 52, 3, STONE);
  assert.equal(g.run("/setblock 4 52 4 minecraft:furnace 5"), false);
  assert.equal(g.run("/setblock 4 52 4 minecraft:furnace 4"), true);
  assert.equal(ofId(g.spilled, COAL_ID), 3, "BlockFurnace.breakBlock (keepInventory false) spilled the fuel");
  assert.equal(g.world.getMeta(4, 52, 4), 3, "func_149930_e: opaque north, open south -> 3, not the command's 4");
  assert.equal(furnaceAddedFacing(g.world, 4, 52, 4), 3);
  g.survival.furnaces["4,52,4"].items[1] = { ...COAL }; g.spilled.length = 0;
  assert.equal(g.run("/setblock 4 52 4 minecraft:lit_furnace 3"), true, "61 -> 62: another block");
  assert.equal(ofId(g.spilled, COAL_ID), 3);
  g.survival.furnaces["4,52,4"] = { items: [null, { ...COAL }, null], burn: 50, burnTotal: 1600, cook: 0 }; g.spilled.length = 0;
  assert.equal(g.run("/setblock 4 52 4 minecraft:lit_furnace 3"), false, "a burning furnace is lit_furnace already");
  assert.equal(g.spilled.length, 0);
  for (const [nx, nz, want] of [[0, 1, 2], [-1, 0, 5], [1, 0, 4]]) {
    const w = new World("tiles89-furnace", "meadow", 1);
    for (let x = 0; x < 9; x++) for (let z = 0; z < 9; z++) w.set(x, 52, z, 0);
    w.set(4 + nx, 52, 4 + nz, STONE);
    assert.equal(furnaceAddedFacing(w, 4, 52, 4), want, `opaque side ${nx},${nz}`);
  }
});

// ---- 3. the server's skylightSubtracted ----

test("server darkness: calculateSkylightSubtracted before the clock's step (Tiles88Probe records); a held clock and the first tick read the current time", () => {
  const world = new World("tiles89-dark");
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) world.put(x, 9, z, 3, 0, false);
  world.spawn = () => ({ x: 8.5, y: 10, z: 8.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: false });
  const clear = reference.records.filter((r) => r[1] === 0 && r[2] === 0 && r[0] < 100000);
  assert.ok(clear.length > 50);
  for (const [t, , , subtracted] of clear) {
    sim.time = t; sim.tick();
    assert.equal(sim.weather.rainStrength(), 0);
    assert.equal(sim.time, t + 1);
    assert.equal(sim.darkness, subtracted, `world time ${t} -> ${t + 1}: WorldServer.tick computed ${subtracted} at ${t}`);
  }
  // The probe's records sit 250 ticks apart, where t and t + 1 agree; the order shows at the ticks where the value steps. The port's formula matches
  // every executed record (tiles88-b88.test.js), so the edges use it: after the tick from t the server must hold the value at t, not at t + 1.
  const at = (t) => skylightSubtracted(celestialAngle(t, 1), 0, 0);
  const edges = [];
  for (let t = 0; t < 24000; t++) if (at(t) !== at(t + 1)) edges.push(t);
  assert.ok(edges.length >= 10, `${edges.length} edge ticks per day`);
  for (const t of edges) {
    sim.time = t; sim.tick();
    assert.equal(sim.darkness, at(t), `edge ${t}: ${at(t)} before the step (the post-step value was ${at(t + 1)})`);
  }
  const fresh = new DedicatedSimulation({}, { world: Object.assign(new World("tiles89-dark2"), { spawn: () => ({ x: 8.5, y: 10, z: 8.5 }) }), mobs: false });
  fresh.time = 13000;
  assert.equal(fresh.darkness, skylightSubtracted(celestialAngle(13000, 1), 0, 0), "before any tick: calculateInitialSkylight at the loaded time");
  sim.gameRules.doDaylightCycle = "false"; sim.time = 12999; sim.tick();
  assert.equal(sim.time, 12999);
  assert.equal(sim.darkness, skylightSubtracted(celestialAngle(12999, 1), sim.weather.rainStrength(), sim.weather.weightedThunder()));
  assert.equal(sim.farming.lightLevel(4, 20, 4), sim.light.level(4, 20, 4, sim.darkness), "farming reads the same value");
});

// ---- 4. a lit/unlit furnace flip keeps the tile in both hosts ----

const smeltable = (() => { for (let id = 1; id < 400; id++) if (smeltingResult({ id, count: 1, damage: 0 })) return id; return null; })();

test("furnace lit/unlit flip (updateFurnaceBlockState keepInventory, then setTileEntity of the old tile): the record and an open screen survive, in both hosts", () => {
  assert.ok(smeltable);
  const sp = new Survival({}, "survival");
  const record = sp.furnace("4,52,4");
  record.items[0] = { id: smeltable, count: 2, damage: 0 }; record.items[1] = { ...COAL };
  const held = heldTiles(sp, "furnace", "4,52,4");
  sp.tickFurnaces();
  assert.ok(record.burn > 0, "lit");
  assert.equal(sp.furnaces["4,52,4"], record);
  assert.equal(tilesReplaced(sp, held), false, "the screen stays open (isUseableByPlayer: the same tile)");
  record.items[0] = null; record.burn = 1; sp.tickFurnaces();
  assert.equal(record.burn, 0, "went out");
  assert.equal(tilesReplaced(sp, held), false);

  const world = new World("tiles89-mpfurnace");
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) { world.put(x, 9, z, 3, 0, false); for (let y = 10; y <= 14; y++) world.put(x, y, z, 0, 0, false); }
  world.spawn = () => ({ x: 8.5, y: 10, z: 8.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: false });
  sim.world.put(4, 10, 4, FURNACE, 2);
  const tile = sim.tiles.furnace("4,10,4");
  tile.items[0] = { id: smeltable, count: 2, damage: 0 }; tile.items[1] = { ...COAL };
  for (let i = 0; i < 3; i++) sim.tick();
  assert.ok(tile.burn > 0 && sim.containers.litFurnaces.has("4,10,4"), "lit on the server");
  assert.equal(sim.tiles.furnaces["4,10,4"], tile, "the same record: no reap, no swap");
  assert.deepEqual([sim.world.get(4, 10, 4), sim.world.getMeta(4, 10, 4)], [FURNACE, 2], "the facing stays (setBlockMetadataWithNotify restores it natively)");
});
