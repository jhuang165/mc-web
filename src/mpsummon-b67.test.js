// Batch 67 mpsummon: /summon on the dedicated server (server-summon.js), the spawner status ranges (server-spawners.js) and the revenge target of the kill credit
// (server-combat-tracker.js). Native facts (bytecode-read, see .shared-memory/notes/mpsummon-b67-track.md): CommandSummon level 2, EntityTracker table, sv.C clears a dead revenge target.
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ServerSocial, chatDisplay } from "./server-broadcast.js";
import { langReady } from "./chat-component.js";
import { sendSpawnerFx, mobTrackRange } from "./multiplayer/server-spawners.js";
import { KillCredit } from "./multiplayer/server-combat-tracker.js";

await langReady;

const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
function fixture(ops = ["Alex"]) {
  const world = new World("b67-summon");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true }), inbox = {};
  sim.mobs.mobs.entities.length = 0; // the opening animals of a fresh finite world
  const social = new ServerSocial({ simulation: sim, ops, deliver: (id, m) => (inbox[id] ??= []).push(m) });
  const join = (id, name, n) => { const p = sim.addPlayer(id, name, key(n)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); return p; };
  const say = (id, line) => { inbox[id] = []; social.command(id, line); return (inbox[id] ?? []).filter((m) => m.type === "chat").map((m) => chatDisplay(m).unformatted()); };
  return { sim, social, join, say };
}
const OK = "Object successfully summoned", FAILED = "Unable to summon object";

test("/summon is an operator command: a plain player gets the permission message", () => {
  const f = fixture(["Alex"]); f.join("a", "Alex", 1); f.join("b", "Bob", 2);
  assert.match(f.say("b", "/summon Pig")[0], /permission/);
  assert.equal(f.sim.mobs.mobs.entities.filter((e) => e.type === "pig").length, 0);
});

test("/summon Pig spawns a server mob at the sender, with relative and absolute coordinates, and answers with the native texts", () => {
  const f = fixture(); f.join("a", "Alex", 1);
  const pigs = () => f.sim.mobs.mobs.entities.filter((e) => e.type === "pig");
  assert.deepEqual(f.say("a", "/summon Pig"), [OK]);
  assert.equal(pigs().length, 1);
  assert.deepEqual([pigs()[0].x, pigs()[0].z], [64.5, 64.5]);
  assert.deepEqual(f.say("a", "/summon Pig ~3 ~1 ~-2"), [OK]);
  assert.deepEqual([pigs()[1].x, pigs()[1].y, pigs()[1].z], [67.5, 11, 62.5]);
  assert.deepEqual(f.say("a", "/summon Cow 50 12 51"), [OK]);
  assert.deepEqual(f.sim.mobs.mobs.entities.filter((e) => e.type === "cow").map((e) => [e.x, e.y, e.z]), [[50.5, 12.5, 51.5]]);
  assert.match(f.say("a", "/summon")[0], /summon <EntityName>/);
  assert.match(f.say("a", "/summon Pig 1000 12 51")[0], /out of the world|Cannot summon/i);
  assert.deepEqual(f.say("a", "/summon NoSuchThing"), [FAILED]);
});

test("a data tag is merged (Health, CustomName), and a Riding chain seats the mob on its mount", () => {
  const f = fixture(); f.join("a", "Alex", 1);
  assert.deepEqual(f.say("a", '/summon Zombie ~ ~ ~ {Health:7,CustomName:"Bob"}'), [OK]);
  const z = f.sim.mobs.mobs.entities.find((e) => e.type === "zombie");
  assert.equal(z.health, 7);
  assert.equal(z.customName, "Bob");
  assert.deepEqual(f.say("a", "/summon Chicken ~ ~ ~ {Riding:{id:Pig}}"), [OK]);
  const pig = f.sim.mobs.mobs.entities.find((e) => e.type === "pig"), chicken = f.sim.mobs.mobs.entities.find((e) => e.type === "chicken");
  assert.ok(pig && chicken);
  assert.equal(chicken.ridingEntity, pig);
  // a chain whose mount cannot be made ends the chain: the rider stays, the command still succeeds (CommandSummon)
  assert.deepEqual(f.say("a", "/summon Chicken ~ ~ ~ {Riding:{id:Giant}}"), [OK]);
});

