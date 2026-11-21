// Batch 88 tiles88: tile entities after tiles87. Notes: .shared-memory/notes/tiles88-b88-track.md.
//  * Chunk.func_150807_a (apx.a(IIILaji;I)Z, bytecode-read) returns early only when the block and the metadata are both unchanged; on the server it runs the
//    old block's breakBlock for any other change, so a chest <-> trapped chest swap spills the slots (BlockChest.breakBlock, ajx.a) and the new block's
//    tile starts empty, and a sign rewritten with only another metadata starts a fresh, empty TileEntitySign (BlockContainer.breakBlock, ajc.a).
//  * TileEntityDaylightDetector.updateEntity (apa.h) gates on getTotalWorldTime() % 20; BlockDaylightDetector.func_149957_e (akg.e) reads
//    skylightSubtracted (computed by WorldServer.tick before the clock moves) and getCelestialAngleRadians (float). Executed: Tiles88Probe, 728 records.
//  * isUseableByPlayer of every container tile (aow / apg / apb / api / aov / ape .a(yz)Z) tests getTileEntity == this, and EntityPlayer.onUpdate (yz.h)
//    closes the screen when it fails: a /setblock over an open container closes it in single player too.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { replaySensorRecord, sensorSky, celestialRadians, sensorDue } from "./daylight-sensor-time.js";
import { celestialAngle } from "./clock.js";
import { skylightSubtracted } from "./lighting.js";
import { heldTiles, tilesReplaced } from "./container-tiles.js";
import { swapTiles } from "./multiplayer/server-tile-swaps.js";
import { fromOriginal } from "./block-registry.js";
import { populationBlockMapperReady } from "./population-world.js";
import { World, SIGN_POST, WALL_SIGN } from "./world.js";
import { Survival } from "./survival.js";
import { LiveRedstone } from "./redstone-live.js";
import { createCommandHost } from "./command-host.js";
import { createCommandRunner } from "./commands.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { ServerSocial } from "./server-broadcast.js";
import { COMMAND_BLOCK } from "./command-block.js";

await populationBlockMapperReady;
const src = (f) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
const reference = JSON.parse(readFileSync(new URL("../public/research/tiles88-reference.json", import.meta.url), "utf8"));
const internal = (orig) => fromOriginal(orig).id;
const CHEST = internal(54), TRAPPED = internal(146), ENDER = internal(130), FURNACE = internal(61), SENSOR = 151;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const DIAMOND = { id: 264, count: 40, damage: 0 }, COAL = { id: 263, count: 3, damage: 0 };
const total = (stacks) => stacks.reduce((n, s) => n + s.count, 0);
const f = Math.fround;

// ---- 3. the daylight sensor's clock ----

test("Tiles88Probe: every record (world time, weather) is rebuilt by sensorSky + celestialRadians + refreshDaylightSensor", () => {
  assert.equal(reference.records.length, 728);
  for (const r of reference.records) assert.deepEqual(replaySensorRecord(r), r, `t=${r[0]} rain=${r[1]} thunder=${r[2]}`);
  const bits = (v) => { const d = new DataView(new ArrayBuffer(4)); d.setFloat32(0, v); return d.getInt32(0); };
  const oldAngle = reference.records.filter((r) => bits(f(celestialAngle(r[0] + 1, 1) * Math.PI * 2)) !== r[4]).length;
  assert.ok(oldAngle > 100, `the old Math.fround(angle * Math.PI * 2) missed the float products in ${oldAngle} records`);
  const oldSub = reference.records.filter((r) => skylightSubtracted(celestialAngle(r[0] + 1, 1), r[1], f(r[2] * r[1])) !== r[3]).length;
  assert.ok(oldSub > 0, `the server's skylightSubtracted at the moved clock missed ${oldSub} records (WorldServer.tick computes it first)`);
});

