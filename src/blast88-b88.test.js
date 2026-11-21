// b88 blast88: the server look a blast reads, wither skulls and ghast fireballs as sources, a player's TNT against players, the unsaved shooter and Looting off arrows.
// Bytecode-read (javap -c -p on the 1.7.10 jar):
//   MinecraftServer.v: every world's tick, updateEntities and tracker, THEN the network system (nc.c), so a blast in the entity pass reads the rotation the last
//   processPlayer set (nh.a(jd) 625-678: jd.k() ? the packet's angles, then setPositionAndRotation; the sleeping branch keeps the entity's own).
//   ro.a(agw): "explosion.player" (rp) with agw.c() as entity, else the plain "explosion"; rp.r() (isDifficultyScaled) is true only for a living non-player entity.
//   mw.a(ro, F): an rp whose entity is a player is refused when canAttackPlayer (mw.a(yz)) is false (pvp off), the victim's own TNT included.
//   mw.a(ro) / sv.aX() / yz.b(sa, int): the killer's addToPlayerScore adds stat.playerKills for a player victim, with no self test.
//   zp.a(azu): no shooter -> attackEntityFrom(DamageSource.magic, 5) on any entity (ro.k: no entity, so no knockback). zg.a(azu): newExplosion(null, ...).
//   ze.b(dh) / ze.a(dh): xTile, yTile, zTile, inTile, inGround, direction (zg: ExplosionPower). No shooter.
//   sv.a(ro): an entity source that is a player gives Looting = afv.i(player), the item held at the death; ro.a(zc, sa) is rq("arrow", arrow, shooter), j() the shooter.
import { test } from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { makeStack } from "./inventory.js";
import { langReady } from "./chat-component.js";
import { lookVector, deflect } from "./blaze-ghast.js";
import { mhSin, mhCos } from "./lighting.js";
import { STAT } from "./stats.js";
import { Fireballs, serverLookOf } from "./fireballs.js";
import { WitherSkulls } from "./wither-boss-mobs.js";
import { Arrows } from "./bow.js";
import { applyExplosion } from "./explosion-simulation.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs } from "./experience.js";
import { knockBack } from "./player-knockback.js";

await langReady;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const LOOTING = 21, SWORD = 115; // the port's diamond sword
const looted = (lvl) => makeStack(SWORD, 1, 0, undefined, { enchantments: [{ id: LOOTING, lvl }] });
const hold = (p, st) => { p.survival.inventory.main[0] = st; p.survival.inventory.current = 0; };
const javaLook = (yaw, pitch) => lookVector(Math.fround(180 - (yaw * 180) / Math.PI), Math.fround((-pitch * 180) / Math.PI), mhSin, mhCos);

function server(names = ["Attacker"]) {
  const world = new World("b88-blast");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode: "survival" });
  sim.mobs.mobs.entities.length = 0;
  const ps = names.map((name, i) => {
    const p = sim.addPlayer("p" + i, name, key(i + 1));
    p.position.copy({ x: 64.5 + i * 2, y: 10, z: 64.5 }); p.previous.copy(p.position);
    Object.assign(p, { yaw: 0, pitch: 0, moved: true });
    return p;
  });
  return { sim, ps, world };
}
const primedBy = (sim, placer, x, y, z) => { sim.dispense.prime(x, y, z, false, { fuse: 80, placer }); return sim.dispense.primed.at(-1); };

// ---- 1. the server's look ----
test("blast88 (bytecode-read MinecraftServer.v, nh.a(jd)): a blast turns a large fireball to the look the last processPlayer set, not a message that arrived after it", () => {
  const { sim, ps: [p] } = server();
  sim.tick(); // the player loop (the port's processPlayer) copies yaw 0, pitch 0
  assert.deepEqual(p.serverLook, { yaw: 0, pitch: 0 });
  const t = primedBy(sim, p, 70.5, 11, 70.5);
  p.position.copy({ x: 44.5, y: 10, z: 44.5 }); p.previous.copy(p.position);
  Object.assign(p, { yaw: 0.7, pitch: -0.3 }); // a C03 queued for the next network tick (the port's message handler writes it at once)
  const fb = sim.mobs.mobs.fireballs, ball = fb.launch({ large: true, owner: null, x: 71.5, y: 12, z: 71.5, exact: [1, 0, 0] }), twin = { ...ball };
  sim.mobs.explode({ x: t.x, y: t.y, z: t.z, size: 4, source: t });
  deflect(twin, javaLook(0, 0));
  assert.equal(ball.punchedBy, p);
  for (const k of ["ax", "ay", "az"]) assert.equal(ball[k], twin[k], k);
  sim.tick();
  assert.deepEqual(p.serverLook, { yaw: 0.7, pitch: -0.3 }, "the next player loop takes it");
  assert.deepEqual(serverLookOf({ yaw: 1, pitch: 2 }), { yaw: 1, pitch: 2 }, "a record without the copy (a test, before the first tick) reads its own angles");
});

