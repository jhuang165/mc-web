// b97 credit97: kill credit and enchantment hooks.
// Bytecode-read (javap -c -p, 1.7.10 jar):
//   zk (EntityThrowable) writes only `ownerName` and reads the thrower back by name (the live player); zc (EntityArrow) writes no owner at all.
//   yg.n (EntityMob.attackEntityAsMob): attribute + afv.a(sv, sv) (Sharpness/Smite/Bane of the held item vs the victim's creature attribute), damage, then on a hit knockback,
//     setFire(afv.a(sv) * 4) (Fire Aspect of be()), afv.a(victim, attacker) Thorns, afv.b Bane slowness. sa.e(I): i * 20 shortened by Fire Protection, only ever raised.
//   zc.h: after the hit afv.a(victim, shooter) runs for any living shooter (a shooter that logged out stays the arrow's zc.c).
import { test } from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { Projectiles, forgetOwnerBodies } from "./projectiles.js";
import { WitchPotions } from "./witch-potions.js";
import { Arrows } from "./bow.js";
import { Survival } from "./survival.js";
import { langReady } from "./chat-component.js";

await langReady;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function server(names = ["Shooter"]) {
  const world = new World("b97-credit");
  for (let x = 30; x <= 100; x++) for (let z = 30; z <= 100; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode: "survival" });
  sim.mobs.spawning = false; sim.mobs.mobs.entities.length = 0;
  const ps = names.map((name, i) => { const p = sim.addPlayer("p" + i, name, key(i + 1)); p.position.copy({ x: 64.5 + i, y: 10, z: 64.5 }); p.previous.copy(p.position); sim.input("p" + i, input()); return p; });
  for (let i = 0; i < 3; i++) sim.tick();
  for (const p of ps) p.survival.protection = 0;
  return { sim, ps };
}
const put = (ew, type, x, z) => { const e = ew.create(type, x, 10, z); e.health = 100; ew.entities.push(e); return e; };
const body = { position: { x: 5, y: 10, z: 5 }, survival: { creative: false, held: null, health: 0 } };

test("credit97 (zk, zc): a real reload drops the stashed dead body from balls, potions and arrows", () => {
  const balls = new Projectiles(), potions = new WitchPotions(), arrows = new Arrows();
  balls.load([{ kind: "snowball", x: 1, y: 11, z: 1, mx: 0, my: 0, mz: 0, ownerBody: body }]);
  potions.load([{ x: 1, y: 11, z: 1, mx: 0, my: 0, mz: 0, damage: 16453, ownerBody: body }]);
  arrows.list.push(arrows.fromRecord({ x: 1, y: 11, z: 1, mx: 0, my: 0, mz: 0, shooter: "player", ownerBody: body }));
  assert.ok(balls.balls[0].ownerBody && potions.projectiles.balls[0].ownerBody && arrows.list[0].ownerBody, "a Nether/End stash keeps the body");
  forgetOwnerBodies(balls, potions, arrows);
  assert.equal(balls.balls[0].ownerBody, undefined);
  assert.equal(potions.projectiles.balls[0].ownerBody, undefined);
  assert.equal(arrows.list[0].ownerBody, undefined);
  assert.equal(arrows.list[0].shooter, undefined, "a reloaded arrow is nobody's");
});

const thornsZombie = (ew, x, z) => { const e = put(ew, "zombie", x, z); e.equipment = [null, null, null, { id: 307, count: 1, damage: 0, enchantments: [{ id: 7, lvl: 10 }] }, null]; return e; };
test("credit97 (zc.h, afv.a): a shooter who logged out still triggers the mob's Thorns roll and sound; nobody online is hurt", () => {
  const { sim, ps: [a, b] } = server(["Shooter", "Other"]);
  const d = sim.dispense, ew = sim.mobs.mobs, z = thornsZombie(ew, 70.5, 70.5), ctx = d.arrowCtx(d);
  const arrow = { shooter: "player", owner: a, ownerName: a.name, x: 70.5, y: 11, z: 70.5, mx: 0, my: 0, mz: 0, fire: 0 };
  sim.removePlayer("p0");
  d.fx.length = 0;
  const hpB = b.survival.health;
  assert.ok(d.arrows.damageTarget(arrow, z, 2, ctx));
  assert.ok(d.fx.some((f) => f.name === "damage.thorns"), "the thorns sound plays at the removed body");
  assert.equal(b.survival.health, hpB);
});

const sword = (...enchantments) => ({ id: 276, count: 1, damage: 0, enchantments });
test("credit97 (yg.n, sa.e): Fire Aspect on a mob's weapon sets level * 4 seconds on a mob victim and a player victim; Smite adds 2.5 per level (through the zombie's armour 2)", () => {
  const { sim, ps: [p] } = server();
  const ew = sim.mobs.mobs, att = put(ew, "zombie", 70.5, 70.5), vic = put(ew, "zombie", 70.5, 71.2);
  att.equipment = [sword({ id: 20, lvl: 2 }), null, null, null, null];
  assert.equal(ew.hitMob(att, vic), true);
  assert.equal(vic.fire, 160, "2 * 4 s * 20 ticks");
  p.survival.fire = 0;
  p.survival.setFire(0);
  assert.equal(ew.hitPlayer(att, p.survival), true);
  assert.equal(p.survival.fire, 160);
  // Smite 3 on an undead victim: +7.5 before the victim's armour (x 0.92)
  att.equipment = [sword({ id: 17, lvl: 3 }), null, null, null, null];
  const z2 = put(ew, "zombie", 70.5, 71.2), z0 = z2.health;
  ew.hitMob(att, z2);
  const plain = put(ew, "zombie", 80.5, 80.5), plainVic = put(ew, "zombie", 80.5, 81.2), pa = plain; pa.equipment = [sword(), null, null, null, null];
  ew.hitMob(pa, plainVic);
  assert.ok(Math.abs((z0 - z2.health) - (100 - plainVic.health) - 7.5 * 0.92) < 1e-4, `smite ${z0 - z2.health} vs ${100 - plainVic.health}`);
});

test("credit97 (zc.h, afv.a): an arrow that kills a Thorns mob still hurts the shooter and credits the shooter's Looting/XP flag", () => {
  const { sim, ps: [a] } = server();
  const d = sim.dispense, ew = sim.mobs.mobs, z = thornsZombie(ew, 70.5, 70.5), ctx = d.arrowCtx(d);
  z.health = 1;
  const hp = a.survival.health;
  const arrow = { shooter: "player", owner: a, ownerName: a.name, x: 70.5, y: 11, z: 70.5, mx: 0, my: 0, mz: 0, fire: 0 };
  assert.ok(d.arrows.damageTarget(arrow, z, 2, ctx));
  assert.ok(z.health <= 0, "the mob died");
  assert.ok(a.survival.health < hp, "the thorns of the dead mob still hurt the shooter");
  assert.ok(z.recentlyHit > 0, "the kill is a player's (XP orbs drop)");
});
