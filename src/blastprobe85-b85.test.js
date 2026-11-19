// b85 blastprobe85: Explosion.doExplosionA over real chunks with an EntityDragon (body xa + its seven wy parts, attackEntityFromPart), hanging entities (paintings, item frames with and
// without an item, leash knots; the exploder's placer decides the drop) and ender crystals on the reach gate. Executed: tools/probes/BlastOrderProbe.java (cases "dragon", "hang",
// "crystal" of public/research/blast-order-reference.json, made by tools/verify-blast-order.mjs), the unchanged agw.a() with real EntityDragon/EntityPainting/EntityItemFrame/
// EntityLeashKnot/EntityEnderCrystal; each case replayed through applyExplosion with the port's entity systems.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyExplosion } from "./explosion-simulation.js";
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs, newOrb } from "./experience.js";
import { Arrows } from "./bow.js";
import { primeTnt } from "./explosion.js";
import { createEye } from "./eye-of-ender.js";
import { stampEntity, forgetEntity, walkedY } from "./candidate-order.js";
import { Hanging, ARTS, PAINTING_ITEM, FRAME_ITEM, ORIGINAL_PAINTING, ORIGINAL_FRAME } from "./hanging.js";
import { createDragonState, attackFromPart, partBox, PART_SIZES } from "./dragon.js";
import { installDragonMobs } from "./dragon-mobs.js";
import { JavaRandom } from "./java-random.js";

installDragonMobs(class {}); // registers the ender_dragon entity type
const reference = JSON.parse(readFileSync(new URL("../public/research/blast-order-reference.json", import.meta.url), "utf8"));
const air = () => ({ get: (x, y) => (y < 0 ? 1 : 0), getMeta: () => 0, solid: (x, y) => y < 0, set: () => true, isLoaded: () => true, isTicking: () => true, height: 256 });
const NATIVE_ID = { [PAINTING_ITEM]: ORIGINAL_PAINTING, [FRAME_ITEM]: ORIGINAL_FRAME };
const MOTION = { eye: ["vx", "vy", "vz"], hook: ["vx", "vy", "vz"], item: ["mx", "my", "mz"], arrow: ["mx", "my", "mz"], orb: ["vx", "vy", "vz"], tnt: ["vx", "vy", "vz"], crystal: ["vx", "vy", "vz"], dragon: ["vx", "vy", "vz"] };