test("blast88: a punched server ball that hits another large ball turns it to the puncher's look and makes it his (it used to ask the missing playerLook and do nothing)", () => {
  const { sim, ps: [p] } = server();
  p.serverLook = { yaw: 0.4, pitch: 0.2 };
  const fb = sim.mobs.mobs.fireballs;
  const a = fb.launch({ large: true, owner: null, x: 70.5, y: 12, z: 70.5, exact: [1, 0, 0] }), b = fb.launch({ large: true, owner: null, x: 71.5, y: 12, z: 70.5, exact: [0, 0, 1] });
  Object.assign(a, { owner: "player", punchedBy: p });
  const twin = { ...b };
  fb.impact(a, { entity: { ball: b } });
  deflect(twin, javaLook(0.4, 0.2));
  assert.equal(b.owner, "player");
  assert.equal(b.punchedBy, p);
  for (const k of ["ax", "ay", "az"]) assert.equal(b[k], twin[k], k);
});

// ---- 2. skulls and ghast balls ----
test("blast88 (bytecode-read sv.a(ro)): a mob killed by a punched fireball rolls the puncher's Looting (it was 0)", () => {
  const { sim, ps: [p] } = server();
  hold(p, looted(3));
  const mobs = sim.mobs.mobs, z = mobs.create("zombie", 72.5, 10, 70.5); mobs.entities.push(z);
  const seen = [], attack = mobs.attackEntityFrom.bind(mobs);
  mobs.attackEntityFrom = (e, n, source) => { seen.push(source); return attack(e, n, source); };
  const fb = mobs.fireballs, ball = fb.launch({ large: true, owner: null, x: 72.5, y: 11, z: 70.5, exact: [1, 0, 0] });
  Object.assign(ball, { owner: "player", punchedBy: p });
  fb.impact(ball, { entity: z });
  assert.equal(seen[0].name, "fireball");
  assert.equal(seen[0].player, true);
  assert.equal(seen[0].looting, 3);
  const ghastBall = fb.launch({ large: true, owner: null, x: 72.5, y: 11, z: 70.5, exact: [1, 0, 0] });
  fb.impact(ghastBall, { entity: z });
  assert.equal(seen[1].looting, 0, "nobody's ball: no Looting");
});

test("blast88 (bytecode-read zp.a(azu)): an ownerless wither skull hits mobs AND players with magic 5, with no knockback; the owned one is unchanged", () => {
  const calls = [];
  const survival = { damage: (...a) => { calls.push(["player", ...a]); return true; }, scaledDamage: (...a) => { calls.push(["scaled", ...a]); return true; }, effects: { add() {} }, health: 20 };
  const mobs = { events: [], difficulty: 2, ai: { survival }, hazard: (e, n, name) => { calls.push(["hazard", n, name]); return true; }, damage: (...a) => { calls.push(["damage", ...a.slice(1)]); return true; } };
  const skulls = new WitherSkulls(mobs), zombie = { type: "zombie", health: 20 };
  skulls.impact({ owner: null, x: 1, y: 2, z: 3 }, { entity: zombie });
  skulls.impact({ owner: null, x: 1, y: 2, z: 3 }, { entity: { player: true } });
  assert.deepEqual(calls, [["hazard", 5, "magic"], ["player", 5, "magic", false]]);
  assert.equal(mobs.events.length, 2);
  for (const ev of mobs.events) assert.equal(ev.explode.source, null, "the skull is the exploder: not living, so a plain explosion (agw.c() null)");
  calls.length = 0;
  const wither = { type: "wither", x: 0, z: 0, health: 300 };
  skulls.impact({ owner: wither, x: 1, y: 2, z: 3 }, { entity: { player: true } });
  assert.equal(calls[0][0], "scaled");
  assert.equal(calls[0][3].from, wither);
});

