// b99 credit99: a logged-out shooter's removed body killed by Thorns (hurt/death sound, deaths and killed-by stats), a tamed wolf's kill (drops, XP, rare drop, no Looting), a dispenser's
// ownerless arrow and fire charge (no recentlyHit: no XP, no rare drop, no player-only drops).
// Bytecode-read (javap -c -p, 1.7.10 jar):
//   sv.a(ro, F) 453-528: after the health change, `a(aU() if health <= 0 else aT(), bf(), bg())` (the sound call also on a refused-by-nothing hit); yz.a(String, F, F) is playSoundToNearExcept from
//     the entity's own world, which a removed EntityPlayerMP keeps. mw.a(ro): oi.a(rn.b()), dropAllItems, the deathCount objectives (bU().a(name, objective).a()), aX() credit (sg.a(entity):
//     the killed-by stat), mw.a(pp.v, 1) (deaths). mw.a(ph, int) -> pg.b(yz, ph, int): the StatisticsFile lives in the player list by UUID and outlives oi.e(mw) (which saves the NBT only).
//   sv.a(ro) onDeath: looting `afv.i` only when ro.j() is a yz; dropFewItems(aS > 0, looting), dropEquipment(aS > 0, looting), rare drop nextInt(200) - looting < 5 when aS > 0.
//   sv.aF: at deathTime 20, `aS > 0 || isPlayer`, aG(), doMobLoot -> XP orbs of e(aR) (aR is null for a wolf kill; the orb count does not read it).
//   sv.a(ro, F) 208-296: a tamed wv sets aS = 100, aR = null. zc.h 864-892: a null shooter makes ro.a(arrow, arrow); zi.a(azu): causeFireballDamage(ball, null) is an rq("onFire", ball, ball); neither
//     source entity is an sv or yz, so aS stays 0.
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

function shoot(lethal) {
  const { sim, ps: [a] } = server(["Shooter"]);
  const d = sim.dispense, ew = sim.mobs.mobs, z = thornsZombie(ew, 70.5, 70.5), ctx = d.arrowCtx(d);
  a.survival.health = lethal ? 1 : 20;
  const arrow = { shooter: "player", owner: a, ownerName: a.name, x: 70.5, y: 11, z: 70.5, mx: 0, my: 0, mz: 0, fire: 0 };
  sim.removePlayer("p0");
  sim.soundsOut.length = 0;
  d.arrows.damageTarget(arrow, z, 2, ctx);
  return { sim, a };
}

test("credit99 (sv.a(ro, F), yz.a(String, F, F)): a Thorns hit on the removed body plays the hurt sound, a lethal one the death sound, both to everyone but the body", () => {
  const hurt = shoot(false), die = shoot(true);
  const h = hurt.sim.soundsOut.filter((s) => s.name.startsWith("game.player."));
  assert.deepEqual(h.map((s) => s.name), ["game.player.hurt"]);
  assert.equal(h[0].except, hurt.a.id);
  assert.equal(h[0].volume, 1);
  const d = die.sim.soundsOut.filter((s) => s.name.startsWith("game.player."));
  assert.deepEqual(d.map((s) => s.name), ["game.player.die"]);
  assert.deepEqual([d[0].x, d[0].y, d[0].z], [die.a.position.x, die.a.position.y, die.a.position.z]);
});

test("credit99 (mw.a(ro), mw.a(ph, int)): the removed body's death counts the deaths stat and the killing mob's killed-by stat; the in-memory stats reach the next login", () => {
  const { sim, a } = shoot(true);
  assert.equal(a.stats.get(STAT.deaths), 1);
  assert.equal(a.stats.get("stat.entityKilledBy.Zombie"), 1);
  const rec = sim.savedPlayers.get(a.resumeKey);
  assert.equal(rec.stats[STAT.deaths], 1, "saved record refreshed");
  assert.equal(rec.stats["stat.entityKilledBy.Zombie"], 1);
  const again = shoot(false);
  assert.equal(again.a.stats.get(STAT.deaths), 0, "a non-lethal hit is no death");
  assert.ok(again.sim.savedPlayers.get(again.a.resumeKey).stats[STAT.damageTaken] > 0, "damage taken is kept");
});