test("sensorSky: skylightSubtracted from the clock before this tick's step, unless doDaylightCycle held it; the angle at the new time", () => {
  for (const t of [1, 12000, 13000, 13001, 23999, 24000]) {
    assert.deepEqual(sensorSky(t), { angle: celestialAngle(t, 1), subtracted: skylightSubtracted(celestialAngle(t - 1, 1), 0, 0) });
    assert.deepEqual(sensorSky(t, false, 1, 1), { angle: celestialAngle(t, 1), subtracted: skylightSubtracted(celestialAngle(t, 1), 1, 1) });
  }
  assert.equal(celestialRadians(0.25), f(f(f(0.25) * f(Math.PI)) * 2));
  assert.equal([0, 19, 20, 40, 41, NaN, undefined].map(sensorDue).join(), "true,false,true,true,false,false,false");
});

test("LiveRedstone: a daylight sensor refreshes when the host's total time is a multiple of 20, not on its own tick count", () => {
  const world = new World("tiles88-sensor", "meadow");
  for (let x = 18; x <= 22; x++) for (let z = 18; z <= 22; z++) for (let y = 19; y <= 22; y++) world.put(x, y, z, y === 19 ? 1 : 0, 0, false);
  let total = 7;
  const live = new LiveRedstone(world, { environment: () => ({ sky: 15, skylightSubtracted: 0, celestialAngle: 0, noSky: false }), skyLight: () => 15, totalTime: () => total });
  live.setRaw(20, 20, 20, SENSOR, 0);
  live.scan();
  const seen = [], refresh = live.refreshSensor.bind(live);
  live.refreshSensor = (...a) => { seen.push(total); return refresh(...a); };
  for (let i = 0; i < 45; i++) { total++; live.tick(); }
  assert.deepEqual(seen, [20, 40], "total time 20 and 40 (the host's World.getTotalWorldTime), whatever live.time is");
  assert.equal(live.getBlockMetadata(20, 20, 20), 15, "noon at full sky light");
  const own = new LiveRedstone(world, { environment: () => ({ sky: 15, skylightSubtracted: 0, celestialAngle: 0 }), skyLight: () => 15 });
  own.scan();
  const mine = [];
  const r2 = own.refreshSensor.bind(own);
  own.refreshSensor = (...a) => { mine.push(own.time); return r2(...a); };
  for (let i = 0; i < 41; i++) own.tick();
  assert.ok(mine.length >= 2 && mine.every((t) => t % 20 === 0), "no totalTime hook: LiveRedstone's own count, as before");
});

test("hosts: the server's sensors read sim.ticks and the pre-step skylightSubtracted; single player reads mobs.worldTicks + 2 and survival.time", () => {
  const world = new World("tiles88-env");
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) world.put(x, 9, z, 3, 0, false);
  world.spawn = () => ({ x: 8.5, y: 10, z: 8.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: false });
  sim.ticks = 1234; sim.time = 13000;
  assert.equal(sim.redstone.hooks.totalTime(), 1234);
  const env = sim.redstone.hooks.environment();
  assert.equal(env.skylightSubtracted, skylightSubtracted(celestialAngle(12999, 1), sim.weather.rainStrength(), sim.weather.weightedThunder()));
  assert.equal(env.celestialAngle, celestialRadians(celestialAngle(13000, 1)));
  sim.gameRules.doDaylightCycle = "false";
  assert.equal(sim.redstone.hooks.environment().skylightSubtracted, skylightSubtracted(celestialAngle(13000, 1), sim.weather.rainStrength(), sim.weather.weightedThunder()), "a held clock did not move");
  const main = src("main.js");
  assert.match(main, /subtracted: \(\) => sensorSky\(survival\.time, !survival\.timeFrozen, weather\.rainStrength\(1\), weather\.weightedThunder\(1\)\)\.subtracted,/);
  assert.match(main, /angle: \(\) => sensorSky\(survival\.time\)\.angle,/);
  assert.match(main, /totalTime: \(\) => \(mobs \? \(mobs\.worldTicks \?\? -1\) \+ 2 : undefined\),/, "the beacons' total time (tickBeacons): the mobs' tick runs after tickWorldSystems");
  assert.match(src("redstone-runtime.js"), /celestialAngle: celestialRadians\(game\.angle\?\.\(\) \?\? 0\)/);
  assert.match(src("away-world.js"), /skyAt\(pre \+ step, step === 1, weather\.rainStrength\(1\), weather\.weightedThunder\(1\)\)/, "the away run shares the helper");
});

