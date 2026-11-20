// b87 blast87: the player's place in Explosion.doExplosionA's list and the dedicated server's player TNT.
// Executed: tools/probes/BlastOrderProbe.java case "feet" (200 scenes in public/research/blast-order-reference.json, made by tools/verify-blast-order.mjs): an EntityPlayerMP-like
// player (yOffset 0, so posY is the feet) whose feet and eye (posY + 1.62) fall in different vertical slices in most scenes, moved across slice borders by the feet alone,
// with items, orbs, arrows, TNT, zombies, pigs and an ender crystal. World.getEntitiesWithinAABBExcludingEntity walks the slices floor(posY / 16), so the port must file him by
// the feet (candidate-order.js stampPlayerCell, explosion-simulation.js applyExplosion's player row).
// Bytecode-read (javap -c -p on the 1.7.10 jar): ro.a(agw) setExplosionSource gives "explosion.player" (rp) with agw.c(), the TNT's placer, as getEntity; sv.a(ro, F) sets
// recentlyHit 100 and attackingPlayer from a yz source entity; sv.a(ro) credits onKillEntity and takes EnchantmentHelper.getLootingModifier from it; aob.a(ahb,III,sa) passes
// zc.c to func_150114_a when it is an sv (a skeleton's burning arrow); ze.a(ro, F) turns a large fireball to the source entity's getLookVec and makes it its shooter.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyExplosion } from "./explosion-simulation.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs, newOrb } from "./experience.js";
import { Arrows } from "./bow.js";
import { primeTnt, TNT_Y_OFFSET } from "./explosion.js";
import { stampEntity, stampPlayerCell, forgetEntity, walkedY, orderTargets } from "./candidate-order.js";
import { World, TNT } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ITEMS } from "./survival.js";
import { langReady } from "./chat-component.js";
import { lookVector, deflect } from "./blaze-ghast.js";
import { mhSin, mhCos } from "./lighting.js";
import { STAT } from "./stats.js";
import { buildOcelotTasks } from "./ocelot-ai.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/blast-order-reference.json", import.meta.url), "utf8"));
const recs = reference.records.filter((x) => x.case === "feet");
const MOTION = { item: ["mx", "my", "mz"], arrow: ["mx", "my", "mz"], orb: ["vx", "vy", "vz"], tnt: ["vx", "vy", "vz"], crystal: ["vx", "vy", "vz"] };
const LIVING = new Set(["zombie", "pig"]);
const EMPTY = { get: (x, y) => (y < 0 ? 1 : 0), getMeta: () => 0, getState: () => undefined, solid: (x, y) => y < 0, set: () => true, isLoaded: () => true, isTicking: () => true, height: 256 };