// ---- 2. tamed wolf ----
function wolfKill(tamed, { player = false } = {}) {
  const { sim } = server(["Owner"]);
  const ew = sim.mobs.mobs, loot = [];
  ew.spawnLoot = (evs) => loot.push(...evs);
  const wolf = put(ew, "wolf", 70.5, 70.5, 20); if (tamed) wolf.owner = "Owner";
  const zombie = put(ew, "zombie", 71.5, 70.5, 1); zombie.equipment = [null, null, null, null, null];
  if (player) { zombie.recentlyHit = 100; }
  assert.equal(ew.hitMob(wolf, zombie), true);
  assert.ok(zombie.health <= 0);
  for (let i = 0; i < 20; i++) ew.deathUpdate(zombie, { width: 0.6, height: 1.8 });
  return { zombie, loot };
}
test("credit99 (sv.a(ro, F) 208-296, sv.a(ro), sv.aF): a tamed wolf's kill leaves recentlyHit 100, drops, and the XP orbs; a wild wolf's gives none", () => {
  const t = wolfKill(true), w = wolfKill(false);
  assert.equal(t.zombie.recentlyHit, 100);
  assert.ok(t.loot.some((e) => e.xp > 0), "XP");
  assert.equal(w.zombie.recentlyHit ?? 0, 0);
  assert.ok(!w.loot.some((e) => e.xp), "no XP for a wild wolf");
});

test("credit99 (sv.a(ro) afv.i only for a yz): a wolf kill credits the owner no kill score (Looting is read only from a player source)", () => {
  const { sim, ps: [owner] } = server(["Owner"]);
  owner.survival.inventory.main[0] = { id: 276, count: 1, damage: 0, enchantments: [{ id: 21, lvl: 3 }] }; owner.survival.inventory.current = 0;
  const ew = sim.mobs.mobs, wolf = put(ew, "wolf", 70.5, 70.5, 20); wolf.owner = "Owner";
  const z = put(ew, "zombie", 71.5, 70.5, 1);
  const before = owner.stats.get(STAT.mobKills);
  ew.hitMob(wolf, z);
  assert.equal(owner.stats.get(STAT.mobKills), before, "EntityWolf is no player: no score for the owner");
});

// ---- 3. dispenser arrow and fire charge ----
test("credit99 (zc.h, ro.a(zc, sa), zi.a): an ownerless arrow's kill sets no recentlyHit: no XP, and a fire charge's kill likewise", () => {
  const { sim } = server(["Owner"]);
  const ew = sim.mobs.mobs, loot = [];
  ew.spawnLoot = (evs) => loot.push(...evs);
  const a = put(ew, "zombie", 70.5, 70.5, 1), b = put(ew, "zombie", 72.5, 70.5, 1);
  const ctx = sim.dispense.arrowCtx(sim.dispense);
  sim.dispense.arrows.damageTarget({ shooter: null, x: 70.5, y: 11, z: 70.5, mx: 0, my: 0, mz: 0, fire: 0 }, a, 2, ctx);
  assert.ok(a.health <= 0);
  const fb = ew.fireballs;
  fb.impact({ large: false, owner: null, x: 72.5, y: 11, z: 70.5, dead: false }, { entity: b });
  assert.ok(b.health <= 0);
  for (const z of [a, b]) { assert.equal(z.recentlyHit ?? 0, 0); for (let i = 0; i < 20; i++) ew.deathUpdate(z, { width: 0.6, height: 1.8 }); }
  assert.ok(!loot.some((e) => e.xp), "no XP orbs");
});