// ---- 1. chest <-> trapped chest on the server ----

function server() {
  const world = new World("tiles88-chests");
  for (let x = 0; x < 128; x++) for (let z = 0; z < 128; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: "creative", mobs: false, commandBlocks: true });
  const p = s.addPlayer("a", "alicex", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  s.input("a", { type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
  return { s, p };
}
const spilledSince = (s, before, id) => total(s.items.items.slice(before).map((e) => e.stack ?? e).filter((t) => t.id === id));

test("server world edit: a chest becoming a trapped chest (and back) spills its slots, closes the window, and the new block's record starts empty", () => {
  const { s, p } = server();
  s.world.put(64, 11, 62, CHEST, 2); s.tick();
  const record = s.tiles.chests["64,11,62"];
  assert.ok(record, "the reap's ensureChest made the record");
  record.items[0] = { ...DIAMOND }; record.items[5] = { ...COAL };
  p.window = { key: [64, 11, 62], container: { keys: ["64,11,62"] } };
  const closed = [], close = s.containers.close.bind(s.containers);
  s.containers.close = (pl, notify) => { closed.push(pl.id); pl.window = null; return notify; };
  let before = s.items.items.length;
  s.world.put(64, 11, 62, TRAPPED, 2);
  assert.equal(s.tiles.chests["64,11,62"], undefined, "BlockContainer.breakBlock removed the tile");
  assert.equal(spilledSince(s, before, 264), 40); assert.equal(spilledSince(s, before, 263), 3);
  assert.deepEqual(closed, ["a"], "the window on it closed (isUseableByPlayer: getTileEntity != this)");
  s.containers.close = close;
  s.tick();
  const fresh = s.tiles.chests["64,11,62"];
  assert.ok(fresh && fresh !== record && fresh.items.every((it) => !it), "the trapped chest's tile is a new, empty one");
  fresh.items[3] = { ...COAL };
  before = s.items.items.length;
  s.world.put(64, 11, 62, CHEST, 2);
  assert.equal(spilledSince(s, before, 263), 3, "146 -> 54 too");
  s.tick();
  before = s.items.items.length; // after the tick: the spilled pieces may have merged (EntityItem.combineItems)
  s.tiles.chests["64,11,62"].items[0] = { ...DIAMOND };
  s.world.put(64, 11, 62, CHEST, 3);
  assert.equal(s.tiles.chests["64,11,62"]?.items[0]?.id, 264, "a same-id metadata write (BlockChest's facing, setBlockMetadataWithNotify) keeps the tile");
  assert.equal(s.items.items.length, before);
});

test("server /setblock trapped_chest over a chest: one spill of the contents, and a fresh trapped chest record", () => {
  const { s } = server();
  const social = new ServerSocial({ simulation: s, ops: ["alicex"], deliver: () => {} });
  s.world.put(62, 10, 62, CHEST, 0, false);
  s.tiles.chests["62,10,62"] = { items: [{ ...DIAMOND }, { ...COAL }] };
  s.world.put(60, 10, 60, COMMAND_BLOCK, 0, false);
  s.tileEntities.commandBlocks.tile(60, 10, 60).command = "setblock 62 10 62 minecraft:trapped_chest";
  const before = s.items.items.length;
  s.redstone.setBlock(61, 10, 60, 152, 0, 3);
  for (let i = 0; i < 3; i++) { s.tick(); social.drain(); }
  assert.equal(s.tileEntities.commandBlocks.get(60, 10, 60).successCount, 1);
  assert.equal(s.world.get(62, 10, 62), TRAPPED);
  assert.equal(spilledSince(s, before, 264), 40, "the diamonds once (the put wrapper spilled, the command host then found no record)");
  assert.equal(spilledSince(s, before, 263), 3);
  assert.ok(s.tiles.chests["62,10,62"]?.items.every((it) => !it), "the new trapped chest is empty");
});

// ---- 2. meta-only sign rewrite ----

test("server: a sign rewritten with another metadata only starts a fresh, empty, editable tile; an unchanged write keeps it", () => {
  const world = new World("tiles88-signs");
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) { world.put(x, 9, z, 3, 0, false); for (let y = 10; y <= 14; y++) world.put(x, y, z, 0, 0, false); }
  world.spawn = () => ({ x: 8.5, y: 10, z: 8.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: false });
  const signs = sim.tileEntities.signs;
  sim.world.put(5, 10, 5, SIGN_POST, 0); const old = signs.create(5, 10, 5); old.text = ["old", "", "", ""]; old.editable = false;
  sim.world.put(5, 10, 5, SIGN_POST, 0);
  assert.equal(signs.tile(5, 10, 5), old, "block and metadata unchanged: func_150807_a returns before breakBlock");
  sim.world.put(5, 10, 5, SIGN_POST, 4);
  const fresh = signs.tile(5, 10, 5);
  assert.ok(fresh && fresh !== old);
  assert.deepEqual([fresh.text, fresh.editable], [["", "", "", ""], true], "BlockContainer.breakBlock removed the tile; a new TileEntitySign is empty");
  sim.world.put(5, 11, 5, 0); sim.world.put(6, 10, 5, WALL_SIGN, 4); signs.create(6, 10, 5).text = ["wall", "", "", ""];
  sim.world.put(6, 10, 5, WALL_SIGN, 5);
  assert.equal(signs.tile(6, 10, 5)?.text[0], "", "a wall sign's facing too");
});

test("swapTiles: nothing outside the dimension's own swap, nothing for unchanged cells or unrelated blocks", () => {
  const calls = [], ctx = (own) => ({ own: () => own, signs: { remove: (...a) => calls.push(["remove", ...a]), create: (...a) => calls.push(["create", ...a]) }, containers: { swapChest: (...a) => calls.push(["swap", ...a]) } });
  swapTiles(ctx(false), 1, 2, 3, SIGN_POST, 0, SIGN_POST, 4);
  swapTiles(ctx(false), 1, 2, 3, CHEST, 0, TRAPPED, 0);
  swapTiles(ctx(true), 1, 2, 3, SIGN_POST, 4, SIGN_POST, 4);
  swapTiles(ctx(true), 1, 2, 3, SIGN_POST, 4, WALL_SIGN, 2); // the b87 line removes it; the command host or the reap makes the next
  swapTiles(ctx(true), 1, 2, 3, FURNACE, 2, FURNACE, 3);
  swapTiles(ctx(true), 1, 2, 3, CHEST, 0, ENDER, 0); // the reap's job (the ender chest has no slots)
  assert.deepEqual(calls, []);
  swapTiles(ctx(true), 1, 2, 3, SIGN_POST, 0, SIGN_POST, 4);
  swapTiles(ctx(true), 1, 2, 3, TRAPPED, 0, CHEST, 0);
  assert.deepEqual(calls, [["remove", 1, 2, 3], ["create", 1, 2, 3], ["swap", 1, 2, 3]]);
  for (const f of ["multiplayer/simulation.js", "multiplayer/server-dimensions.js", "multiplayer/server-end.js"]) assert.match(src(f), /if \(result\) swapTiles\(swaps, x, y, z, old, meta, b, m\);/, f);
  for (const f of ["multiplayer/server-dimensions.js", "multiplayer/server-end.js"]) assert.match(src(f), /own: \(\) => sim\.world === world/, `${f}: the Nether / End stores only while they are swapped in`);
});

// ---- 4. single player: /setblock over an open container closes the screen ----

function host() {
  const world = new World("tiles88-host", "meadow", 1), survival = new Survival({}, "creative"), spilled = [], closed = [];
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 50; y <= 55; y++) world.set(x, y, z, 0);
  const env = { world: () => world, survival: () => survival, active: () => ({ mode: "creative", allowCommands: true }), position: () => ({ x: 8, y: 52, z: 8 }),
    changed() {}, refreshInventory() {}, stackName: () => "stack", updateBlock() {}, destroyBlock(x, y, z) { world.set(x, y, z, 0); },
    spillTile: (stacks, x, y, z, k) => spilled.push({ stacks, k }), closeTile: (k) => closed.push(k) };
  const h = createCommandHost(env); h.print = () => {};
  const runner = createCommandRunner(h);
  return { world, survival, spilled, closed, run: (s) => runner.run(s) };
}

