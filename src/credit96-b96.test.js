// b96 credit96: kill credit and enchantment hooks.
// Bytecode-read (javap -c -p, 1.7.10 jar):
//   yg.n (EntityMob.attackEntityAsMob): Knockback level i of the held item -> target.addVelocity(-sin(this.rotationYaw) * i * 0.5F, 0.1, cos(this.rotationYaw) * i * 0.5F), then this.motionX *= 0.6, motionZ *= 0.6.
//   sv.a(ro) onDeath: Looting of the source entity (a thrown potion's source entity is its thrower) when it is an EntityPlayer, read from the item it holds at that moment.
import { test } from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { WitchPotions } from "./witch-potions.js";
import { mhSin, mhCos } from "./lighting.js";
import { langReady } from "./chat-component.js";

await langReady;
const f = Math.fround;
const mk = () => { const world = new World("b96-credit"); for (let x = 30; x <= 100; x++) for (let z = 30; z <= 100; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode: "survival" }); sim.mobs.spawning = false; sim.mobs.mobs.entities.length = 0; const ew = sim.mobs.mobs;
  const add = (type, x, z) => { const e = ew.create(type, x, 10, z); e.health = 100; ew.entities.push(e); return e; }; return { sim, ew, add }; };

test("credit96 (yg.n): a mob's Knockback pushes along the attacker's yaw, not toward the target, and slows the attacker", () => {
  const { ew, add } = mk(), attacker = add("zombie", 70.5, 70.5), victim = add("zombie", 70.5, 71.2);
  attacker.equipment = [{ id: 276, count: 1, damage: 0, enchantments: [{ id: 19, lvl: 2 }] }, null, null, null, null];
  attacker.rotationYaw = 90; // faces -x, the victim stands at +z
  attacker.vx = 1; attacker.vz = 1;
  victim.vx = 0; victim.vz = 0; victim.vy = 0; victim.knockbackResistance = 0;
  const rad = f(f(90 * f(Math.PI)) / 180);
  assert.equal(ew.hitMob(attacker, victim), true);
  const dx = f(f(-mhSin(rad) * 2) * 0.5), dz = f(f(mhCos(rad) * 2) * 0.5);
  // attackEntityFrom's own knockback is added on top; the enchant push is the difference to a plain hit.
  const { ew: ew2, add: add2 } = mk(), a2 = add2("zombie", 70.5, 70.5), v2 = add2("zombie", 70.5, 71.2);
  a2.equipment = [{ id: 276, count: 1, damage: 0 }, null, null, null, null]; a2.rotationYaw = 90; v2.vx = v2.vz = v2.vy = 0; v2.knockbackResistance = 0;
  ew2.hitMob(a2, v2);
  assert.ok(Math.abs(victim.vx - v2.vx - dx) < 1e-9, `vx ${victim.vx - v2.vx} vs ${dx}`);
  assert.ok(Math.abs(victim.vz - v2.vz - dz) < 1e-9, `vz ${victim.vz - v2.vz} vs ${dz}`);
  assert.ok(Math.abs(attacker.vx - 0.6) < 1e-9 && Math.abs(attacker.vz - 0.6) < 1e-9, "the attacker's horizontal motion is x 0.6");
});

test("credit96 (sv.a(ro)): a player's splash potion kill carries the thrower's Looting", () => {
  const { ew, add } = mk(), pig = add("pig", 70.5, 70.5), seen = [], orig = ew.attackEntityFrom.bind(ew);
  ew.attackEntityFrom = (e, n, src) => { seen.push(src); return orig(e, n, src); };
  const potions = new WitchPotions(ew), sword = { id: 276, count: 1, damage: 0, enchantments: [{ id: 21, lvl: 3 }] };
  const throwAt = (thrower, survival, ownerBody) => { seen.length = 0; pig.health = 100; potions.impact({ x: 70.5, y: 10.5, z: 70.5, damage: 16396, owner: thrower ? undefined : "player", hit: pig, ...(ownerBody ? { ownerBody } : {}) }, null, survival, thrower); return seen.find((s) => s.name === "indirectMagic"); };
  assert.equal(throwAt(null, { held: sword, health: 20 })?.looting, 3, "single player: the held item");
  assert.equal(throwAt({ x: 1, z: 1, name: "A", held: sword }, null)?.looting, 3, "server: the thrower's held item");
  assert.equal(throwAt({ x: 1, z: 1, name: "A", held: null }, null)?.looting, 0, "an empty hand has none");
  assert.equal(throwAt({ x: 1, z: 1, name: "A", held: null }, null, { position: { x: 1, y: 1, z: 1 }, survival: { held: sword } })?.looting, 3, "a dead old body holds its frozen item");
});