// ---- 3. a player's TNT against players ----
function pvpBlast({ pvp = true, self = false } = {}) {
  const { sim, ps: [a, v] } = server(["Attacker", "Victim"]);
  sim.pvp = pvp; sim.difficulty = 3;
  sim.tick(); // ServerSurvival.attach (vitals, the join protection)
  for (const p of [a, v]) { p.survival.protection = 0; p.survival.difficulty = 3; }
  const target = self ? a : v;
  target.survival.health = 1;
  const calls = [], s = target.survival, damage = s.damage.bind(s), scaled = s.scaledDamage.bind(s);
  s.damage = (...args) => { calls.push(["damage", ...args]); return damage(...args); };
  s.scaledDamage = (...args) => { calls.push(["scaled", ...args]); return scaled(...args); };
  if (!self) a.position.copy({ x: 44.5, y: 10, z: 44.5 });
  const t = primedBy(sim, a, target.position.x + 1, 11, target.position.z + 1);
  const before = { ...target.velocity };
  sim.mobs.explode({ x: t.x, y: t.y, z: t.z, size: 4, source: t });
  sim.serverSurvival.settle(target); // the death step of the tick
  return { sim, a, v, target, calls, pushed: target.velocity.y !== before.y };
}

test("blast88 (bytecode-read ro.a(agw), rp.r(), mw.a(ro)): another player's TNT: explosion.player by him, unscaled on Hard, his kill (death message, killer, playerKills)", () => {
  const { sim, a, v, calls } = pvpBlast();
  assert.equal(calls.filter((c) => c[0] === "scaled").length, 0, "rp.r(): a player entity is not difficulty scaled");
  const hit = calls.find((c) => c[0] === "damage");
  assert.equal(hit[2], "an explosion");
  assert.equal(hit[4], "explosion");
  assert.equal(hit[5].isPlayer, true);
  assert.equal(hit[5].name, "Attacker");
  assert.equal(v.dead, true);
  const death = sim.events.find((e) => e.type === "death");
  assert.match(JSON.stringify(death.component), /death\.attack\.explosion\.player/);
  assert.match(JSON.stringify(death.component), /Attacker/);
  assert.equal(death.killer, a.id);
  assert.equal(a.stats.get(STAT.playerKills), 1);
});

test("blast88 (bytecode-read mw.a(ro, F)): with pvp off a player's TNT does not hurt other players (nor him), but the blast still pushes them", () => {
  const { v, pushed } = pvpBlast({ pvp: false });
  assert.equal(v.survival.health, 1);
  assert.equal(v.dead ?? false, false);
  assert.equal(pushed, true);
  const own = pvpBlast({ pvp: false, self: true });
  assert.equal(own.a.survival.health, 1);
});

test("blast88 (bytecode-read yz.b(sa, int)): his own TNT kills him as explosion.player by himself and counts a playerKill (no self test)", () => {
  const { sim, a } = pvpBlast({ self: true });
  assert.equal(a.dead, true);
  const death = sim.events.find((e) => e.type === "death");
  assert.match(JSON.stringify(death.component), /death\.attack\.explosion\.player/);
  assert.equal((JSON.stringify(death.component).match(/Attacker/g) ?? []).length >= 2, true);
  assert.equal(a.stats.get(STAT.playerKills), 1);
});

test("blast88: unplaced TNT on a server player is the plain scaled explosion with no source entity, so no knockback from the TNT itself; a creeper's is his", () => {
  const { sim, ps: [, v] } = server(["Attacker", "Victim"]);
  v.survival.protection = 0;
  const calls = [], s = v.survival, scaled = s.scaledDamage.bind(s);
  s.scaledDamage = (...args) => { calls.push(args); return scaled(...args); };
  sim.dispense.prime(v.position.x + 1, 10, v.position.z + 1, false, { fuse: 80, placer: null });
  const t = sim.dispense.primed.at(-1);
  sim.mobs.explode({ x: t.x, y: t.y, z: t.z, size: 4, source: t });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], "an explosion");
  assert.equal(calls[0][2].from, undefined);
  assert.equal((s.knockQueue ?? []).filter((k) => k.kind === "knock").length, 0);
  s.hurtTicks = 0; s.health = 20; s.knockQueue = [];
  const creeper = sim.mobs.mobs.create("creeper", v.position.x + 1, 10, v.position.z + 1);
  sim.mobs.explode({ x: creeper.x, y: creeper.y, z: creeper.z, size: 3, source: creeper });
  assert.equal(calls[1][2].from, creeper, "a living exploder is the source entity (scaled: rp.r() true)");
});

