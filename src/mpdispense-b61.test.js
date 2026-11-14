// Batch 61 (mpdispense): what a dispenser on the dedicated server fires (server-dispense.js) and how the clients see it (client-dispense.js). No sockets.
import test from "node:test";
import assert from "node:assert/strict";
import { World, WATER, TNT } from "./world.js";
import { makeStack } from "./inventory.js";
import { JavaRandom } from "./java-random.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { DedicatedClient } from "./multiplayer/client.js";
import { RemoteDispense } from "./multiplayer/client-dispense.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { ITEM } from "./dispense.js";

globalThis.WebSocket ??= { OPEN: 1 };
const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(gameMode = "survival") {
  const world = new World("mp-dispense-b61");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode, mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  s.containers.ticks.rand = new JavaRandom(7); // the dispenser's Random: aim noise and slot pick
  return s;
}
const join = (s, id, n, x = 70.5, z = 64.5) => { const p = s.addPlayer(id, id + "x", key(n)); p.position.copy({ x, y: 10, z }); p.previous.copy(p.position); s.input(id, input()); return p; };
// A dispenser at (64, y, 62) facing south (+z) with `stack` in slot 0, switched on by a redstone block beside it.
function load(s, stack, { y = 10, facing = 3, x = 64 } = {}) {
  s.world.set(x, y, 62, 115, true, facing);
  s.tiles.dispensers[`${x},${y},62`] = { items: [stack, null, null, null, null, null, null, null, null] };
  s.world.set(x + 1, y, 62, 123);
  return s.tiles.dispensers[`${x},${y},62`];
}
const tile = (s, x = 64, y = 10) => s.tiles.dispensers[`${x},${y},62`]; // an undone dispense swaps in the saved copy: read the tile fresh
// Run n ticks, collecting every dispEnts / dispFx the players were sent (what server.js puts on the wire).
function run(s, n, players = []) {
  const log = new Map(players.map(p => [p, []]));
  for (let i = 0; i < n; i++) { s.tick(); for (const p of players) { log.get(p).push(...(p.dispOut ?? [])); p.dispOut = null; p.itemsOut = null; } }
  return log;
}
const fx = (log, p, k) => log.get(p).filter(m => m.type === "dispFx").flatMap(m => m.events).filter(e => e.k === k);
const ents = (log, p, k) => log.get(p).filter(m => m.type === "dispEnts").flatMap(m => m.ents).filter(e => e.k === k);

test("a dispensed arrow flies on the server, sticks in the ground, reaches nearby players as dispEnts and is skipped for far ones", () => {
  const s = fixture(), p = join(s, "a", 1, 24.5, 64.5), far = join(s, "f", 2, 110.5, 110.5);
  const disp = load(s, makeStack(ITEM.ARROW, 3), { x: 22 });
  const log = run(s, 60, [p, far]);
  assert.equal(tile(s, 22).items[0].count, 2, "one arrow used");
  const seen = ents(log, p, "a");
  assert.ok(seen.length > 5, "a snapshot per tick while it flies and sits");
  assert.equal(seen.at(-1).g, 1, "the last snapshot has it stuck in the ground");
  assert.ok(seen[0].z > 62 && seen[0].z < 66, "it started in front of the dispenser");
  assert.equal(log.get(far).length, 0, "a player beyond 64 blocks hears nothing of it");
  assert.equal(s.dispense.arrows.list.length, 1);
});

test("an arrow hurts a mob it meets", () => {
  const s = fixture(), p = join(s, "a", 1);
  const pig = s.mobs.mobs.create("pig", 64.5, 10, 65.5); s.mobs.mobs.entities.push(pig);
  const before = pig.health;
  load(s, makeStack(ITEM.ARROW, 1));
  run(s, 30, [p]);
  assert.ok(pig.health < before, `the pig took the arrow (${before} -> ${pig.health})`);
});

