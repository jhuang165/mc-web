// b98 credit98: a logged-out arrow shooter takes the mob's Thorns hit (a lethal one is a death), and a player victim's Thorns run after the mob's knockback and Fire Aspect.
// Bytecode-read (javap -c -p, 1.7.10 jar):
//   mw.a(ro, F) (EntityPlayerMP.attackEntityFrom): invulnerable test, spawn-protection `bU`, PvP test for a yz source only, then yz.a; yz.a/sv.a test Creative and aS() <= 0, never whether
//     the player is online. sv.a ends with onDeath when aS() <= 0; mw.a(ro) sends rn.b() through oi.a(fj) to the server, dropAllItems unless keepInventory, then aX() credit and stats.
//   yg.n (EntityMob.attackEntityAsMob): damage, then on a hit knockback, setFire(afv.a(sv) * 4), afv.a(victim, attacker) (Thorns), afv.b.
import { test } from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { langReady } from "./chat-component.js";

await langReady;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function server(names) {
  const world = new World("b98-credit");
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
const thornsZombie = (ew, x, z) => { const e = put(ew, "zombie", x, z); e.equipment = [null, null, null, { id: 307, count: 1, damage: 0, enchantments: [{ id: 7, lvl: 10 }] }, null]; return e; };

function shoot(lethal) {
  const { sim, ps: [a] } = server(["Shooter"]);
  const d = sim.dispense, ew = sim.mobs.mobs, z = thornsZombie(ew, 70.5, 70.5), ctx = d.arrowCtx(d);
  a.survival.inventory.main[0] = { id: 1, count: 3, damage: 0 };
  a.survival.health = lethal ? 1 : 20;
  const arrow = { shooter: "player", owner: a, ownerName: a.name, x: 70.5, y: 11, z: 70.5, mx: 0, my: 0, mz: 0, fire: 0 };
  sim.removePlayer("p0");
  sim.events = []; const before = sim.items.list?.length ?? 0;
  d.arrows.damageTarget(arrow, z, 2, ctx);
  return { sim, a, before };
}

test("credit98 (mw.a, sv.a, mw.a(ro)): Thorns on a logged-out shooter kills the removed body: a death message and its items dropped", () => {
  const { sim, a } = shoot(true);
  assert.ok(a.survival.health <= 0, "the removed body took the hit");
  const death = sim.events.find((e) => e.type === "death" && e.id === a.id);
  assert.ok(death, "the death is broadcast");
  assert.equal(a.survival.inventory.main[0], null, "dropAllItems emptied it");
  assert.ok(a.dead);
});

test("credit98 (mw.a, yz.a): a non-lethal Thorns hit only hurts the removed body, with no death", () => {
  const { sim, a } = shoot(false);
  assert.ok(a.survival.health < 20 && a.survival.health > 0);
  assert.equal(sim.events.filter((e) => e.type === "death").length, 0);
  assert.deepEqual(a.survival.inventory.main[0], { id: 1, count: 3, damage: 0 });
});

test("credit98 (yg.n): the player's Thorns run after the mob's Fire Aspect, not inside the damage call", () => {
  const { sim, ps: [p] } = server(["Victim"]);
  const ew = sim.mobs.mobs, att = put(ew, "zombie", 70.5, 70.5);
  att.equipment = [{ id: 276, count: 1, damage: 0, enchantments: [{ id: 20, lvl: 1 }] }, null, null, null, null];
  p.survival.inventory.armor[3] = { id: 307, count: 1, damage: 0, enchantments: [{ id: 7, lvl: 3 }] };
  p.survival.fire = 0; p.survival.setFire(0);
  let fireAtThorns = null;
  const orig = p.survival.thorns;
  p.survival.thorns = function (...args) { fireAtThorns = this.fire; return orig.apply(this, args); };
  assert.equal(ew.hitPlayer(att, p.survival), true);
  assert.equal(fireAtThorns, 80, "Fire Aspect 1 (4 s) was already set when Thorns ran");
});