test("blast88: single player, his own TNT is explosion.player by himself (via self), unscaled; the knockback nudge ends with a constant random", () => {
  const calls = [], position = { x: 0.5, y: 0, z: 0.5 };
  const survival = { health: 20, creative: false, difficulty: 3, furnaces: {}, chests: {}, inventory: { armor: [] }, damage: (...a) => { calls.push(["damage", ...a]); return true; }, scaledDamage: (...a) => { calls.push(["scaled", ...a]); return true; } };
  const EMPTY = { get: (x, y) => (y < 0 ? 1 : 0), getMeta: () => 0, getState: () => undefined, solid: (x, y) => y < 0, set: () => true, isLoaded: () => true, isTicking: () => true, height: 256 };
  const state = { world: EMPTY, mobs: { entities: [] }, items: new ItemEntities(() => 0.5), xpOrbs: new ExperienceOrbs([], () => 0.5), arrows: new Arrows(() => 0.5), projectiles: null, falling: null, primed: [],
    survival, position, velocity: { x: 0, y: 0, z: 0 }, farming: { observe() {} }, eyes: { eyes: [] }, hooks: [], random: { nextFloat: () => 0.5, nextInt: () => 0, nextDouble: () => 0.5 } };
  applyExplosion(state, { x: 1.5, y: 0.5, z: 1.5, size: 4, attacker: "player", smoking: false });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "damage");
  assert.deepEqual(calls[0].slice(2, 5), ["an explosion", true, "explosion"]);
  assert.deepEqual(calls[0][6], { self: true });
  const v = { x: 0, y: 0, z: 0 };
  assert.equal(knockBack(v, { x: 1, z: 1 }, { x: 1, z: 1 }, () => 0.5, 0, () => 1), true, "a constant random no longer spins forever");
  assert.ok([v.x, v.y, v.z].every(Number.isFinite));
});

// ---- 4. the shooter is not saved ----
test("blast88 (bytecode-read ze.b(dh), ze.a(dh)): a saved fireball has no shooter, and a loaded one is nobody's", () => {
  const mobs = { entities: [{ id: "mob-3", health: 10, death: 0 }], random: () => 0.5 };
  const fb = new Fireballs(mobs), ball = fb.launch({ large: true, owner: null, x: 1, y: 2, z: 3, exact: [1, 0, 0] });
  ball.owner = "player";
  const saved = fb.serialize(0);
  assert.equal("owner" in saved[0], false);
  const again = new Fireballs(mobs);
  again.load([{ ...saved[0], owner: "player" }, { ...saved[0], owner: "mob-3" }], 0);
  assert.deepEqual(again.list.map((b) => b.owner), [null, null]);
});

// ---- 5. Looting off an arrow ----
test("blast88 (bytecode-read sv.a(ro), afv.i): a player's arrow kill takes the Looting of the item he holds at the hit, a mob's none", () => {
  const arrows = new Arrows(() => 0.5), calls = [];
  const zombie = { type: "zombie", health: 20, x: 0, z: 0 };
  const mobs = { entities: [zombie], damage: (...a) => { calls.push(a[6]); return true; } };
  arrows.damageTarget({ shooter: "player", fire: 0, x: 0, z: 0 }, zombie, 6, { mobs, survival: { held: looted(3) } });
  arrows.damageTarget({ shooter: "player", owner: { survival: { held: looted(2) } }, fire: 0, x: 0, z: 0 }, zombie, 6, { mobs, survival: null }); // the dedicated server's arrow
  arrows.damageTarget({ shooter: { type: "skeleton", x: 0, z: 0 }, fire: 0, x: 0, z: 0 }, zombie, 6, { mobs, survival: { held: looted(3) } });
  assert.deepEqual(calls.map((c) => c.looting), [3, 2, 0]);
});
