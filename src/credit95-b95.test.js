// b95 credit95: Thorns visits (afv.a(victim, attacker)).
// Bytecode-read (javap -c -p, 1.7.10 jar):
//   afv.a(sv victim, sa attacker): victim.ak() (armour / a mob's five slots), then victim.be() (held item) only when the ATTACKER is `instanceof yz`.
//   yg.n (EntityMob.attackEntityAsMob) on a landed hit: knockback, Fire Aspect, `target instanceof sv` -> afv.a(target, this), then afv.b(this, target).
import { test } from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { langReady } from "./chat-component.js";

await langReady;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const thorns = (lvl) => ({ id: 276, count: 1, damage: 0, enchantments: [{ id: 7, lvl }] });
const mk = () => { const world = new World("b95-credit"); for (let x = 30; x <= 100; x++) for (let z = 30; z <= 100; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode: "survival" }); sim.mobs.spawning = false; sim.mobs.mobs.entities.length = 0; const ew = sim.mobs.mobs;
  const add = (type, x, z) => { const e = ew.create(type, x, 10, z); e.health = 100; ew.entities.push(e); return e; }; return { sim, ew, add }; };

test("credit95 (afv.a): a player hitting a player visits the victim's held Thorns (armour first, then be())", () => {
  const { sim } = mk(), ps = [];
  for (let i = 0; i < 2; i++) { const p = sim.addPlayer("p" + i, i ? "Victim" : "Attacker", key(i + 1)); p.position.copy({ x: 64.5 + i, y: 10, z: 64.5 });
    sim.input("p" + i, { type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) }); ps.push(p); }
  for (let i = 0; i < 3; i++) sim.tick();
  for (const p of ps) p.survival.protection = 0;
  const [a, v] = ps; v.survival.inventory.main[0] = thorns(10); v.survival.inventory.current = 0;
  let n = 0; const orig = v.survival.thorns.bind(v.survival);
  v.survival.thorns = (o) => orig({ ...o, hurt: () => { n++; }, sound: () => {} });
  sim.soundsOut = [];
  assert.equal(sim.pvpRules.attack(a, v.id), true);
  assert.equal(n, 1); // ak() holds a player's armour only: be() is the held item's one visit
});

test("credit95 (afv.a): a mob victim holding Thorns is visited once by a mob attacker, in hitMob", () => {
  const { ew, add } = mk(), attacker = add("zombie", 70.5, 70.5), victim = add("zombie", 71.2, 70.5);
  victim.equipment = [thorns(10), null, null, null, null];
  const before = attacker.health;
  assert.equal(ew.hitMob(attacker, victim), true);
  assert.ok(attacker.health < before, "the thorns hit the attacker");
  const sounds = ew.events.filter((e) => e.sound === "damage.thorns");
  assert.equal(sounds.length, 1);
});

test("credit95 (yg.n): wolves, slimes, golems and ocelots never trigger the victim's Thorns", () => {
  const { ew, add } = mk(), attacker = add("ocelot", 70.5, 70.5), victim = add("chicken", 71.2, 70.5);
  victim.equipment = [thorns(10), null, null, null, null];
  const before = attacker.health;
  ew.hitMob(attacker, victim);
  assert.equal(attacker.health, before);
});