test("a snowball and an egg fly as balls; a vanished one plays its poof on the client; an egg hatches chicks into the mob list", () => {
  const s = fixture(), p = join(s, "a", 1), chickens = () => s.mobs.mobs.entities.filter(e => e.type === "chicken").length;
  load(s, makeStack(ITEM.EGG, 2));
  for (let i = 0; i < 12 && !s.dispense.balls.balls.length; i++) s.tick(); // the dispenser's 4-tick delay
  assert.equal(s.dispense.balls.balls.length, 1, "the egg is in flight");
  const egg = s.dispense.balls.balls[0];
  egg.rand = { nextInt: () => 0 }; // the 1/8 and 1/32 rolls: one chick, then four
  assert.equal(egg.kind, "egg");
  const rd = new RemoteDispense({ poof: row => poofs.push(row.kind) }), poofs = [];
  const log = run(s, 30, [p]);
  for (const m of log.get(p)) rd.apply(m);
  assert.deepEqual(poofs, ["egg"], "the client copy that vanished plays the poof once");
  assert.equal(chickens(), 4, "nextInt(8) == 0 and nextInt(32) == 0: four chicks");
  assert.equal(s.dispense.balls.balls.length, 0);
});

test("a splash potion of harming hurts a survival player near the impact and sends the glass break; a bottle o' enchanting spawns orbs", () => {
  const s = fixture(), p = join(s, "a", 1, 64.7, 75.5); // the potion lands about 13 blocks south of the dispenser
  s.tick(); p.survival.protection = 0; // the join gives 60 ticks of spawn protection on the first tick
  load(s, makeStack(ITEM.POTION, 1, 16396));
  const health = p.survival.health;
  const log = run(s, 30, [p]);
  assert.ok(p.survival.health < health, `harming hurt the player (${health} -> ${p.survival.health})`);
  const splash = fx(log, p, "splash");
  assert.equal(splash.length, 1); assert.equal(splash[0].damage, 16396);
  assert.equal(s.dispense.potions.projectiles.balls.length, 0);
  const t = fixture(), q = join(t, "b", 1);
  load(t, makeStack(ITEM.EXP_BOTTLE, 1));
  const l2 = run(t, 30, [q]);
  assert.equal(fx(l2, q, "splash").length, 1, "the glass break of the bottle");
  assert.ok(t.serverItems.xp.orbs.length > 0, "3 to 11 experience in orbs at the impact");
});

test("a fire charge launches a small fireball and a firework rocket flies, trails sparks and bursts as dispFx", () => {
  const s = fixture(), p = join(s, "a", 1);
  load(s, makeStack(ITEM.FIRE_CHARGE, 1));
  const log = run(s, 8, [p]);
  const b = ents(log, p, "b").at(-1);
  assert.equal(b.kind, "smallFireball"); assert.equal(b.scale, 0.5);
  const t = fixture(), q = join(t, "b", 1);
  load(t, { id: ITEM.FIREWORK, count: 1, damage: 0 });
  const l2 = run(t, 120, [q]);
  assert.ok(ents(l2, q, "r").length > 5, "the rocket is listed while it flies");
  assert.ok(fx(l2, q, "sound").some(e => e.name === "fireworks.launch"));
  assert.ok(fx(l2, q, "spark").length > 3, "the trail");
  assert.equal(fx(l2, q, "firework").length, 1, "one burst (World.makeFireworks)");
  assert.equal(t.dispense.rockets.rockets.length, 0);
});

test("dispensed TNT is primed, ticks its fuse for clients, then explodes: blocks go, the player is hurt, clients get the burst", () => {
  const s = fixture(), p = join(s, "a", 1, 64.5, 66.5);
  load(s, makeStack(ITEM.TNT, 1));
  const floor = [[64, 9, 63], [64, 9, 64], [65, 9, 64], [63, 9, 64]];
  const health = p.survival.health;
  const log = run(s, 90, [p]);
  const t = ents(log, p, "t");
  assert.ok(t.length >= 70 && t[0].fuse >= 78, "the fuse counts down on the wire");
  assert.equal(fx(log, p, "explode").length, 1);
  assert.equal(fx(log, p, "explode")[0].size, 4);
  assert.ok(floor.some(([x, y, z]) => s.world.get(x, y, z) === 0), "dirt under the blast is gone");
  assert.ok(p.survival.health < health, "the explosion hurt the survival player");
  assert.equal(s.dispense.primed.length, 0);
});