test("onSpawnWithEgg runs only without a tag: a bare zombie may roll gear or a jockey, a tagged one is exactly its tag", () => {
  const f = fixture(); f.join("a", "Alex", 1);
  const w = f.sim.mobs.mobs;
  let calls = 0; const orig = w.onSpawnWithEgg.bind(w); w.onSpawnWithEgg = (...a) => { calls++; return orig(...a); };
  f.say("a", "/summon Zombie");
  assert.equal(calls, 1);
  f.say("a", "/summon Zombie ~ ~ ~ {Health:3}");
  assert.equal(calls, 1);
});

test("a kind the server cannot keep (the giant) gives the failure message", () => {
  const f = fixture(); f.join("a", "Alex", 1);
  assert.deepEqual(f.say("a", "/summon Giant"), [FAILED]);
  assert.deepEqual(f.say("a", "/summon Painting"), [OK]); // b68 mppaintings: kept by server-hanging.js
  assert.deepEqual(f.say("a", "/summon ItemFrame"), [OK]);
  assert.equal(f.sim.mobs.mobs.entities.some((e) => e.type === "giant"), false);
});

test("vehicles go to the server's vehicles: minecarts of every type (spawner and command block included) and a boat", () => {
  const f = fixture(); f.join("a", "Alex", 1);
  const v = f.sim.vehicles;
  assert.deepEqual(f.say("a", "/summon MinecartRideable"), [OK]);
  assert.deepEqual(f.say("a", "/summon MinecartChest ~2 ~ ~"), [OK]);
  assert.deepEqual(f.say("a", '/summon MinecartSpawner ~4 ~ ~ {EntityId:Zombie,Delay:5}'), [OK]);
  assert.deepEqual(f.say("a", "/summon Boat ~ ~ ~4"), [OK]);
  const types = v.carts.carts.map((c) => c.type).sort();
  assert.deepEqual(types, [0, 1, 4]);
  assert.equal(v.boats.carts.length, 1);
  const spawner = v.carts.carts.find((c) => c.type === 4);
  assert.equal(spawner.spawner.entityId, "Zombie");
  assert.equal(spawner.spawner.delay, 5);
  f.sim.tick();
  assert.ok(f.sim.vehicles.all.every((c) => !c.dead));
});

test("a mob riding a summoned minecart is seated in it", () => {
  const f = fixture(); f.join("a", "Alex", 1);
  assert.deepEqual(f.say("a", "/summon Pig ~ ~ ~ {Riding:{id:MinecartRideable}}"), [OK]);
  const cart = f.sim.vehicles.carts.carts[0], pig = f.sim.mobs.mobs.entities.find((e) => e.type === "pig");
  assert.ok(cart && pig);
  assert.equal(cart.passenger, pig);
  assert.equal(pig.ridingEntity, cart);
});

test("projectiles, TNT, falling blocks, items and orbs go to their server systems", () => {
  const f = fixture(); f.join("a", "Alex", 1);
  const d = f.sim.dispense;
  assert.deepEqual(f.say("a", "/summon PrimedTnt ~ ~3 ~ {Fuse:50}"), [OK]);
  assert.equal(d.primed.length, 1);
  assert.equal(d.primed[0].fuse, 50);
  assert.deepEqual(f.say("a", "/summon Arrow ~ ~3 ~ {Motion:[0.0,0.0,0.5]}"), [OK]);
  assert.equal(d.arrows.list.length, 1);
  assert.deepEqual(f.say("a", "/summon Snowball ~ ~3 ~ {Motion:[0.0,0.1,0.5]}"), [OK]);
  assert.equal(d.balls.balls.length, 1);
  assert.deepEqual(f.say("a", "/summon ThrownPotion ~ ~3 ~ {Potion:{id:373,Damage:16396,Count:1}}"), [OK]);
  assert.equal(d.potionsOf(d).projectiles.balls.length >= 1, true);
  assert.deepEqual(f.say("a", "/summon FallingSand ~ ~5 ~ {Tile:12}"), [OK]);
  assert.equal(f.sim.falling.entities.length >= 1, true);
  assert.deepEqual(f.say("a", "/summon Item ~ ~2 ~ {Item:{id:264,Count:3,Damage:0}}"), [OK]);
  assert.equal(f.sim.items.items.length, 1);
  assert.equal(f.sim.items.items[0].eid > 0, true);
  assert.deepEqual(f.say("a", "/summon XPOrb ~ ~2 ~ {Value:7}"), [OK]);
  const orbs = f.sim.serverItems.xp.orbs;
  assert.equal(orbs.length, 1);
  assert.equal(orbs[0].value, 7);
  assert.deepEqual(f.say("a", "/summon FireworksRocketEntity ~ ~2 ~ {LifeTime:30}"), [OK]);
  assert.equal(d.rockets.rockets.length, 1);
});