// The port's entities of one record; `events` collects the native log's entries in the same shape (see BlastOrderProbe evs).
function scene(r) {
  const events = [], world = air(), items = new ItemEntities(() => 0.5), xpOrbs = new ExperienceOrbs([], () => 0.5), arrows = new Arrows(() => 0.5), primed = [];
  const eyes = { eyes: [] }, hookList = [];
  const hanging = new Hanging({ random: () => new JavaRandom(1) });
  const mobs = { entities: [], knotList: [], knotAttack(k) { if (k.dead) return false; events.push(["h", depth, k.index]); k.dead = true; return true; } };
  const position = { x: 0, y: -100, z: 0 }, survival = { health: 0, creative: r.exploder === 2, furnaces: {}, chests: {}, inventory: { armor: [] } };
  let depth = 0;
  const idx = new Map();
  const watch = (e, field, i, tag = "h") => { let v = e[field]; Object.defineProperty(e, field, { get: () => v, set: (n) => { v = n; if (tag) events.push([tag, depth, i]); }, configurable: true, enumerable: true }); };
  const state = { world, random: undefined, mobs, items, xpOrbs, arrows, projectiles: null, falling: null, primed, survival, position, velocity: { x: 0, y: 0, z: 0 }, farming: { observe() {} }, hanging, eyes, hooks: hookList };
  let cur = -1;
  const hooks = { vehicleDrop: (d) => events.push(["drop", depth, cur, NATIVE_ID[d.stack.id] ?? d.stack.id, d.stack.count, d.x, d.posY, d.z]) };
  const boom = (x, y, z, size, request = {}) => applyExplosion({ ...state, random: { nextFloat: () => 0.5, nextInt: () => 0, nextDouble: () => 0.5 } }, { x, y, z, size, ...request }, hooks);
  const hurt = (e) => { if (!(e.health > 0)) return; events.push(["h", depth, e.index]); cur = e.index; e.health = 0; depth++; try { boom(e.x, e.y, e.z, 6); } finally { depth--; } };
  mobs.hazard = hurt; mobs.damage = hurt;
  const attack = hanging.attack.bind(hanging);
  hanging.attack = (e, by) => { if (!e.dead) { cur = idx.get(e); events.push(["h", depth, cur]); } return attack(e, by); };
  const ents = r.ents.map((spec, i) => {
    const [kind, x, y, z] = spec;
    let e;
    if (kind === "item") { e = items.spawn({ id: 1, count: 1, damage: 0 }, x, y, z, { motion: [0, 0, 0] }); watch(e, "mx", i); }
    else if (kind === "orb") { e = newOrb(3, x, y, z, () => 0.5); xpOrbs.orbs.push(e); watch(e, "vx", i); }
    else if (kind === "arrow") { e = { x, y, z, mx: 0, my: 0, mz: 0 }; arrows.list.push(e); watch(e, "mx", i); }
    else if (kind === "tnt") { e = primeTnt(x, y, z, { random: () => 0.5 }); primed.push(e); watch(e, "vx", i); }
    else if (kind === "crystal") { e = { type: "ender_crystal", index: i, x, y, z, vx: 0, vy: 0, vz: 0, health: 5, growingAge: 0 }; mobs.entities.push(e); }
    else if (kind === "eye") { e = createEye(x, y, z); eyes.eyes.push(e); watch(e, "vx", i); }
    else if (kind === "hook") { const h = 0.125; e = { x, y, z, vx: 0, vy: 0, vz: 0, bb: [x - h, y, z - h, x + h, y + 0.25, z + h], dead: false }; hookList.push(e); watch(e, "vx", i); }
    else if (kind === "dragon") {
      const [, , , , yaw, health, seed, parts] = spec;
      e = { type: "ender_dragon", id: i + 1, index: i, x, y, z, vx: 0, vy: 0, vz: 0, health, rotationYaw: yaw, growingAge: 0 };
      const s = createDragonState(e);
      parts.forEach(([px, py, pz], k) => { const p = s.parts[k]; Object.assign(p, { x: px, y: py, z: pz, box: partBox(px, py, pz, p.width, p.height) }); });
      e.seed = seed;
      mobs.entities.push(e);
      watch(e, "vx", i, "bd");
    } else if (kind === "painting") { e = hanging.make("painting", spec[5], spec[6], spec[7], spec[8], { art: spec[4] }); hanging.entities.push(e); idx.set(e, i); }
    else if (kind === "frame") { e = hanging.make("frame", spec[4], spec[5], spec[6], spec[7], { item: spec[8] ? { id: spec[8], count: 1, damage: 0 } : null, dropChance: spec[9] }); hanging.entities.push(e); idx.set(e, i); }
    else if (kind === "knot") { e = { index: i, x: spec[4], y: spec[5], z: spec[6], age: 0, dead: false }; mobs.knotList.push(e); }
    return e;
  });
  // the dragon's host: its own Random (seeded like the probe's), then hurt and push as the row does
  const dragonEnt = ents.find((e) => e?.type === "ender_dragon");
  if (dragonEnt) {
    const rand = new JavaRandom(dragonEnt.seed), host = { rand };
    dragonEnt.rand = rand;
    mobs.attackEntityFrom = (entity, damage, source) => {
      const ok = attackFromPart(entity, source.part, { player: false, explosion: true }, damage, host);
      events.push(["pt", depth, entity.index, source.part, damage, entity.health, ok]);
      return ok;
    };
  }
  const posY = (e, kind) => (kind === "dragon" ? e.y : kind === "painting" || kind === "frame" ? e.y : kind === "knot" ? e.y + 0.5 : walkedY(e));
  const stamp = (i) => {
    const e = ents[i], kind = r.ents[i][0];
    if (kind === "knot") return stampEntity(e, e.x + 0.5, e.y + 0.5, e.z + 0.5);
    return stampEntity(e, e.x, posY(e, kind), e.z);
  };
  r.ents.forEach((spec, i) => zeroMotion(ents[i], spec[0])); events.length = 0; // the probe zeroes the constructors' random motion; the record is the push alone
  return { events, ents, stamp, boom, state };
}
function replay(r) {
  const s = scene(r);
  for (const op of r.ops) s.stamp(op[1]);
  const request = r.exploder > 0 ? { exploder: { exploder: true }, attacker: "player" } : {};
  s.boom(...r.centre, r.size, request);
  return s;
}
const zeroMotion = (e, kind) => { const f = MOTION[kind]; if (f) for (const k of f) e[k] = 0; };
// A dead entity stays in the chunk list until the next tick and a later (nested) blast pushes it again (Explosion.doExplosionA has no isDead test of its own); that motion is on
// something that is gone, so only entities alive after the blast are compared.
const motionOf = (s, r) => s.ents.map((e, i) => { const f = MOTION[r.ents[i][0]]; return f && !r.dead[i] ? f.map((k) => e[k]) : null; });
function sweep(name, check) {
  const recs = reference.records.filter((x) => x.case === name), bad = [];
  for (const r of recs) { forgetEntity("player"); const s = replay(r); const miss = check(r, s); if (miss) bad.push({ r, miss }); }
  return { recs, bad };
}
const slim = (bad) => JSON.stringify(bad.slice(0, 2).map(({ r, miss }) => ({ centre: r.centre, size: r.size, ents: r.ents, events: r.events, miss })));

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const total = (recs, kind) => recs.reduce((n, r) => n + r.events.filter((e) => e[0] === kind).length, 0);