test("flint and steel on a TNT block primes it with the ignite sound; a powered dropper of TNT still works", () => {
  const s = fixture(), p = join(s, "a", 1);
  s.world.set(64, 10, 63, TNT);
  const disp = load(s, makeStack(ITEM.FLINT_AND_STEEL, 1));
  const log = run(s, 8, [p]);
  assert.equal(s.world.get(64, 10, 63), 0, "the block is gone");
  assert.equal(s.dispense.primed.length, 1);
  assert.ok(fx(log, p, "sound").some(e => e.name === "game.tnt.primed"));
  assert.equal(tile(s).items[0].damage ?? 0, 0, "BehaviorDispenseFlintAndSteel damages the tool only when it makes fire");
});

test("a water bucket in the dispenser places water in front (existing engine, still reaching the clients)", () => {
  const s = fixture(), p = join(s, "a", 1);
  const disp = load(s, makeStack(ITEM.WATER_BUCKET, 1));
  run(s, 8, [p]);
  assert.equal(s.world.get(64, 10, 63), WATER);
  assert.equal(tile(s).items[0].id, ITEM.BUCKET);
});

test("a spawn egg adds a mob through ServerMobs, a villager too (b66)", () => {
  const s = fixture(), p = join(s, "a", 1);
  const disp = load(s, makeStack(ITEM.SPAWN_EGG, 2, 90)); // pig
  run(s, 8, [p]);
  assert.equal(s.mobs.mobs.entities.filter(e => e.type === "pig").length, 1);
  assert.equal(tile(s).items[0].count, 1);
  const v = fixture(), r = join(v, "c", 1); load(v, makeStack(ITEM.SPAWN_EGG, 2, 120)); // b66: villagers are server kinds now (mpvillage)
  run(v, 8, [r]);
  assert.equal(v.mobs.mobs.entities.filter(e => e.type === "villager").length, 1);
  // b66: every 1.7.10 spawn-egg kind is a server kind now; the giant, the one left out, has no egg (EntityList.entityEggs), so no egg is kept back any more.
});

test("armour dispensed at a player in front is worn (invSet), not dropped; one already wearing a helmet gets the item thrown", () => {
  const s = fixture(), p = join(s, "a", 1, 64.5, 63.5);
  load(s, makeStack(400, 2), { y: 10 }); // leather cap
  const sent = [];
  s.serverItems.inv.win(p); // a client always has its inventory window state; invSet diffs run against it
  for (let i = 0; i < 8; i++) { s.tick(); sent.push(...(p.itemsOut ?? [])); p.itemsOut = null; }
  assert.equal(p.survival.inventory.armor[3]?.id, 400, "the helmet slot holds the cap");
  const set = sent.find(m => m.type === "invSet" && m.armor);
  assert.ok(set && set.armor[0].i === 3 && set.armor[0].stack.id === 400, "the client is told through invSet (armour slot 3, the helmet)");
  assert.equal(tile(s).items[0].count, 1);
  assert.equal(s.items.items.filter(e => !e.dead).length, 0, "nothing was thrown");
  s.world.set(65, 10, 62, 0); s.tick(); s.world.set(65, 10, 62, 123); // the pulse again
  run(s, 8, [p]);
  assert.equal(p.survival.inventory.armor[3].count, 1);
  assert.equal(tile(s).items[0]?.count ?? 0, 0, "second cap is thrown as an item");
  assert.equal(s.items.items.filter(e => !e.dead).length, 1);
});

test("boats and minecarts: no vehicle track keeps the stack; with its hook the boat is spawned onto water at the native spot", () => {
  const s = fixture(), p = join(s, "a", 1);
  s.dispense.vehicles = null; // b61 lead: the simulation now wires the vehicle track; drop it to check the fallback
  s.world.set(64, 10, 63, WATER);
  const disp = load(s, makeStack(ITEM.BOAT, 1));
  run(s, 8, [p]);
  assert.equal(tile(s).items[0].count, 1, "no vehicles hook: the dispense is undone");
  const t = fixture(), q = join(t, "b", 1), made = [];
  t.dispense.vehicles = { dispenseBoat: (x, y, z) => { made.push([x, y, z]); return true; }, dispenseCart: () => false };
  t.world.set(64, 10, 63, WATER);
  const d2 = load(t, makeStack(ITEM.BOAT, 2));
  run(t, 8, [q]);
  assert.equal(tile(t).items[0].count, 1);
  assert.deepEqual(made, [[64.5, 10.5 + 1, 62.5 + 1.125]], "(x + 0.5, y + 0.5 + 1 over water, z + 0.5 + 1.125)");
});