// `eyeFiled`: file the player by his eye (the pre-b87 rule), to show that the scenes tell the two apart.
function scene(r, eyeFiled) {
  const events = [], items = new ItemEntities(() => 0.5), xpOrbs = new ExperienceOrbs([], () => 0.5), arrows = new Arrows(() => 0.5), primed = [], mobs = { entities: [] };
  const position = { x: 0, y: -100, z: 0 }, serverPlayer = { motion: { x: 0, y: 0, z: 0 } };
  const survival = { health: 0, creative: false, furnaces: {}, chests: {}, inventory: { armor: [] }, serverPlayer };
  let depth = 0;
  const watch = (e, field, i) => { let v = e[field]; Object.defineProperty(e, field, { get: () => v, set: (n) => { v = n; events.push(["h", depth, i]); }, configurable: true, enumerable: true }); };
  const state = { world: EMPTY, random: undefined, mobs, items, xpOrbs, arrows, projectiles: null, falling: null, primed, survival, position, velocity: { x: 0, y: 0, z: 0 }, farming: { observe() {} }, eyes: { eyes: [] }, hooks: [] };
  const boom = (x, y, z, size) => applyExplosion({ ...state, random: { nextFloat: () => 0.5, nextInt: () => 0, nextDouble: () => 0.5 } }, { x, y, z, size, smoking: false });
  const hurt = (e, damage) => {
    if (!(e.health > 0)) return;
    events.push(["h", depth, e.index], ["dmg", depth, e.index, damage]);
    if (e.type !== "ender_crystal") return;
    e.health = 0; depth++;
    try { boom(e.x, e.y, e.z, 6); } finally { depth--; }
  };
  mobs.hazard = hurt; mobs.damage = hurt;
  const ents = r.ents.map(([kind, x, y, z], i) => {
    let e;
    if (kind === "player") {
      Object.assign(position, { x, y, z });
      Object.assign(survival, { health: 1000, scaledDamage: (damage) => { events.push(["h", depth, i], ["dmg", depth, i, damage]); return false; } });
      return "player";
    }
    if (kind === "item") { e = items.spawn({ id: 1, count: 1, damage: 0 }, x, y, z, { motion: [0, 0, 0] }); watch(e, "mx", i); }
    else if (kind === "orb") { e = newOrb(3, x, y, z, () => 0.5); xpOrbs.orbs.push(e); watch(e, "vx", i); }
    else if (kind === "arrow") { e = { x, y, z, mx: 0, my: 0, mz: 0 }; arrows.list.push(e); watch(e, "mx", i); }
    else if (kind === "tnt") { e = primeTnt(x, y, z, { random: () => 0.5 }); primed.push(e); watch(e, "vx", i); }
    else if (kind === "crystal") { e = { type: "ender_crystal", index: i, x, y, z, vx: 0, vy: 0, vz: 0, health: 5, growingAge: 0 }; mobs.entities.push(e); }
    else if (LIVING.has(kind)) { e = { type: kind, index: i, x, y, z, vx: 0, vy: 0, vz: 0, health: 1000, growingAge: 0 }; mobs.entities.push(e); }
    for (const k of MOTION[kind] ?? []) e[k] = 0;
    return e;
  });
  const stamp = (i) => {
    if (ents[i] !== "player") return stampEntity(ents[i], ents[i].x, walkedY(ents[i]), ents[i].z);
    if (eyeFiled) return stampEntity("player", position.x, position.y + 1.62, position.z, true);
    return stampPlayerCell(position);
  };
  const place = (i, [x, y, z]) => {
    const e = ents[i], kind = r.ents[i][0];
    if (kind === "player") return Object.assign(position, { x, y, z });
    if (kind === "item") return Object.assign(e, { x, y: y - 0.125, z });
    if (kind === "orb") { const o = newOrb(3, x, y, z, () => 0.5); return Object.assign(e, { x, y: o.y, posY: y, z, bb: o.bb }); }
    if (kind === "tnt") return Object.assign(e, { x, y: y - TNT_Y_OFFSET, z });
    return Object.assign(e, { x, y, z });
  };
  events.length = 0;
  return { events, ents, stamp, place, boom, serverPlayer };
}
function replay(r, eyeFiled = false) {
  forgetEntity("player");
  const s = scene(r, eyeFiled);
  for (const op of r.ops) { if (op[0] === "move") s.place(op[1], op[2]); s.stamp(op[1]); }
  s.boom(...r.centre, r.size);
  return s;
}
const motionOf = (s, r) => s.ents.map((e, i) => {
  const kind = r.ents[i][0];
  if (r.dead[i]) return null;
  if (kind === "player") return [s.serverPlayer.motion.x, s.serverPlayer.motion.y, s.serverPlayer.motion.z];
  return (MOTION[kind] ?? ["vx", "vy", "vz"]).map((k) => e[k]);
});
const deadOf = (s, r) => s.ents.map((e, i) => { const k = r.ents[i][0]; return k === "player" || LIVING.has(k) ? false : k === "crystal" ? e.health <= 0 : e.dead === true; });
const same = (s, r) => JSON.stringify({ events: s.events, motion: motionOf(s, r), dead: deadOf(s, r) }) === JSON.stringify({ events: r.events, motion: r.motion.map((m, i) => (r.dead[i] ? null : m)), dead: r.dead });

test("blast87 (executed): the player filed by his feet: hits, damage, pushes and deaths match native in every feet scene", () => {
  assert.equal(recs.length, 200);
  const bad = recs.filter((r) => !same(replay(r), r));
  assert.equal(bad.length, 0, `${bad.length} mismatches; first: ${JSON.stringify(bad[0])}`);
});

test("blast87: the feet scenes tell feet filing from eye filing (the eye rule misorders 26 of them)", () => {
  const straddle = recs.filter((r) => { const [, , y] = r.ents[0]; return Math.floor(y / 16) !== Math.floor((y + 1.62) / 16); }).length;
  assert.ok(straddle >= 150, `${straddle} scenes start with feet and eye in different slices`);
  const eyeBad = recs.filter((r) => !same(replay(r, true), r)).length;
  assert.ok(eyeBad >= 20, `only ${eyeBad} scenes differ under eye filing`);
});