test("a summoned Arrow keeps an existing arrow's owner (adopt does not reload the list)", () => {
  const f = fixture(); f.join("a", "Alex", 1);
  const d = f.sim.dispense, owner = f.sim.players.get("a");
  f.say("a", "/summon Arrow ~ ~3 ~");
  d.arrows.list[0].owner = owner;
  const first = d.arrows.list[0];
  f.say("a", "/summon Arrow ~ ~4 ~");
  assert.equal(d.arrows.list.length, 2);
  assert.equal(d.arrows.list[0], first);
  assert.equal(d.arrows.list[0].owner, owner);
});

test("fireballs and wither skulls join the mobs' own fireball lists", () => {
  const f = fixture(); f.join("a", "Alex", 1);
  const w = f.sim.mobs.mobs;
  assert.deepEqual(f.say("a", "/summon Fireball ~ ~5 ~ {direction:[0.0,-0.1,0.0],ExplosionPower:2}"), [OK]);
  assert.equal(w.fireballs.list.length, 1);
  assert.equal(w.fireballs.list[0].power, 2);
  assert.deepEqual(f.say("a", "/summon WitherSkull ~ ~5 ~ {direction:[0.0,-0.1,0.0]}"), [OK]);
  assert.equal(w.skulls.list.length, 1);
});

test("in the Nether the entities go to the Nether's systems, not the Overworld's", () => {
  const f = fixture(); const a = f.join("a", "Alex", 1);
  f.sim.dimensions.arrive(a, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  const n = f.sim.dimensions.nether, w = n.world;
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 60; y <= 90; y++) w.put(x, y, z, y === 69 ? 150 : 0, 0, false);
  const overPigs = f.sim.dimensions.nether.overMobs.mobs.entities.length;
  assert.deepEqual(f.say("a", "/summon PigZombie"), [OK]);
  assert.deepEqual(f.say("a", "/summon MinecartRideable ~ ~ ~"), [OK]);
  assert.deepEqual(f.say("a", "/summon PrimedTnt ~ ~3 ~"), [OK]);
  assert.deepEqual(f.say("a", "/summon XPOrb ~ ~1 ~ {Value:3}"), [OK]);
  assert.equal(n.mobs.mobs.entities.filter((e) => e.type === "pigman").length, 1);
  assert.equal(n.vehicles.carts.carts.length, 1);
  assert.equal(n.dispense.primed.length, 1);
  assert.equal(n.xp.orbs.length, 1);
  assert.equal(f.sim.dimensions.nether.overMobs.mobs.entities.length, overPigs);
  assert.equal(f.sim.vehicles.carts.carts.length, 0);
  assert.equal(f.sim.dispense.primed.length, 0);
  assert.equal(f.sim.serverItems.xp.orbs.length, 0);
  assert.match(f.say("a", "/summon Pig ~ ~ ~ ")[0], /summoned/);
  // out of the Nether window
  assert.match(f.say("a", "/summon Pig 500 70 500")[0], /out of the world|Cannot summon/i);
});

test("in the End the entities go to the End's systems", () => {
  const f = fixture(); const a = f.join("a", "Alex", 1);
  f.sim.dimensions.arrive(a, 1, { at: { x: 64.5, y: 70, z: 64.5 } });
  const e = f.sim.dimensions.end.n;
  assert.deepEqual(f.say("a", "/summon Enderman ~ ~ ~"), [OK]);
  assert.deepEqual(f.say("a", "/summon MinecartChest ~ ~ ~"), [OK]);
  assert.equal(e.mobs.mobs.entities.filter((m) => m.type === "enderman").length, 1);
  assert.equal(e.vehicles.carts.carts.length, 1);
  assert.equal(f.sim.vehicles.carts.carts.length, 0);
});