test("RemoteDispense keeps one row per entity, moves px to the old x, drops the unnamed and plays only known sounds", () => {
  const sounds = [], bursts = [], splashes = [];
  const rd = new RemoteDispense({ sound: (...a) => sounds.push(a[0]), explode: (...a) => bursts.push(a), splash: (...a) => splashes.push(a) });
  rd.apply({ type: "dispEnts", ents: [{ k: "t", i: 1, x: 1, y: 2, z: 3, fuse: 80 }, { k: "b", i: 2, kind: "potion", x: 0, y: 0, z: 0, damage: 16396 }] });
  const row = rd.primed[0];
  rd.apply({ type: "dispEnts", ents: [{ k: "t", i: 1, x: 2, y: 2, z: 3, fuse: 79 }] });
  assert.equal(rd.primed[0], row, "same object");
  assert.deepEqual([row.px, row.x, row.fuse], [1, 2, 79]);
  assert.equal(rd.balls.length, 0);
  rd.apply({ type: "dispFx", events: [{ k: "sound", name: "game.tnt.primed", x: 0, y: 0, z: 0 }, { k: "sound", name: "mob.wither.spawn", x: 0, y: 0, z: 0 }, { k: "explode", x: 1, y: 2, z: 3, size: 4 }, { k: "splash", x: 1, y: 2, z: 3, damage: 16396 }] });
  assert.deepEqual(sounds, ["game.tnt.primed", "game.potion.smash"]);
  assert.deepEqual(bursts, [[1, 2, 3, 4]]);
  assert.deepEqual(splashes, [[1, 2, 3, 16396]]);
});

test("DedicatedClient routes dispEnts and dispFx to onDisp, also those that arrive before start()", () => {
  const got = [], c = new DedicatedClient({ onDisp: m => got.push(m.type) });
  c.buffer({ type: "dispEnts", ents: [] }); c.buffer({ type: "dispFx", events: [] });
  assert.deepEqual(got, []);
  c.start();
  assert.deepEqual(got, ["dispEnts", "dispFx"]);
  c.apply({ type: "dispEnts", ents: [] });
  assert.deepEqual(got, ["dispEnts", "dispFx", "dispEnts"]);
});

test("one empty snapshot clears the client after the last entity is gone, then the player hears nothing more", () => {
  const s = fixture(), p = join(s, "a", 1);
  load(s, makeStack(ITEM.SNOWBALL, 1));
  const log = run(s, 40, [p]);
  const lists = log.get(p).filter(m => m.type === "dispEnts");
  assert.ok(lists.length >= 2 && lists.at(-1).ents.length === 0, "the final list is empty");
  const n = log.get(p).length;
  const more = run(s, 5, [p]);
  assert.equal(more.get(p).length, 0, `no traffic after the clear (${n} before)`);
});

test("b61 lead: the simulation wires dispensed boats and carts to the vehicle track (server-vehicles.js)", () => {
  const s = fixture(), p = join(s, "a", 1);
  s.world.set(64, 10, 63, WATER);
  load(s, makeStack(ITEM.BOAT, 2));
  run(s, 8, [p]);
  assert.equal(tile(s).items[0].count, 1, "one boat spent");
  const boats = s.vehicles.boats.carts.filter(b => !b.dead);
  assert.equal(boats.length, 1);
  assert.ok(Math.abs(boats[0].x - 64.5) < 0.5 && boats[0].z > 62.5 && boats[0].z < 64.2, "in front of the dispenser, on the water (it has drifted since the spawn; the spawn spot is pinned above)");
  assert.equal(s.dispense.vehicles.dispenseCart(1, 64.5, 10.5, 62.5), true, "b62: a chest cart is a server entity now");
  assert.equal(s.dispense.vehicles.dispenseCart(6, 64.5, 10.5, 62.5), false, "the command block cart is still not connected: the stack is kept");
});