test("blast87: stampPlayerCell and a player candidate's box file him by posY, the feet, not the eye", () => {
  forgetEntity("player");
  const a = { x: 0.5, y: 15.5, z: 0.5 }, b = { x: 0.6, y: 10, z: 0.5 }; // the feet in slice 0, the eye (17.12) in slice 1; b in slice 0
  stampPlayerCell(a);
  stampEntity(b, b.x, b.y, b.z);
  const player = { ref: "player", box: [0.2, 15.5, 0.2, 0.8, 17.3, 0.8] }, other = { ref: b, box: [0.5, 10, 0.4, 0.7, 10.2, 0.6] };
  assert.deepEqual(orderTargets([other, player]).map((t) => t.ref), ["player", b], "one slice: the player, who joined first, is listed first");
  stampEntity("player", a.x, a.y + 1.62, a.z, true); // the old eye filing put him in slice 1, after b
  assert.deepEqual(orderTargets([other, { ref: "player", pos: [a.x, a.y + 1.62, a.z] }]).map((t) => t.ref), [b, "player"]);
  forgetEntity("player"); forgetEntity(b);
});

// ---- the dedicated server ----
await langReady;
const FLINT = Number(Object.keys(ITEMS).find((k) => ITEMS[k]?.kind === "flint_and_steel"));
function server() {
  const world = new World("b87-blast");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode: "survival" });
  sim.mobs.mobs.entities.length = 0;
  const p = sim.addPlayer("a", "Alex", "00000000-0000-0000-0000-000000000001"); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  world.put(64, 11, 63, TNT, 0, false);
  p.survival.inventory.main.fill(null); p.survival.add(FLINT, 1);
  Object.assign(p, { yaw: 0, pitch: 0, moved: true }); // looking north at the TNT block
  return { sim, p, world };
}
// The player's TNT, moved off to (x, 11, z) with him out of its reach.
function playerTnt(sim, p, x, z) {
  assert.equal(sim.edit(p, true), true);
  const t = sim.dispense.primed[0];
  assert.equal(t.placer, p);
  Object.assign(t, { x, z });
  p.position.copy({ x: 44.5, y: 10, z: 44.5 }); p.previous.copy(p.position);
  return t;
}

test("blast87 (bytecode-read ze.a(ro, F)): a large fireball in a server player's TNT blast turns to his look and becomes his (owner \"player\", punchedBy)", () => {
  const { sim, p } = server();
  const t = playerTnt(sim, p, 70.5, 70.5);
  Object.assign(p, { yaw: 0.7, pitch: -0.3 });
  const fb = sim.mobs.mobs.fireballs, ball = fb.launch({ large: true, owner: null, x: 71.5, y: 12, z: 71.5, exact: [1, 0, 0] });
  const twin = { ...ball };
  sim.mobs.explode({ x: t.x, y: t.y, z: t.z, size: 4, source: t });
  deflect(twin, lookVector(Math.fround(180 - (0.7 * 180) / Math.PI), Math.fround((0.3 * 180) / Math.PI), mhSin, mhCos)); // the port's radians to rotationYaw / rotationPitch
  assert.equal(ball.owner, "player");
  assert.equal(ball.punchedBy, p);
  for (const k of ["ax", "ay", "az"]) if (k in twin) assert.equal(ball[k], twin[k], k);
  assert.ok([ball.ax, ball.ay, ball.az].every(Number.isFinite));
});

function zombieKill(placed) {
  const { sim, p } = server();
  const t = placed ? playerTnt(sim, p, 70.5, 70.5) : (sim.dispense.host(() => {}).spawnTnt(70, 11, 70), sim.dispense.primed[0]);
  if (!placed) p.position.copy({ x: 44.5, y: 10, z: 44.5 });
  const z = sim.mobs.mobs.create("zombie", 72.5, 10, 70.5); z.health = 1; sim.mobs.mobs.entities.push(z);
  const calls = [], mobs = sim.mobs.mobs, damage = mobs.damage.bind(mobs), hazard = mobs.hazard.bind(mobs);
  mobs.damage = (e, ...a) => { calls.push(["damage", ...a]); return damage(e, ...a); };
  mobs.hazard = (e, ...a) => { calls.push(["hazard", ...a]); return hazard(e, ...a); };
  const orbs = () => sim.serverItems.xp.orbs.reduce((n, o) => n + o.value, 0);
  sim.mobs.explode({ x: t.x, y: t.y, z: t.z, size: 4, source: t });
  const recentlyHit = z.recentlyHit;
  for (let i = 0; i < 25; i++) sim.tick();
  return { sim, p, z, calls, recentlyHit, xp: orbs() };
}

