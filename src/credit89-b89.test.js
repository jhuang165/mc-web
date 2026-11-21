// b89 credit89: kill credit from the combat tracker, a respawned player's TNT, the look a punch reads, dispensed arrows and snowballs.
// Bytecode-read (javap -c -p on the 1.7.10 jar):
//   sv.aX (func_94060_bK): rn.c() (CombatTracker best) ?? aR (attackingPlayer) ?? i (revenge target). ro.b(sv) reads it for the ".player" texts; mw.a(ro) credits it.
//   sv.a(ro, F) 208-296: ro.j() an sv -> setRevengeTarget; a yz -> aS (recentlyHit) = 100, aR = it; a tamed wv -> aS = 100, aR = null. No alive test, top-up hits too.
//   sv.a(ro, F) 322: knockBack only when ro.j() != null, else attackedAtYaw from Math.random. sv.C 417-439: aS > 0 ? aS-- : aR = null.
//   rn.a(ro, F, F) / rn.g: a killing hit clears the earlier entries (executed: combat-tracker-reference.json), so a fatal fall after a player's hit names nobody in the tracker.
//   oi.a(mw, int, boolean) respawnPlayer: ahb.f(sa) (setDead) on the old mw and a new mw; primed TNT keeps the old one. oi.a(yz): the StatisticsFile keyed by UUID (shared).
//   ej (NetworkManager): one ConcurrentLinkedQueue polled in order, so a C02 runs after the C03 sent before it (nh.a(jd) 625-678 sets the rotation). ze.a(ro, F) 14-24: ro.j().ag().
//   zc.b(dh) / zc.a(dh): EntityArrow NBT has no shooter key. zj.a: ro.a(sa, sa) = new rq("thrown", ball, thrower); rq.j() is the thrower, null for a dispensed ball.
import { test } from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { langReady } from "./chat-component.js";
import { CombatTracker, damageSource } from "./combat-tracker.js";
import { EntityWorld } from "./entities.js";
import { Projectiles, thrownHit } from "./projectiles.js";
import { STAT } from "./stats.js";

await langReady;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });

function server(names = ["Attacker", "Victim"]) {
  const world = new World("b89-credit");
  for (let x = 30; x <= 100; x++) for (let z = 30; z <= 100; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode: "survival" });
  sim.mobs.spawning = false; sim.mobs.mobs.entities.length = 0;
  const ps = names.map((name, i) => {
    const p = sim.addPlayer("p" + i, name, key(i + 1));
    p.position.copy({ x: 64.5 + i, y: 10, z: 64.5 }); p.previous.copy(p.position);
    sim.input("p" + i, input());
    return p;
  });
  for (let i = 0; i < 3; i++) sim.tick();
  for (const p of ps) p.survival.protection = 0;
  return { sim, ps };
}
const deathOf = (sim, id) => sim.events.find((e) => e.type === "death" && (id === undefined || e.id === id));

// ---- 1. sv.aX: the tracker, else attackingPlayer, else the revenge target ----
const PLAYER = { type: "player", isPlayer: true, name: "Attacker", playerId: "p0", x: 0, z: 0 };
const ZOMBIE = { type: "zombie", x: 1, z: 1 };
const hit = (t, src, tick, alive = true, damage = 2) => { t.record(src, 20, damage, tick, { alive }); t.noteAttacker(src, tick); };

test("credit89 (bytecode-read sv.aX, sv.a(ro, F) 208-296): a player's hit, then a zombie's, then fatal fire: the tracker is empty, attackingPlayer names the player over the zombie's revenge", () => {
  const t = new CombatTracker();
  hit(t, damageSource("player", "player", PLAYER), 1);
  hit(t, damageSource("a zombie", "mob", ZOMBIE), 12);
  hit(t, damageSource("burning"), 20, false);
  assert.equal(t.entries.length, 1, "rn.g: the killing hit cleared the earlier entries");
  assert.equal(t.killer(), null);
  assert.equal(t.revenge.entity.raw, ZOMBIE, "the revenge target is the zombie");
  assert.equal(t.fighter().raw, PLAYER, "aR wins over i (it used to be the zombie)");
});

test("credit89 (bytecode-read sv.C 417-439): attackingPlayer lasts while recentlyHit counts down from 100, and goes on the tick after it ran out", () => {
  const t = new CombatTracker();
  hit(t, damageSource("player", "player", PLAYER), 0);
  for (let i = 1; i <= 100; i++) t.tick(i);
  assert.equal(t.recentlyHit, 0);
  assert.equal(t.attackingPlayer?.raw, PLAYER, "aS reached 0 this tick; aR is cleared only by the next");
  t.tick(101);
  assert.equal(t.attackingPlayer, null);
  hit(t, damageSource("player", "player", PLAYER), 102);
  hit(t, damageSource("a wolf", "mob", { type: "wolf", tamed: true, x: 0, z: 0 }), 110);
  assert.equal(t.recentlyHit, 100, "a tamed wolf's hit sets recentlyHit");
  assert.equal(t.attackingPlayer, null, "... and clears attackingPlayer");
  const wild = new CombatTracker();
  hit(wild, damageSource("a wolf", "mob", { type: "wolf", x: 0, z: 0 }), 1);
  assert.equal(wild.recentlyHit, 0, "a wild wolf is only the revenge target");
});