test("single player: the screen's tile records are held, and a /setblock over the chest, a large chest's half, a furnace or an ender chest replaces them", () => {
  const g = host();
  g.world.set(4, 52, 4, CHEST); g.world.set(5, 52, 4, CHEST);
  g.survival.chests["4,52,4"] = { items: [{ ...DIAMOND }] }; g.survival.chests["5,52,4"] = { items: [] };
  const held = heldTiles(g.survival, "chest", "4,52,4", ["4,52,4", "5,52,4"]);
  assert.equal(held.length, 2);
  assert.equal(tilesReplaced(g.survival, held), false);
  g.run("/setblock 5 52 4 minecraft:trapped_chest");
  assert.equal(g.world.get(5, 52, 4), TRAPPED);
  assert.equal(tilesReplaced(g.survival, held), true, "the other half's new tile: the large chest's isUseableByPlayer fails (InventoryLargeChest asks both)");
  g.world.set(7, 52, 4, FURNACE); g.survival.furnaces["7,52,4"] = { items: [null, { ...COAL }, null], burnTime: 0, cookTime: 0 };
  const furnace = heldTiles(g.survival, "furnace", "7,52,4");
  assert.equal(furnace.length, 1);
  g.run("/setblock 7 52 4 minecraft:dispenser");
  assert.equal(tilesReplaced(g.survival, furnace), true, "the furnace's record went (the furnace screen's own block test only asked the block id of dispensers)");
  g.world.set(9, 52, 4, ENDER); g.survival.enderTiles["9,52,4"] = { users: 1, lid: 1, prevLid: 1 };
  const ender = heldTiles(g.survival, "chest", null, ["9,52,4"]);
  assert.deepEqual(ender.map((t) => t[0]), ["enderTiles"]);
  g.run("/setblock 9 52 4 minecraft:ender_chest 3");
  assert.equal(tilesReplaced(g.survival, ender), true, "BlockContainer.breakBlock removed the old TileEntityEnderChest");
  assert.deepEqual(g.survival.enderTiles["9,52,4"], { users: 0, lid: 0, prevLid: 0 }, "the new one's lid is shut");
  assert.deepEqual(g.closed, ["9,52,4"], "the host closes windows on it (the server's closeAt)");
  assert.deepEqual(heldTiles(g.survival, "crafting", "1,2,3"), [], "no tile, nothing held");
  assert.equal(tilesReplaced(g.survival, undefined), false);
  const main = src("main.js");
  assert.match(main, /if \(!\(multiplayer\?\.ready && active\?\.remote\)\) containerView\.tiles = heldTiles\(survival, kind, key, container\.keys\);/);
  assert.match(main, /if \(containerView\?\.tiles && tilesReplaced\(survival, containerView\.tiles\)\) resume\(\);/);
  assert.match(src("multiplayer/server-worldcmds.js"), /closeTile: \(key\) => sim\.containers\?\.closeAt\?\.\(key\),/);
});