test("blastprobe85 (executed): every dragon scene's body, part, hurt, push, flight target and Random use match native", () => {
  const { recs, bad } = sweep("dragon", (r, s) => {
    const d = s.ents.find((e) => e?.type === "ender_dragon");
    const got = { events: s.events, motion: motionOf(s, r), health: d.health, target: [d.dragon.tx, d.dragon.ty, d.dragon.tz], next: String(BigInt.asIntN(64, (BigInt(d.rand.next(32)) << 32n) + BigInt(d.rand.next(32)))) };
    const want = { events: r.events, motion: r.motion.map((m, i) => (MOTION[r.ents[i][0]] && !r.dead[i] ? m : null)), health: r.health, target: r.target, next: r.next };
    if (!same(got, want)) return { want, got };
  });
  assert.equal(recs.length, 300);
  assert.ok(total(recs, "pt") > 500 && total(recs, "bd") > 80, "parts and bodies are hit");
  assert.ok(recs.some((r) => r.events.some((e) => e[0] === "pt" && e[1] > 0)), "a crystal's nested blast hits the parts again");
  assert.ok(recs.some((r) => r.events.some((e) => e[0] === "pt") && !r.events.some((e) => e[0] === "bd")), "a part can be reached while the body (its centre) is not");
  assert.ok(recs.some((r) => r.events.filter((e) => e[0] === "pt").some((e) => e[5] === 0)), "a dying dragon still answers through its parts");
  assert.equal(bad.length, 0, slim(bad));
});

const deadOf = (s, r) => s.ents.map((e, i) => { const k = r.ents[i][0]; return k === "crystal" ? e.health <= 0 : k === "knot" ? e.dead : e.dead === true; });
test("blastprobe85 (executed): hanging entities break, keep or lose their item and drop in the native order, for any exploder", () => {
  const { recs, bad } = sweep("hang", (r, s) => {
    // the port's geometry for each hanging entity is the probe's (setDirection, art and facing)
    r.ents.forEach((spec, i) => { if (spec[0] === "painting" || spec[0] === "frame") { const e = s.ents[i]; if (!same([e.x, e.y, e.z], spec.slice(1, 4))) throw new Error(`geometry ${spec[0]} ${JSON.stringify(spec)} port ${[e.x, e.y, e.z]}`); } });
    const got = { events: s.events, dead: deadOf(s, r), motion: motionOf(s, r) };
    const want = { events: r.events, dead: r.dead.map((d, i) => (r.ents[i][0] === "crystal" ? d : d)), motion: r.motion.map((m, i) => (MOTION[r.ents[i][0]] && !r.dead[i] ? m : null)) };
    if (!same(got, want)) return { want, got };
  });
  assert.equal(recs.length, 300);
  const drops = recs.flatMap((r) => r.events.filter((e) => e[0] === "drop"));
  assert.ok(drops.length > 300 && drops.some((d) => d[3] === 321) && drops.some((d) => d[3] === 389) && drops.some((d) => d[3] === 1 || d[3] === 2 || d[3] === 3), "painting, frame and framed-item drops");
  assert.ok(recs.some((r) => r.exploder === 2 && r.ents.some((e) => e[0] === "painting") && !r.events.some((e) => e[0] === "drop" && e[3] === 321)), "a creative placer's blast breaks a painting without a drop");
  assert.ok(recs.some((r) => r.exploder === 1 && r.events.some((e) => e[0] === "drop" && e[3] === 321)), "a survival placer's blast drops it");
  assert.ok(recs.some((r) => r.events.filter((e) => e[0] === "h").some((e) => e[1] > 0) && r.ents.some((e) => e[0] === "frame" && e[8] > 0)), "a frame can be hit again in a nested blast");
  assert.equal(bad.length, 0, slim(bad));
});

test("blastprobe85 (executed): ender crystals, eyes of ender and fishing hooks on the reach gate: hit, push (eye posY, box) and nested blasts match native", () => {
  const { recs, bad } = sweep("crystal", (r, s) => {
    const got = { events: s.events, motion: motionOf(s, r) }, want = { events: r.events, motion: r.motion.map((m, i) => (MOTION[r.ents[i][0]] && !r.dead[i] ? m : null)) };
    if (!same(got, want)) return { want, got };
  });
  assert.equal(recs.length, 300);
  const reachedOf = (kind) => recs.reduce((n, r) => n + r.events.filter((e) => e[0] === "h" && r.ents[e[2]][0] === kind).length, 0), count = (kind) => recs.reduce((n, r) => n + r.ents.filter((e) => e[0] === kind).length, 0);
  for (const kind of ["crystal", "eye", "hook"]) assert.ok(reachedOf(kind) > 50, `${kind}: reached`);
  assert.ok(count("crystal") > 300 && count("eye") > 60 && count("hook") > 50);
  assert.ok(recs.some((r) => r.ents.some((e, i) => !r.events.some((v) => v[0] === "h" && v[2] === i))), "some entities are out of reach (the gate)");
  assert.equal(bad.length, 0, slim(bad));
});
