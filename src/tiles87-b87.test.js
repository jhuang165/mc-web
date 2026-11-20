// Batch 87 tiles87: tile entities after awaystore86. Notes: .shared-memory/notes/tiles87-b87-track.md.
//  * TileEntityBeacon.updateEntity checks `World.getTotalWorldTime() % 80` (aoq.h -> ahb.I, bytecode-read), not the world time: /time set moves no beacon.
//  * Chunk.func_150807_a runs the old block's breakBlock on any id change, so a standing <-> wall sign swap starts a fresh TileEntitySign (server put wrapper, main.js onChange).
//  * CommandSetBlock (bm) clears no tile itself: World.setBlock (flags 3) runs breakBlock, and BlockChest / BlockFurnace / BlockDispenser / BlockHopper / BlockBrewingStand
//    spill their slots (ajx, aln, bytecode-read). Live, server and away hosts get the spill through command-host.js env.spillTile.
//  * The away run's daylight sensors refresh every 20 total ticks (apa.h) from the world's sky light, skylightSubtracted and celestial angle (akg.e) while the gate is open.
//  * The away run carries the saved spawner list, so a spawner it replaces leaves it and a /setblock spawner joins it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";
import { AWAY_ENTITY_TICKS } from "./away-plan.js";
import { fromOriginal } from "./block-registry.js";
import { World, SIGN_POST, WALL_SIGN, MOB_SPAWNER } from "./world.js";
import { Survival } from "./survival.js";
import { createCommandHost } from "./command-host.js";
import { createCommandRunner } from "./commands.js";
import { BEACON } from "./pyramid.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { ServerSocial } from "./server-broadcast.js";
import { COMMAND_BLOCK } from "./command-block.js";

await populationBlockMapperReady;
const src = (f) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
const internal = (orig) => fromOriginal(orig).id;
const CHEST = internal(54), FURNACE = internal(61), DISPENSER = internal(23), HOPPER = internal(154), BREWING = internal(117);
const SENSOR = internal(151), STONE = 3, AWAY_COMMAND_BLOCK = 139;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const DIAMOND = { id: 264, count: 40, damage: 0 }, COAL = { id: 263, count: 3, damage: 0 };
const total = (stacks) => stacks.reduce((n, s) => n + s.count, 0);

// ---- away run helpers (awaystore86-b86.test.js) ----
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x, z, blocks, meta };
});
const setBlock = (chunks, x, y, z, b, m = 0) => {
  const c = chunks.find((k) => k.x === x >> 4 && k.z === z >> 4), i = ((x & 15) * 16 + (z & 15)) * 256 + y;
  c.blocks[i] = b; c.meta[i] = m;
};
const root = (commands, extra = {}) => ({ seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], player: { time: 6000 },
  redstone: { version: 1, clock: 0, time: 0, pending: commands.map((_, i) => [3 + 2 * i, 11, 3, 137, i + 1, 0, i + 1]), events: [] },
  commandBlocks: commands.map((command, i) => ({ x: 3 + 2 * i, y: 11, z: 3, command, successCount: 0, customName: "@", trackOutput: true, lastOutput: null })), ...extra });
const run = (r, ticks = 20, edit = () => {}) => {
  const cols = stateColumns(r), plan = { ...awayPlan(r, cols, ticks, 2), chunks: floorChunks(cols), records: [] };
  r.commandBlocks.forEach((c) => setBlock(plan.chunks, c.x, c.y, c.z, AWAY_COMMAND_BLOCK));
  edit(plan.chunks);
  return runAway(plan);
};
const dropped = (r, id) => (r.entities?.drops ?? r.drops).map((d) => d.stack ?? d).filter((s) => s.id === id);

