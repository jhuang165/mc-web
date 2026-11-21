// b94 credit94: combat credit and enchantment hooks.
// Bytecode-read (javap -c -p on the 1.7.10 jar):
//   afv.b(sv attacker, sa victim): attacker.ak() (a mob's five equipment slots, slot 0 = held; a player's four armour stacks), then attacker.be() ONLY `instanceof yz`.
//   afv.a(sv victim, sa attacker): victim.ak(), then victim.be() only when the ATTACKER (aload_1) is `instanceof yz`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { langReady } from "./chat-component.js";
import { Arrows } from "./bow.js";
import { WitchPotions } from "./witch-potions.js";
import { Projectiles, thrownHit } from "./projectiles.js";
import { setEntityRandom } from "./entities.js";
import { JavaRandom } from "./lighting.js";

await langReady;
const mk = () => { const world = new World("b94-credit"); for (let x = 30; x <= 100; x++) for (let z = 30; z <= 100; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode: "survival" }); sim.mobs.spawning = false; sim.mobs.mobs.entities.length = 0; const ew = sim.mobs.mobs;
  const add = (type, x, z) => { const e = ew.create(type, x, 10, z); e.health = 100; ew.entities.push(e); return e; }; return { sim, ew, add }; };
const bane = (lvl) => ({ id: 272, count: 1, damage: 0, enchantments: [{ id: 18, lvl }] });
const thorns = (lvl) => ({ id: 276, count: 1, damage: 0, enchantments: [{ id: 7, lvl }] });
const slow = (e) => (e.effects ?? []).find((x) => x.id === 2);
const body = (extra = {}) => ({ corpseOf: "player", dead: true, position: { x: 44.5, y: 10, z: 44.5 }, survival: { creative: false, held: null, health: 0 }, ...extra });

test("credit94 (afv.b): a mob holding Bane rolls its Random once, not twice", () => {
  let seed = 1; const first = (s) => { const r = new JavaRandom(s); return [r.nextInt(10), r.nextInt(10)]; };
  while (!(first(seed)[1] > first(seed)[0])) seed++; // two rolls would keep the longer second one
  const { ew, add } = mk(), zombie = add("zombie", 70.5, 70.5), spider = add("spider", 71.2, 70.5);
  zombie.equipment = [bane(1), null, null, null, null];
  setEntityRandom(zombie, new JavaRandom(seed));
  ew.hitMob(zombie, spider);
  const s = slow(spider);
  assert.ok(s, "slowness applied");
  assert.equal(s.duration, 20 + first(seed)[0]);
});

test("credit94 (afv.a): a player attacker visits the mob victim's held Thorns twice, a mob attacker once", () => {
  const { ew, add } = mk(), mob = add("zombie", 70.5, 70.5);
  mob.equipment = [thorns(10), null, null, null, null];
  const count = (byPlayer) => { let n = 0; ew.thornsOfVictim(mob, { hurt: () => { n++; }, sound: () => {}, byPlayer }); return n; };
  assert.equal(count(false), 1);
  mob.equipment[0].damage = 0;
  assert.equal(count(true), 2);
});

test("credit94: a stashed ball, potion and arrow keep the dead body through serialize/load, and the loaded ball hits as a dead attacker", () => {
  const { ew, add } = mk(), b = body({ dimension: -1, survival: { creative: true, held: bane(2), health: 0 } });
  const proj = new Projectiles();
  proj.balls.push({ kind: "snowball", x: 70.5, y: 11, z: 70.5, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0, ticks: 0, rand: proj.rng(), dead: false, ownerBody: b });
  const back = new Projectiles(); back.load(JSON.parse(JSON.stringify(proj.serialize())));
  assert.deepEqual(back.balls[0].ownerBody.position, b.position);
  assert.equal(back.balls[0].ownerBody.dead, true);
  assert.equal(back.balls[0].ownerBody.survival.held.enchantments[0].lvl, 2);
  const pig = add("pig", 71.5, 70.5), seen = []; const orig = ew.damage.bind(ew);
  ew.damage = (...a) => { seen.push(a); return orig(...a); };
  thrownHit(ew, pig, null, back.balls[0]);
  assert.equal(seen[0][6].deadAttacker, true);
  assert.equal(seen[0][2], 44.5);
  const wp = new WitchPotions(ew); wp.projectiles.balls.push({ kind: "potion", damage: 16396, owner: "player", x: 1, y: 1, z: 1, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0, ticks: 0, rand: wp.projectiles.rng(), dead: false, ownerBody: b });
  const wp2 = new WitchPotions(ew); wp2.load(JSON.parse(JSON.stringify(wp.serialize())));
  assert.deepEqual(wp2.projectiles.balls[0].ownerBody.position, b.position);
  const arrows = new Arrows(); arrows.list.push(arrows.make({ x: 1, y: 1, z: 1, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0 }, arrows.rng(), { shooter: "player", ownerBody: b }));
  const a2 = new Arrows(); a2.load(JSON.parse(JSON.stringify(arrows.serialize())));
  assert.equal(a2.list[0].shooter, "player");
  assert.deepEqual(a2.list[0].ownerBody.position, b.position);
  const none = new Arrows(); none.list.push(none.make({ x: 1, y: 1, z: 1, mx: 0, my: 0, mz: 0, yaw: 0, pitch: 0 }, none.rng(), { shooter: "player" }));
  const a3 = new Arrows(); a3.load(JSON.parse(JSON.stringify(none.serialize())));
  assert.equal(a3.list[0].ownerBody, undefined);
});

test("credit94 (afv.b): the old body's armour rolls Bane on its arrow", () => {
  const { ew, add } = mk(), spider = add("spider", 70.5, 70.5);
  const arrow = { shooter: "player", x: 70.5, y: 11, z: 70.5, mx: 0, my: 0, mz: 0, fire: 0, ownerBody: body({ survival: { creative: false, held: null, health: 0, inventory: { armor: [null, bane(2), null, null] } } }) };
  new Arrows().damageTarget(arrow, spider, 2, { mobs: ew, survival: {} });
  assert.ok(slow(spider), JSON.stringify(spider.effects));
});

test("credit94: the dedicated server's dead body keeps the armour the player still wore", () => {
  const { sim } = mk();
  const p = sim.addPlayer("p0", "Dead", "00000000-0000-0000-0000-000000000002");
  p.survival.inventory.armor[1] = bane(3);
  const b = sim.serverSurvival.deadBody(p);
  assert.equal(b.survival.inventory.armor[1].enchantments[0].lvl, 3);
  assert.notEqual(b.survival.inventory.armor[1], p.survival.inventory.armor[1], "a copy");
});