test("credit89 (bytecode-read mw.a(ro), sv.aX): on the server a fatal fall after a player's punch credits him (killer, playerKills); the text is the plain fall one", () => {
  const { sim, ps: [a, v] } = server();
  assert.equal(sim.pvpRules.attack(a, "p1"), true);
  sim.tick();
  assert.ok(v.survival.health < 20 && !v.dead);
  for (let i = 0; i < 12; i++) sim.tick();
  sim.damagePlayer(v, 1, { name: "a zombie", from: { x: 60, z: 64, type: "zombie" } }); // a mob in between becomes the revenge target
  sim.damagePlayer(v, 50, { name: "a fall" });
  sim.tick();
  assert.equal(v.dead, true);
  const death = deathOf(sim), text = JSON.stringify(death.component);
  assert.equal(death.killer, "p0", "it was undefined: the last blow (the fall) has no entity");
  assert.doesNotMatch(text, /death\.attack\.(player|mob)/);
  assert.doesNotMatch(text, /Attacker/, "the tracker is empty at death, so no assist text");
  assert.equal(a.stats.get(STAT.playerKills), 1);
});

test("credit89: a punch more than 100 of the victim's ticks before the fatal fall credits nobody", () => {
  const { sim, ps: [a, v] } = server();
  assert.equal(sim.pvpRules.attack(a, "p1"), true);
  for (let i = 0; i < 103; i++) sim.tick();
  sim.damagePlayer(v, 50, { name: "a fall" });
  sim.tick();
  assert.equal(v.dead, true);
  assert.equal(deathOf(sim).killer, undefined);
  assert.equal(a.stats.get(STAT.playerKills) | 0, 0);
});

// ---- 2. a respawned placer's TNT ----
test("credit89 (bytecode-read oi.a(mw, int, boolean), oi.a(yz), yz.b(sa, int)): TNT placed before death acts from the dead body; the kill still counts for the record", () => {
  const { sim, ps: [a, v] } = server();
  a.position.copy({ x: 44.5, y: 10, z: 44.5 }); a.previous.copy(a.position);
  sim.dispense.prime(v.position.x + 1, 11, v.position.z + 1, false, { fuse: 80, placer: a });
  const t = sim.dispense.primed.at(-1);
  sim.damagePlayer(a, 50, { name: "a fall" }); sim.serverSurvival.settle(a);
  assert.equal(a.dead, true);
  assert.equal(sim.serverSurvival.respawn(a), true);
  assert.notEqual(t.placer, a, "the record is the new body; the TNT keeps the old one");
  assert.equal(t.placer.corpseOf, a);
  assert.deepEqual(t.placer.position, { x: 44.5, y: 10, z: 44.5 });
  assert.equal(t.placer.survival.held, null, "dropAllItems emptied the old body's hands");
  assert.notDeepEqual({ x: a.position.x, z: a.position.z }, { x: 44.5, z: 44.5 });
  v.survival.health = 1;
  const calls = [], s = v.survival, damage = s.damage.bind(s);
  s.damage = (...args) => { calls.push(args); return damage(...args); };
  const kills = a.stats.get(STAT.playerKills) | 0;
  sim.mobs.explode({ x: t.x, y: t.y, z: t.z, size: 4, source: t });
  sim.serverSurvival.settle(v);
  const blast = calls.find((c) => c[0] > 0 && c[3] === "explosion");
  assert.equal(blast[4].name, "Attacker");
  assert.deepEqual([blast[4].x, blast[4].z], [44.5, 44.5], "the knockback origin is where the old body was removed");
  assert.equal(v.dead, true);
  const death = deathOf(sim, v.id);
  assert.match(JSON.stringify(death.component), /death\.attack\.explosion\.player/);
  assert.equal(death.killer, a.id);
  assert.equal((a.stats.get(STAT.playerKills) | 0) - kills, 1, "the shared StatisticsFile");
  assert.equal(sim.serverSurvival.leaveBody(a), null, "nothing left to hand over");
});

// ---- 3. the punch reads the look the click arrived with ----
test("credit89 (bytecode-read ej, nh.a(jd), ze.a(ro, F)): a queued click keeps the look of its arrival, and punchBall deflects along that look", () => {
  const { sim, ps: [p] } = server(["Puncher"]);
  Object.assign(p, { yaw: 0, pitch: 0 });
  sim.queueDig("p0", 0);
  Object.assign(p, { yaw: Math.PI, pitch: 0 }); // a C03 that arrived after the C07
  assert.deepEqual(sim.actions.at(-1).look, { yaw: 0, pitch: 0 });
  sim.actions.length = 0;
  sim.queueEdit("p0", { place: false });
  assert.deepEqual(sim.actions.at(-1).look, { yaw: Math.PI, pitch: 0 });
  sim.actions.length = 0;
  const fb = sim.mobs.mobs.fireballs, launch = () => fb.launch({ large: true, owner: null, x: p.position.x, y: p.position.y + 1.62, z: p.position.z - 2, exact: [0, 0, 1] });
  const ball = launch();
  assert.equal(sim.mobs.punchBall(p), false, "the later look (facing +z) misses the ball at -z");
  assert.equal(sim.mobs.punchBall(p, { yaw: 0, pitch: 0 }), true, "the look of the click (facing -z) hits it");
  assert.equal(ball.punchedBy, p);
  assert.ok(ball.az < 0, "deflected along the click's look");
});