test("blast87 (bytecode-read ro.a(agw), sv.a(ro, F), sv.a(ro)): a mob killed by a server player's TNT is his kill: recentlyHit, the kill stats and the XP", () => {
  const { p, z, calls, recentlyHit, xp } = zombieKill(true);
  assert.ok(z.health <= 0);
  assert.equal(calls[0][0], "damage");
  assert.equal(calls[0][4], true, "byPlayer: the source entity is the placer");
  assert.equal(calls[0][6].name, "explosion", "explosion.player keeps its explosion flag (Blast Protection)");
  assert.equal(calls[0][6].looting, 0);
  assert.equal(recentlyHit, 100);
  assert.equal(p.stats.get(STAT.mobKills), 1);
  assert.equal(p.stats.get("stat.killEntity.Zombie"), 1);
  assert.ok(xp > 0, "EntityLiving.onDeathUpdate drops XP when recentlyHit > 0");
});

test("blast87 (bytecode-read): dispensed TNT has no placer: a plain \"explosion\" with no source entity, no credit, no XP, no knockback", () => {
  const { p, z, calls, recentlyHit, xp } = zombieKill(false);
  assert.ok(z.health <= 0);
  assert.equal(calls[0][0], "hazard");
  assert.equal(recentlyHit, 0);
  assert.equal(p.stats.get(STAT.mobKills) ?? 0, 0);
  assert.equal(xp, 0);
});

test("blast87 (bytecode-read aob.a(ahb,III,sa)): a skeleton's burning arrow primes server TNT with the skeleton as placer", () => {
  const { sim, p } = server();
  p.position.copy({ x: 44.5, y: 10, z: 44.5 }); p.previous.copy(p.position);
  const skel = sim.mobs.mobs.create("skeleton", 64.5, 10, 68.5); sim.mobs.mobs.entities.push(skel);
  const arrows = sim.dispense.arrows, a = arrows.make({ x: 64.5, y: 11.5, z: 65.5, mx: 0, my: 0, mz: -1.5, yaw: 0, pitch: 0 }, arrows.rng(), { shooter: skel, fire: 100 });
  arrows.list.push(a);
  for (let i = 0; i < 4 && !sim.dispense.primed.length; i++) sim.tick();
  assert.equal(sim.dispense.primed.length, 1);
  assert.equal(sim.dispense.primed[0].placer, skel);
});

// ---- the ocelot's temptation reads the player's look in degrees ----
test("blast87: OcelotTempt compares the player's rotationYaw / rotationPitch in degrees (main.js playerLook): a 4 degree turn keeps a scared cat tempted, 6 breaks it", () => {
  class Task { constructor() { this.mutex = 0; } }
  class Tempt extends Task { constructor() { super(); } startExecuting() {} resetTask() {} }
  const Any = class extends Task { constructor() { super(); } };
  const added = [], player = { x: 0.5, y: 64, z: 2.5, alive: true, held: 701 };
  let look = { yaw: 3, pitch: -2 };
  const m = {
    e: { type: "ocelot" }, x: 0.5, y: 64, z: 0.5, rand: { nextInt: () => 1, nextDouble: () => 0.5, nextFloat: () => 0.5 },
    ai: { deps: {}, player, ew: { playerLook: () => look }, closestPlayer: () => player, world: { get: () => 0 } },
    navigator: { setAvoidsWater() {} }, moveHelper: {}, tasks: { add: (n, t) => added.push([n, t]) }, targets: { add() {} },
    distSq: (q) => (q.x - m.x) ** 2 + (q.y - m.y) ** 2 + (q.z - m.z) ** 2, nearby: () => [],
  };
  buildOcelotTasks(m, { Task, TargetBase: Any, Swim: Any, Wander: Any, WatchClosest: Any, Mate: Any, Tempt, Leap: Any });
  const tempt = added.find(([n]) => n === 3)[1];
  assert.equal(tempt.shouldExecute(), true);
  tempt.startExecuting();
  assert.equal(tempt.continueExecuting(), true);
  look = { yaw: 7, pitch: 1 };
  assert.equal(tempt.continueExecuting(), true, "4 degrees of yaw, 3 of pitch: within vk's 5");
  look = { yaw: 13, pitch: 1 };
  assert.equal(tempt.continueExecuting(), false, "6 degrees: the scared cat gives up");
});