test("server beacon: the pyramid check runs on total time (sim.ticks) % 80, and /time set does not move it", () => {
  const world = new World("tiles87-beacon");
  for (let x = 40; x <= 88; x++) for (let z = 40; z <= 88; z++) { world.put(x, 9, z, 3, 0, false); for (let y = 10; y <= 40; y++) world.put(x, y, z, 0, 0, false); }
  for (let x = 63; x <= 65; x++) for (let z = 63; z <= 65; z++) world.put(x, 19, z, 26, 0, false);
  world.put(64, 20, 64, BEACON, 0, false);
  world.spawn = () => ({ x: 60.5, y: 10, z: 60.5 });
  const sim = new DedicatedSimulation({}, { world });
  const tile = sim.tileEntities.beacons.ensure(64, 20, 64); tile.primary = 1;
  const p = sim.addPlayer("near", "Near", key(1)); p.position.copy({ x: 70.5, y: 20, z: 64.5 }); p.previous.copy(p.position);
  sim.ticks = 100; sim.time = 79; sim.tick();
  assert.equal(p.effectsOut ?? null, null, "world time 80 with total time 101: no check");
  sim.ticks = 159; sim.time = 5; sim.tick();
  assert.deepEqual(p.effectsOut?.map((e) => e.id), [1], "total time 160 with world time 6: the check and the grant");
  assert.match(src("main.js"), /tickBeacons\(beacons, \{ world, time: \(mobs\?\.worldTicks \?\? -1\) \+ 2,/, "single player: the total time the beacon's tick sees (mobs.worldTicks runs after tickSurvival)");
  assert.match(src("multiplayer/server-nether.js"), /tickBeacons\(n\.tileEntities\.beacons, \{ world: w, time: sim\.ticks/, "the Nether: DerivedWorldInfo reads the Overworld's total time");
});

test("server: a standing <-> wall sign swap starts a fresh tile; a same-id write keeps it", () => {
  const world = new World("tiles87-signs");
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) { world.put(x, 9, z, 3, 0, false); for (let y = 10; y <= 14; y++) world.put(x, y, z, 0, 0, false); }
  world.spawn = () => ({ x: 8.5, y: 10, z: 8.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: false });
  const signs = sim.tileEntities.signs;
  sim.world.put(5, 10, 5, SIGN_POST, 0); signs.create(5, 10, 5).text = ["old", "", "", ""];
  sim.world.put(5, 10, 5, SIGN_POST, 4);
  assert.equal(signs.tile(5, 10, 5)?.text[0], "old", "the server put wrapper only clears on an id change (a same-id metadata write is BlockSign's own path)");
  sim.world.put(5, 10, 5, WALL_SIGN, 2);
  assert.equal(signs.tile(5, 10, 5), null, "Chunk.func_150807_a: BlockSign.breakBlock on 63 -> 68, so the wall sign gets a fresh TileEntitySign");
  signs.create(5, 10, 5).text = ["wall", "", "", ""];
  sim.world.put(5, 10, 5, SIGN_POST, 0);
  assert.equal(signs.tile(5, 10, 5), null, "68 -> 63 too");
  assert.match(src("main.js"), /isSign\(old\) && old !== now\) signs\.remove\(x, y, z\)/, "single player's onChange removes the old sign's tile on any id change");
  for (const f of ["multiplayer/server-dimensions.js", "multiplayer/server-end.js"]) assert.match(src(f), /old !== b && isSign\(old\)\) n\.tileEntities\?\.signs\.remove\(x, y, z\)/, f);
});

function host() {
  const world = new World("tiles87-host", "meadow", 1), survival = new Survival({}, "creative"), spilled = [];
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 50; y <= 55; y++) world.set(x, y, z, 0);
  const env = { world: () => world, survival: () => survival, active: () => ({ mode: "creative", allowCommands: true }), position: () => ({ x: 8, y: 52, z: 8 }),
    changed() {}, refreshInventory() {}, stackName: () => "stack", updateBlock() {}, destroyBlock(x, y, z) { world.set(x, y, z, 0); },
    spillTile: (stacks, x, y, z, k) => spilled.push({ stacks, at: [x, y, z], key: k }) };
  const h = createCommandHost(env); h.print = () => {};
  const runner = createCommandRunner(h);
  return { world, survival, spilled, run: (s) => runner.run(s) };
}

test("command-host /setblock: each container's slots go to env.spillTile, the tile record goes, and the table's name spills nothing", () => {
  const cases = [["chests", CHEST], ["furnaces", FURNACE], ["dispensers", DISPENSER], ["hoppers", HOPPER], ["brewing", BREWING]];
  for (const [store, block] of cases) {
    const g = host();
    g.world.set(4, 52, 4, block);
    g.survival[store]["4,52,4"] = { items: [{ ...DIAMOND }, null, { ...COAL }] };
    g.run("/setblock 4 52 4 minecraft:stone");
    assert.equal(g.survival[store]["4,52,4"], undefined, store);
    assert.equal(g.spilled.length, 1, `${store}: one spill`);
    assert.deepEqual(g.spilled[0].stacks.map((s) => [s.id, s.count]), [[264, 40], [263, 3]], `${store}: the non-null slots, in slot order`);
    assert.deepEqual(g.spilled[0].at, [4, 52, 4]);
    assert.equal(g.spilled[0].key, "4,52,4", "the key lets the server close open windows");
  }
  const g = host();
  g.survival.tableNames["4,52,4"] = "Named";
  g.run("/setblock 4 52 4 minecraft:stone");
  assert.equal(g.spilled.length, 0);
  assert.match(src("main.js"), /spillTile: \(stacks, x, y, z\) => items\.spill\(stacks\.map\(copyStack\), x, y, z\)/, "single player spills through ItemEntities.spill");
});

