// b100 credit100: the removed body of a logged-out shooter whose arrow hit an online player wearing Thorns. Bytecode-read (javap -c -p, 1.7.10 jar):
//   oi.e(mw) (logout): mt.e(sa) = ahb.e(sa) setDead + playerEntities.remove + ahb.b(sa) -> mp.b -> mn.b(sa) untracks the entity id; mt.a(sa, B) -> mn.b(sa, ft) looks the id up in pz and
//   sends only when found, so setEntityState(3) reaches nobody (no S19). ahb.h tests sa.K (isDead) before updateEntity, so onDeathUpdate (the XP orbs, sv.aF) never runs. sv.a(ro) credits
//   aX().b(this, ba) (sa.b(sa, int) is empty, yz.b(sa, int) adds the score and playerKills for a player victim); afv.a(sv, sa) visits the held item when `sa instanceof yz`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { langReady } from "./chat-component.js";
import { STAT } from "./stats.js";

await langReady;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function server(names) {
  const world = new World("b99-credit");
  for (let x = 30; x <= 100; x++) for (let z = 30; z <= 100; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode: "survival" });
  sim.mobs.spawning = false; sim.mobs.mobs.entities.length = 0;
  const ps = names.map((name, i) => { const p = sim.addPlayer("p" + i, name, key(i + 1)); p.position.copy({ x: 64.5 + i, y: 10, z: 64.5 }); p.previous.copy(p.position); sim.input("p" + i, input()); return p; });
  for (let i = 0; i < 3; i++) sim.tick();
  for (const p of ps) p.survival.protection = 0;
  return { sim, ps };
}
const put = (ew, type, x, z, health = 100) => { const e = ew.create(type, x, 10, z); e.health = health; ew.entities.push(e); return e; };
const thornsZombie = (ew, x, z) => { const e = put(ew, "zombie", x, z); e.equipment = [null, null, null, { id: 307, count: 1, damage: 0, enchantments: [{ id: 7, lvl: 10 }] }, null]; return e; };


function setup(thornsHeld) {
  const { sim, ps: [shooter, wearer] } = server(["Shooter", "Wearer"]);
  const d = sim.dispense, arrows = d.arrows;
  const a = arrows.make({ x: 70.5, y: 12, z: 70.5, mx: 0, my: 0, mz: 1, yaw: 0, pitch: 0 }, arrows.rng(), { shooter: "player", pickup: 1, owner: shooter, ownerName: shooter.name });
  arrows.list.push(a);
  sim.removePlayer("p0");
  wearer.survival.thorns = (o) => { o.hurt(5); o.sound(); calls.push(o.byPlayer); };
  const calls = [];
  return { sim, d, a, shooter, wearer, calls };
}

test("credit100 (afv.a, sv.a(ro)): a Thorns hit by an online wearer kills the removed shooter, credits the wearer's playerKills and the killed-by stat of a player is none", () => {
  const { sim, d, a, shooter, wearer } = setup();
  shooter.survival.health = 1; shooter.survival.protection = 0;
  const kills = wearer.stats.get(STAT.playerKills) ?? 0;
  sim.events = [];
  assert.equal(d.hitPlayer(a, wearer, 2, sim.mobs.mobs), true);
  assert.equal(shooter.dead, true);
  const ev = sim.events.find((e) => e.type === "death" && e.id === shooter.id);
  assert.ok(ev, "death message");
  assert.equal(ev.killer, wearer.id);
  assert.equal(wearer.stats.get(STAT.playerKills), kills + 1);
  assert.equal(shooter.stats.get(STAT.deaths), 1);
});

test("credit100 (afv.a): the Thorns of a removed shooter's arrow hit run with the held-item visit of a player attacker, and a non-lethal hit takes health without a death", () => {
  const { sim, d, a, shooter, wearer, calls } = setup();
  shooter.survival.protection = 0;
  const hp = shooter.survival.health;
  assert.equal(d.hitPlayer(a, wearer, 2, sim.mobs.mobs), true);
  assert.deepEqual(calls, [true]);
  assert.ok(shooter.survival.health < hp);
  assert.notEqual(shooter.dead, true);
});

test("credit100 (afv.a): a live player's arrow Thorns on the victim also pass byPlayer", () => {
  const { sim, ps: [s, v] } = server(["Shooter", "Victim"]);
  const arrows = sim.dispense.arrows;
  const a = arrows.make({ x: 70.5, y: 12, z: 70.5, mx: 0, my: 0, mz: 1, yaw: 0, pitch: 0 }, arrows.rng(), { shooter: "player", pickup: 1, owner: s, ownerName: s.name });
  arrows.list.push(a);
  let flag;
  v.survival.thorns = (o) => { flag = o.byPlayer; };
  assert.equal(sim.dispense.hitPlayer(a, v, 2, sim.mobs.mobs), true);
  assert.equal(flag, true);
});