test("spawner minecart status and mob puffs use the tracker's square range (80 for a cart and most mobs, 64 for a squid, 160 for the dragon)", () => {
  assert.deepEqual([mobTrackRange("zombie"), mobTrackRange("squid"), mobTrackRange("ender_dragon"), mobTrackRange("bat")], [80, 64, 160, 80]);
  const at = (x, z) => ({ position: { x, y: 0, z } });
  const near = at(79, 79), edge = at(80, -80), far = at(81, 0), high = at(0, 0);
  high.position.y = 200;
  const cart = { k: "spawnerDelay", x: 0, y: 64, z: 0, v: "c1", sq: 80 };
  for (const p of [near, edge, far, high]) sendSpawnerFx([p], [cart]);
  const got = (p) => (p.dispOut ?? []).length;
  assert.deepEqual([got(near), got(edge), got(far), got(high)], [1, 1, 0, 1]); // a square, inclusive, height ignored (a 80,80 corner is outside the old 80-block circle)
  const squid = { k: "spawnerPuff", x: 0, y: 64, z: 0, w: 1, h: 1, sq: 64 }, a = at(65, 0), b = at(64, 64);
  sendSpawnerFx([a, b], [squid]);
  assert.deepEqual([got(a), got(b)], [0, 1]);
  // a block event or the 2004 burst stays a 64-block sphere
  const burst = { k: "spawnerBurst", x: 0, y: 0, z: 0 }, c = at(50, 40), d = at(0, 0);
  sendSpawnerFx([c, d], [burst]);
  assert.deepEqual([got(c), got(d)], [0, 1]);
});

test("the revenge target counts only while it lives (sv.C clears a dead one)", () => {
  const player = { isPlayer: true, living: true, p: { id: "a" }, alive: () => dead === false };
  let dead = false;
  const credit = () => { const k = new KillCredit(); k.hit(player, 0, 10, true); return k; }; // damage 0: nothing in the tracker, only the revenge target
  assert.equal(credit().killer(50, 0, false, (by) => by.alive()), player, "alive attacker within 100 ticks is credited");
  dead = true;
  assert.equal(credit().killer(50, 0, false, (by) => by.alive()), null, "a dead attacker is dropped");
  dead = false;
  assert.equal(credit().killer(200, 0, false, (by) => by.alive()), null, "older than 100 ticks is dropped");
  // the default (no liveness function) keeps the old behaviour
  assert.equal(credit().killer(50, 0, false), player);
  // attackingPlayer is returned unchecked, as sv.aX does
  const k = new KillCredit(); k.hit(player, 0, 10, true); dead = true;
  assert.equal(k.killer(50, 5, false, (by) => by.alive()), player);
});

test("server stats: a player who died no longer gets the kill by revenge (a living one does)", () => {
  const run = (attackerDies) => {
    const f = fixture(); const a = f.join("a", "Alex", 1);
    const w = f.sim.mobs.mobs;
    f.say("a", "/summon Pig");
    const pig = w.entities.find((e) => e.type === "pig");
    let kills = 0; const inc = a.stats.increment.bind(a.stats); a.stats.increment = (stat, ...r) => { kills++; return inc(stat, ...r); };
    f.sim.achievements.attacker = a;
    w.damageEntity(pig, 1, "player", { player: true });
    f.sim.achievements.attacker = null;
    pig.recentlyHit = 0; // attackingPlayer has run out; the fire death skips damageEntity, so the tracker is emptied (the victim is dead): only the revenge target is left
    if (attackerDies) { a.dead = true; w.tick({ x: 64.5, y: 10, z: 64.5 }, a.survival, 0); } // b68: sv.C drops the dead revenge target in the victim's own tick, before the kill
    pig.health = 0;
    w.onDeath(pig, { fire: true });
    return kills;
  };
  assert.equal(run(false), 1, "control: the living attacker is credited through the revenge target");
  assert.equal(run(true), 0, "a dead attacker is not");
});