// ---- 4. dispensed arrows are nobody's after a reload ----
test("credit89 (bytecode-read zc.b(dh), zc.a(dh)): a saved arrow has no shooter; an old save's `by` is ignored", () => {
  const { sim, ps: [p] } = server(["Archer"]);
  const arrows = sim.dispense.arrows;
  arrows.list.push(arrows.make({ x: 70.5, y: 12, z: 70.5, mx: 0, my: 0, mz: 1, yaw: 0, pitch: 0 }, arrows.rng(), { shooter: "player", pickup: 1, owner: p, ownerName: p.name }));
  const data = JSON.parse(JSON.stringify(sim.dispense.save()));
  assert.equal(data.lanes[0].arrows[0].by, undefined);
  data.lanes[0].arrows[0].by = p.name; // written before batch 89
  const u = server(["Archer"]).sim;
  u.dispense.load(data);
  assert.equal(u.dispense.arrows.list.length, 1);
  assert.equal(u.dispense.arrows.list[0].shooter, null);
  assert.equal(u.dispense.arrows.list[0].ownerName, undefined);
});

// ---- 5. a dispensed snowball is causeThrownDamage(ball, null) ----
const stubWorld = (...entities) => Object.assign(Object.create(EntityWorld.prototype), { entities, events: [], clientSounds: [], fishStates: new Map(), mathRandom: () => 0.5 });
const mob = (type, extra = {}) => ({ type, health: 20, hurt: 0, flee: 0, x: 5, y: 10, z: 5, yaw: 0, vx: 0, vy: 0, vz: 0, age: 0, ...extra });

test("credit89 (bytecode-read zj.a, rq.j, sv.a(ro, F)): a dispensed snowball hurts with no attacker: no recentlyHit, no revenge, no knockback; 3 on a blaze", () => {
  const pig = mob("pig"), blaze = mob("blaze"), fish = mob("silverfish", { health: 8 }), w = stubWorld(pig, blaze, fish);
  const ball = { kind: "snowball", dispensed: true, x: 5, y: 10, z: 8 };
  assert.equal(thrownHit(w, pig, { x: 5, y: 10, z: 8 }, ball), true);
  assert.equal(pig.hurt, 10);
  assert.equal(pig.recentlyHit ?? 0, 0, "it was 100: the dispenser counted as the player");
  assert.equal(pig.revenge ?? 0, 0);
  assert.deepEqual([pig.vx, pig.vy, pig.vz], [0, 0, 0], "no source entity, no knockBack");
  assert.equal(w.events.at(-1).sound, "mob.pig.say");
  thrownHit(w, blaze, null, { kind: "snowball" }); // the server's ownerless ball (server-dispense.js ballHit)
  assert.equal(blaze.health, 17);
  assert.equal(blaze.recentlyHit ?? 0, 0);
  thrownHit(w, fish, null, { kind: "snowball" });
  assert.equal(fish.summonCooldown, 20, "yk.a: a thrown source is an EntityDamageSource even without a thrower");
  const thrown = mob("pig"), v = stubWorld(thrown);
  thrownHit(v, thrown, { x: 5, y: 10, z: 8 }, { kind: "snowball" });
  assert.equal(thrown.recentlyHit, 100, "the player's own ball is unchanged");
  assert.ok(thrown.vz < 0);
});

test("credit89: the dispensed mark survives a browser save, and the server's ownerless ball takes the same path", () => {
  const p = new Projectiles(() => 0.5);
  p.load([{ x: 1, y: 20, z: 1, mx: 0, my: 0, mz: 1, yaw: 0, pitch: 0, dispensed: true }, { x: 1, y: 20, z: 1, mx: 0, my: 0, mz: 1, yaw: 0, pitch: 0 }]);
  assert.deepEqual(p.balls.map((b) => !!b.dispensed), [true, false]);
  assert.deepEqual(p.serialize().map((b) => b.dispensed), [true, undefined]);
  const { sim } = server(["Nobody"]);
  const pig = sim.mobs.mobs.create("pig", 70.5, 10, 70.5); sim.mobs.mobs.entities.push(pig);
  const ball = sim.dispense.balls.spawnThrowable({ x: 70.5, y: 10, z: 68 }, 0, 0, "snowball");
  assert.equal(sim.dispense.ownerOf(ball) ?? null, null);
  assert.equal(sim.dispense.ballHit(sim.mobs.mobs, pig, ball), true);
  assert.equal(pig.recentlyHit ?? 0, 0);
  assert.deepEqual([pig.vx, pig.vz], [0, 0]);
});
