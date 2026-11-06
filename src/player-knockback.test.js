import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EntityWorld } from "./entities.js";
import { Survival } from "./survival.js";
import { Effects } from "./status-effects.js";
import { Arrows, arrowTargets } from "./bow.js";
import { GaussianRandom } from "./projectiles.js";
import { knockBack, drainKnockback, queueKnockBack } from "./player-knockback.js";
import { drainMobEvents, tickLivingSimulation } from "./living-simulation.js";
import { moveSpeed, fovMultiplier, WALK_SPEED } from "./player-movement.js";
import { POTION_TYPES } from "./potions.js";
import { JavaRandom } from "./java-random.js";

// PlayerKnockbackProbe on the unchanged 1.7.10 classes with a real EntityPlayer; see tools/verify-player-knockback.mjs.
const reference = JSON.parse(readFileSync(new URL("../public/research/player-knockback-reference.json", import.meta.url)));
const records = (c) => reference.records.filter((r) => r.case === c);
const f = Math.fround;
const flat = { numericSeed: 1, getMeta: () => 0, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64, y: 0, z: 64 }) };
const PLAYER = { x: 0.5, z: 0.5 };
const near = (a, b, at, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${at}: ${a} vs ${b}`);
const vec = (v, expected, at) => { near(v.x, expected[0], at + " x"); near(v.y, expected[1], at + " y"); near(v.z, expected[2], at + " z"); };
const player = (health = 20) => { const s = new Survival({ health }, "survival"); s.difficulty = 2; return s; };
const world = () => { const w = new EntityWorld(flat, [], () => 0.5); w.difficulty = 2; return w; };
const stackOf = (id, damage, enchantments) => ({ id, count: 1, damage, ...(enchantments?.length ? { enchantments } : {}) });

test("the reference names the classes and has every case", () => {
  assert.equal(reference.target, "Minecraft Java 1.7.10");
  for (const [c, n] of Object.entries({ sv: "EntityLivingBase", yz: "EntityPlayer", yg: "EntityMob", wt: "EntityIronGolem", zc: "EntityArrow", agw: "Explosion" })) assert.equal(reference.classes[c].name, n);
  assert.equal(records("melee").length, 600);
  assert.equal(records("golem").length, 72);
  assert.equal(records("arrow").length, 72);
  assert.equal(records("blast").length, 64);
});

test("a zombie's melee hit knocks the player back like EntityLivingBase.knockBack, plus its Knockback sword, once per hurt window", () => {
  let knocked = 0, extra = 0;
  for (const r of records("melee")) {
    const at = JSON.stringify(r), w = world(), s = player(), velocity = { x: r.motion0[0], y: r.motion0[1], z: r.motion0[2] };
    const e = w.create("zombie", PLAYER.x + r.offset[0], 0, PLAYER.z + r.offset[1]);
    e.rotationYaw = r.yaw;
    e.vx = 0.3; e.vz = -0.2;
    if (r.held.length) e.equipment[0] = stackOf(r.held[0], r.held[1], r.held.slice(2).reduce((l, v, i, a) => (i % 2 ? l : [...l, { id: v, lvl: a[i + 1] }]), []));
    const hit = w.hitPlayer(e, s);
    drainKnockback(s, velocity, PLAYER);
    assert.equal(hit, r.first.hit, at);
    vec(velocity, r.first.motion, at);
    near(e.vx, r.first.mob[0], at + " mob x"); near(e.vz, r.first.mob[2], at + " mob z");
    near(20 - s.health, 1000 - r.first.health, at, 1e-5);
    assert.equal(s.hurtTicks > 0, r.first.resist > 10, at);
    const again = w.hitPlayer(e, s);
    drainKnockback(s, velocity, PLAYER);
    assert.equal(again, r.second.hit, at);
    vec(velocity, r.second.motion, at + " second");
    knocked++;
    if (r.held.length > 2) extra++;
  }
  assert.equal(knocked, 600);
  assert.ok(extra > 100);
});

test("an iron golem hit knocks back and then lifts the player 0.4 above the 0.4 cap", () => {
  for (const r of records("golem")) {
    const at = JSON.stringify(r), w = world(), s = player(), velocity = { x: r.motion0[0], y: r.motion0[1], z: r.motion0[2] };
    const e = w.create("iron_golem", PLAYER.x + r.offset[0], 0, PLAYER.z + r.offset[1]);
    const hit = w.hitGolemPlayer(e, 1000 - r.health, s);
    drainKnockback(s, velocity, PLAYER);
    assert.equal(hit, r.hit, at);
    vec(velocity, r.motion, at);
  }
});

test("an arrow hits the player from its shooter (or itself) and Punch adds the 0.6 per level push", () => {
  const air = { get: () => 0, getMeta: () => 0, solid: () => false };
  for (const r of records("arrow")) {
    const at = JSON.stringify(r), s = player(), velocity = { x: r.motion0[0], y: r.motion0[1], z: r.motion0[2] };
    const arrows = new Arrows(() => 0.5), shooter = { x: 0.5 + r.start[0] * 2, y: 0, z: 0.5 + r.start[1] * 2, type: "skeleton" };
    const dx = -r.start[0], dz = -r.start[1], len = Math.hypot(dx, dz);
    const a = arrows.make({ x: 0.5 + r.start[0], y: 65, z: 0.5 + r.start[1], mx: (dx / len) * 1.2, my: -0.05, mz: (dz / len) * 1.2, yaw: 0, pitch: 0 }, new GaussianRandom(1), { shooter: r.shooter ? shooter : null, knockback: r.punch, damage: 2 });
    arrows.list.push(a);
    const target = [{ ref: "player", box: [0.2, 64, 0.2, 0.8, 65.8, 0.8] }];
    for (let t = 0; t < 4 && !a.dead; t++) arrows.tick(air, { targets: arrowTargets(target, false), survival: s });
    assert.equal(a.dead, r.dead, at);
    drainKnockback(s, velocity, PLAYER);
    vec(velocity, r.motion, at);
    near(20 - s.health, 1000 - r.health, at, 1e-5);
  }
});

test("an explosion with a living exploder knocks back before the blast velocity is added, and one without does not", () => {
  const pairs = records("blast").filter((r) => r.exploder);
  assert.equal(pairs.length, 32);
  for (const r of pairs) {
    const at = JSON.stringify(r), plain = records("blast").find((o) => !o.exploder && o.offset.join() === r.offset.join() && o.size === r.size && o.motion0.join() === r.motion0.join());
    const push = plain.motion.map((v, i) => v - r.motion0[i]), s = player(), velocity = { x: r.motion0[0], y: r.motion0[1], z: r.motion0[2] };
    s.damage(5, "a zombie", true, "explosion", { x: PLAYER.x + r.offset[0], z: PLAYER.z + r.offset[1] });
    drainKnockback(s, velocity, PLAYER);
    velocity.x += push[0]; velocity.y += push[1]; velocity.z += push[2];
    vec(velocity, r.motion, at);
  }
});

test("applyExplosion queues the exploder's knockback ahead of the blast push", async () => {
  const { applyExplosion } = await import("./explosion-simulation.js");
  const sources = [{ x: 3.5, z: 0.5, type: "creeper" }, null];
  const out = sources.map((attacker) => {
    const s = player(), velocity = { x: 0, y: 0, z: 0 }, position = { x: 0.5, y: 64, z: 0.5 };
    const w = { get: () => 0, getMeta: () => 0, set: () => true, solid: () => false, numericSeed: 1 };
    const none = { entities: [], damage() {}, hazard() {} };
    const list = { explode() {}, list: [], tick() {} };
    applyExplosion({ world: w, random: new JavaRandom(1), mobs: none, items: list, xpOrbs: list, arrows: list, projectiles: list, falling: list, primed: [], survival: s, position, velocity, farming: { observe() {} } },
      { x: 3.5, y: 64.5, z: 0.5, size: 3, attacker, exploder: attacker }, {});
    return velocity;
  });
  assert.ok(out[0].y > 0 && out[1].y > 0);
  near(out[0].x - out[1].x, 0, "x: a half of nothing plus -0.4 against the blast itself", 1);
  assert.ok(out[0].x < out[1].x - 0.3, `knocked away from the creeper: ${out[0].x} vs ${out[1].x}`);
});

test("knockback is skipped for a refused or stale hit, in Creative and when nothing is the source", () => {
  const s = player(), velocity = { x: 0, y: 0, z: 0 };
  assert.equal(s.damage(3, "a zombie", true, undefined, { x: 2.5, z: 0.5 }), true);
  assert.equal(s.damage(3, "a zombie", true, undefined, { x: 2.5, z: 0.5 }), false, "inside the hurt window a hit no larger than the last is refused");
  assert.equal(s.damage(4, "a zombie", true, undefined, { x: 2.5, z: 0.5 }), true, "a larger hit deals the difference but starts no new window");
  assert.equal(drainKnockback(s, velocity, PLAYER), 1, "only the first hit knocked back");
  const creative = new Survival({ health: 20 }, "creative");
  assert.equal(creative.damage(3, "a zombie", true, undefined, { x: 2.5, z: 0.5 }), false);
  assert.equal(drainKnockback(creative, velocity, PLAYER), 0);
  const fall = player();
  fall.damage(3, "a fall");
  assert.equal(drainKnockback(fall, velocity, PLAYER), 0, "a damage source without an entity does not knock back");
});

test("knockBack halves the old motion, keeps y at or under 0.4 and nudges a coincident attacker", () => {
  const v = { x: 0.2, y: 0.9, z: -0.4 };
  assert.equal(knockBack(v, PLAYER, { x: 0.5, z: 2.5 }), true);
  near(v.x, 0.1, "x"); near(v.z, -0.2 - 0.4000000059604645, "z"); assert.equal(v.y, 0.4000000059604645);
  const w = { x: 0, y: 0, z: 0 };
  const seq = [1, 0, 0, 1];
  knockBack(w, PLAYER, PLAYER, () => seq.shift());
  near(Math.hypot(w.x, w.z), 0.4000000059604645, "unit direction times 0.4", 1e-6);
  assert.equal(knockBack({ x: 0, y: 0, z: 0 }, PLAYER, { x: 3, z: 0 }, Math.random, 0, () => 0), true, "a roll of 0 is not below a resistance of 0");
  const resisted = { x: 1, y: 1, z: 1 };
  assert.equal(knockBack(resisted, PLAYER, { x: 3, z: 0 }, Math.random, 1, () => 0.5), false);
  assert.deepEqual(resisted, { x: 1, y: 1, z: 1 });
});

test("tickLivingSimulation applies the queued knockback through the knock hook after the mob events", () => {
  const s = player(), velocity = { x: 0, y: 0, z: 0 };
  s.damage(3, "a zombie", true, undefined, { x: 2.5, z: 0.5 });
  const mobs = { drain: () => [{ dragonPush: { x: 0, y: -0.2, z: 0 } }], tick() {}, drainClientSounds: () => [] };
  const xpOrbs = { tick() {}, collect: () => 0, sounds: [] };
  const state = { world: {}, position: { x: 0.5, z: 0.5 }, survival: s, inhabited: { tick() {} }, mobs, xpOrbs, experience: { level: 0 }, items: {}, playerTicks: 0, width: 0.6, height: 1.8 };
  tickLivingSimulation(state, {
    push: (v) => { velocity.x += v.x; velocity.y += v.y; velocity.z += v.z; },
    knock: (survival) => drainKnockback(survival, velocity, state.position),
  });
  near(velocity.x, -0.4000000059604645, "x"); near(velocity.y, -0.2 / 2 + 0.4000000059604645, "y", 1e-12);
});

test("Speed, Slowness, Strength and Weakness give the probed attribute values, which the player's speed, FOV and damage use", () => {
  const effect = (id, amplifier) => { const e = new Effects(); e.add({ id, duration: 600, amplifier }); return e; };
  for (const r of records("attrs")) {
    const at = JSON.stringify(r);
    let e;
    if (r.effect === "speed2+slow1") { e = effect(1, 1); e.add({ id: 2, duration: 600, amplifier: 0 }); }
    else if (r.effect === "strength2+weakness1") { e = effect(5, 1); e.add({ id: 18, duration: 600, amplifier: 0 }); }
    else e = r.effect === 0 ? new Effects() : effect(r.effect, r.amplifier);
    near(moveSpeed(false, e.moveSpeedMultiplier()), r.movementSpeed, at, 1e-15);
    near(e.attackDamage(1), r.attackDamage, at, 1e-12);
    // EntityPlayerSP.getFOVMultiplier: (movementSpeed / walkSpeed + 1) / 2 of the attribute value.
    near(fovMultiplier({ potion: e.moveSpeedMultiplier() }), f((r.movementSpeed / WALK_SPEED + 1) / 2), at, 1e-6);
  }
  assert.ok(POTION_TYPES[2].modifier);
});

test("Weakness II on an empty hand leaves no attack at all, Weakness I halves it", () => {
  const w = new EntityWorld(flat, [], () => 0.5);
  const s = player();
  s.effects.add({ id: 18, duration: 600, amplifier: 1 });
  const e = w.create("zombie", 64, 0, 64), health = e.health;
  assert.equal(w.attack(e, 0, s, { x: 62, z: 64, yaw: 0 }), false);
  assert.equal(e.health, health);
});
