// b93 credit93: the shooter's attacker hook on an arrow hit, and a dead single-player shooter's potions.
// Bytecode-read (javap -c -p on the 1.7.10 jar):
//   zc.h 1065-1100: after a landed arrow on a living victim: afv.a(victim, shooter) (Thorns), then afv.b(shooter, victim) when the shooter is an sv.
//   afv.b(sv, sa): the shooter's sv.ak() (armour; a mob's five equipment slots) and, only `instanceof yz`, sv.be() (the held item at the hit); the visitor afx calls aft.a(sv, sa, int).
//   Only afq (EnchantmentDamage) overrides aft.a(sv, sa, int): Bane of Arthropods, Slowness IV (rw(2, 20 + shooter.aI().nextInt(10 * level), 3)). Fire Aspect overrides neither hook.
//   oi.a(mw, int): transferPlayerToDimension has no `new mw`: the same EntityPlayerMP object keeps throwing (the dimension change creates no old body).
import { test } from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { langReady } from "./chat-component.js";
import { Arrows } from "./bow.js";
import { WitchPotions } from "./witch-potions.js";

await langReady;
const mk = () => { const world = new World("b93-credit"); for (let x = 30; x <= 100; x++) for (let z = 30; z <= 100; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode: "survival" }); sim.mobs.spawning = false; sim.mobs.mobs.entities.length = 0; const ew = sim.mobs.mobs; const add = (type, x, z) => { const e = ew.create(type, x, 10, z); e.health = 100; ew.entities.push(e); return e; }; return { ew, add }; };
const bane = (lvl) => ({ id: 272, count: 1, damage: 0, enchantments: [{ id: 18, lvl }] });
const arrow = (o) => ({ shooter: "player", x: 70.5, y: 11, z: 70.5, mx: 0, my: 0, mz: 0, fire: 0, ...o });
const slow = (e) => (e.effects ?? []).find((x) => x.id === 2);

test("credit93 (afv.b, afq.a): the item held when the arrow lands (not the bow) rolls Bane slowness IV on a spider", () => {
  const { ew, add } = mk(), spider = add("spider", 70.5, 70.5), zombie = add("zombie", 72.5, 70.5);
  const arrows = new Arrows(), survival = { held: bane(3), inventory: { armor: [null, null, null, null] } };
  assert.ok(arrows.damageTarget(arrow(), spider, 2, { mobs: ew, survival, player: { x: 60, y: 10, z: 60 } }));
  const s = slow(spider);
  assert.ok(s && s.amplifier === 3 && s.duration >= 20 && s.duration < 50, JSON.stringify(spider.effects));
  arrows.damageTarget(arrow(), zombie, 2, { mobs: ew, survival, player: { x: 60, y: 10, z: 60 } });
  assert.equal(slow(zombie), undefined, "not an arthropod");
});

test("credit93 (afv.b): the shooter's armour counts, Fire Aspect does nothing, a bow in hand does nothing", () => {
  const { ew, add } = mk(), spider = add("spider", 70.5, 70.5), arrows = new Arrows();
  const fire = { id: 276, count: 1, damage: 0, enchantments: [{ id: 20, lvl: 2 }] };
  arrows.damageTarget(arrow(), spider, 2, { mobs: ew, survival: { held: fire, inventory: { armor: [null, null, null, null] } }, player: { x: 60, y: 10, z: 60 } });
  assert.equal(slow(spider), undefined);
  assert.ok(!(spider.fire > 0) && !(spider.burn > 0), "Fire Aspect does not ignite on an arrow hit");
  spider.hurt = 0; spider.health = 100;
  arrows.damageTarget(arrow(), spider, 2, { mobs: ew, survival: { held: null, inventory: { armor: [null, bane(2), null, null] } }, player: { x: 60, y: 10, z: 60 } });
  assert.ok(slow(spider));
});

test("credit93 (afv.b): a mob shooter's five equipment slots roll on its own Random; a dead body has no armour", () => {
  const { ew, add } = mk(), spider = add("cave_spider", 70.5, 70.5), sk = add("skeleton", 75.5, 70.5);
  sk.equipment = [bane(1), null, null, null, null];
  new Arrows().damageTarget({ ...arrow({ shooter: sk }) }, spider, 2, { mobs: ew });
  assert.ok(slow(spider));
  const spider2 = add("spider", 71.5, 70.5), body = { corpseOf: "player", dead: true, position: { x: 1, y: 10, z: 1 }, survival: { creative: false, held: bane(1), health: 0 } };
  new Arrows().damageTarget(arrow({ ownerBody: body, owner: { survival: { inventory: { armor: [bane(4), null, null, null] } } } }), spider2, 2, { mobs: ew, survival: {} });
  const s = slow(spider2);
  assert.ok(s && s.duration < 30, "level 1 held item only: " + JSON.stringify(spider2.effects));
});

test("credit93 (EntityPotion.onImpact, zk.j): a dead single-player thrower's potion hits from the old body and leaves the dead body as attacker", () => {
  const { ew, add } = mk(), pig = add("spider", 70.5, 70.5), potions = new WitchPotions(ew);
  const body = { corpseOf: "player", dead: true, position: { x: 44.5, y: 10, z: 44.5 }, survival: { creative: false, held: null, health: 0 } };
  const seen = []; const orig = ew.attackEntityFrom.bind(ew); ew.attackEntityFrom = (e, n, src) => { seen.push(src); return orig(e, n, src); };
  potions.impact({ x: 70.5, y: 10, z: 70.5, damage: 16396, owner: "player", hit: pig, ownerBody: body }, null, null);
  assert.ok(seen.length, "harming hurt the spider");
  assert.equal(seen[0].deadAttacker, true);
  assert.deepEqual(seen[0].from, { x: 44.5, z: 44.5 });
});

test("credit93 (oi.a(mw, int), zm.a): a dimension change keeps the same thrower object (no body); the pearl needs mw.o == o, so it does not teleport a thrower now elsewhere", () => {
  const world = new World("b93-credit2"); for (let x = 30; x <= 100; x++) for (let z = 30; z <= 100; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode: "survival" }); sim.mobs.spawning = false;
  const a = sim.addPlayer("p0", "Thrower", "00000000-0000-0000-0000-000000000001");
  a.position.copy({ x: 64.5, y: 10, z: 64.5 }); a.previous.copy(a.position); for (let i = 0; i < 3; i++) sim.tick(); a.survival.protection = 0;
  const d = sim.dispense, pearl = d.balls.throwEnderPearl({ x: 64.5, y: 10, z: 64.5 }, 0, 0); pearl.thrower = a; pearl.ownerName = a.name;
  Object.assign(pearl, { x: 85.5, y: 10, z: 85.5 });
  a.dimension = -1; // the same EntityPlayerMP, now in the Nether
  d.pearlImpact(d, { pearl, hit: null });
  assert.equal(pearl.ownerBody, undefined, "no body is made by a dimension change");
  assert.equal(d.ownerOf(pearl), a);
  assert.equal(a.position.x, 64.5, "the pearl of another world does not move him");
});