test("server /setblock over a chest: the contents become item entities (ItemEntities.spill), and the chest's record goes", () => {
  const world = new World("tiles87-mpcmd");
  for (let x = 0; x < 128; x++) for (let z = 0; z < 128; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "creative", mobs: false, commandBlocks: true });
  const social = new ServerSocial({ simulation: s, ops: ["alicex"], deliver: () => {} });
  const p = s.addPlayer("a", "alicex", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  s.input("a", { type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
  s.world.put(62, 10, 62, CHEST, 0, false);
  s.tiles.chests["62,10,62"] = { items: [{ ...DIAMOND }, { ...COAL }] };
  s.world.put(60, 10, 60, COMMAND_BLOCK, 0, false);
  s.tileEntities.commandBlocks.tile(60, 10, 60).command = "setblock 62 10 62 minecraft:stone";
  const before = s.items.items.length;
  s.redstone.setBlock(61, 10, 60, 152, 0, 3);
  for (let i = 0; i < 3; i++) { s.tick(); social.drain(); }
  assert.equal(s.tileEntities.commandBlocks.get(60, 10, 60).successCount, 1);
  assert.equal(s.tiles.chests["62,10,62"], undefined);
  const items = s.items.items.slice(before).map((e) => e.stack ?? e);
  assert.equal(total(items.filter((t) => t.id === 264)), 40, "BlockChest.breakBlock: every diamond comes out (b86 deleted the record first, so none did)");
  assert.equal(total(items.filter((t) => t.id === 263)), 3);
});

test("away run /setblock over a chest or a furnace spills its slots (dropped items when the entity run is off, or entities)", async () => {
  const chests = { "5,11,9": { items: [{ ...DIAMOND }] } }, furnaces = { "7,11,9": { items: [null, { ...COAL }, null], burnTime: 0, cookTime: 0 } };
  const r = await run(root(["setblock 5 11 9 minecraft:stone", "setblock 7 11 9 minecraft:stone"], { player: { time: 6000, chests, furnaces } }), 20,
    (ch) => { setBlock(ch, 5, 11, 9, CHEST); setBlock(ch, 7, 11, 9, FURNACE); });
  assert.equal(total(dropped(r, 264)), 40, "the chest's diamonds");
  assert.equal(total(dropped(r, 263)), 3, "the furnace's fuel slot");
  assert.equal(r.tiles.chests["5,11,9"], undefined);
  assert.equal(r.tiles.furnaces["7,11,9"], undefined);
});

// One daylight sensor (meta 7) at (5, 11, 9) in a run kept going by a pending command block tick near its end.
const sensorRun = async (time, ticks, gameRules) => {
  const r = { ...root([]), player: { time }, ...(gameRules ? { gameRules } : {}),
    redstone: { version: 1, clock: 0, time: 0, pending: [[3, 11, 3, 137, ticks - 5, 0, 1]], events: [] },
    commandBlocks: [{ x: 3, y: 11, z: 3, command: "say hi", successCount: 0, customName: "@", trackOutput: true, lastOutput: null }] };
  const out = await run(r, ticks, (ch) => setBlock(ch, 5, 11, 9, SENSOR, 7));
  const col = out.columns.find((c) => c.x === 0 && c.z === 0), v = col?.values?.[Object.keys(col.values).find((k) => (col.values[k] & 255) === SENSOR)];
  return v === undefined ? null : v >> 8;
};

test("away daylight sensor: the world's sky light and time set its power (BlockDaylightDetector.func_149957_e), not the departure value", async () => {
  assert.equal(await sensorRun(6000, 100), 15, "noon: full sky light");
  assert.equal(await sensorRun(18000, 100), 0, "midnight");
  const dusk = await sensorRun(13000, 100);
  assert.ok(dusk > 0 && dusk < 7, `dusk reads between (${dusk})`);
});

test("away daylight sensor: doDaylightCycle false holds the clock; nothing refreshes after the gate", async () => {
  assert.equal(await sensorRun(18000, 6000, { doDaylightCycle: "false" }), 0, "the clock stays at the saved 18000");
  const cycling = await sensorRun(18000, 6000);
  assert.equal(cycling, await sensorRun(18000 - 6000 + AWAY_ENTITY_TICKS, 100), "with the cycle the last refresh is at the gate (world time 13200), not at the trip's end");
  assert.notEqual(cycling, 0);
});

test("away spawners: one the run replaces leaves the saved list, a /setblock spawner joins it, and a world without the list gets none", async () => {
  const spawners = [{ x: 5, y: 11, z: 9, EntityId: "Pig" }, { x: 7, y: 11, z: 9, EntityId: "Zombie" }];
  const r = await run(root(["setblock 5 11 9 minecraft:stone", "setblock 9 11 9 minecraft:mob_spawner 0 replace {EntityId:Skeleton}"], { spawners }), 20,
    (ch) => { setBlock(ch, 5, 11, 9, MOB_SPAWNER); setBlock(ch, 7, 11, 9, MOB_SPAWNER); });
  assert.deepEqual(r.spawners.map((s) => [s.x, s.EntityId]).sort((a, b) => a[0] - b[0]), [[7, "Zombie"], [9, "Skeleton"]]);
  const none = await run(root(["setblock 5 11 9 minecraft:stone"]), 20, (ch) => setBlock(ch, 5, 11, 9, MOB_SPAWNER));
  assert.equal("spawners" in none, false, "no saved list: structure-simulation.js reads a missing list as a fresh world");
  const emptied = await run(root(["setblock 5 11 9 minecraft:stone"], { spawners: [spawners[0]] }), 20, (ch) => setBlock(ch, 5, 11, 9, MOB_SPAWNER));
  assert.deepEqual(emptied.spawners, [], "an emptied list stays a list");
  assert.match(src("dimension-live.js"), /if \(Array\.isArray\(r\.spawners\) && Array\.isArray\(root\.spawners\)\) root\.spawners = r\.spawners;/, "the write-back");
});
