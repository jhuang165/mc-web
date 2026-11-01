import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EntityWorld, ENTITY_TYPES, mobPose, chickenFlap, EGG, FEATHER, RAW_CHICKEN, COOKED_CHICKEN, setEntityRandom } from "./entities.js";
import { GaussianRandom, Projectiles } from "./projectiles.js";
import { JavaRandom, mhSin } from "./lighting.js";
import { Survival, ITEMS, SMELTING, smeltingResult } from "./survival.js";
import { SHADOWS } from "./shadows.js";

// tools/probes/ChickenProbe.java (tools/verify-chicken.mjs): the unchanged EntityChicken (wg)
// and EntityEgg (zl) classes of 1.7.10 on a world double.
const reference = JSON.parse(await readFile(new URL("../public/research/chicken-reference.json", import.meta.url)));
const f = Math.fround;
const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const far = { x: 64, y: 0, z: 100 };
// Entity.rand stand-in that returns the same fraction for every draw.
const fixedRand = (v) => ({ nextInt: (n) => Math.floor(v * n), nextFloat: () => v, nextDouble: () => v, nextGaussian: () => 0 });
const chickenWorld = (extra = {}, random = () => 0.5, list = [{ id: "mob-1", type: "chicken", x: 64, y: 6, z: 64, health: 4, ...extra }]) => new EntityWorld(grass, list, random);
// A random() that replays java.util.Random(seed) nextFloat draws.
const floats = (seed) => {
  const r = new JavaRandom(seed);
  return () => r.nextFloat();
};

test("a chicken has the 1.7.10 size, health, speed and AI multipliers", () => {
  const t = ENTITY_TYPES.chicken, facts = reference.facts;
  // setSize(0.3F, 0.7F): the sizes are floats.
  assert.deepEqual([t.width, t.height, t.health, t.movement], [f(facts.width), f(facts.height), facts.maxHealth, facts.speed]);
  assert.deepEqual(t.ai, { wander: 1, mate: 1, panic: 1.4, tempt: 1, follow: 1.1 });
  assert.equal(facts.wingRotDelta, 1);
  assert.equal(facts.age, 0);
});

test("the first egg timer is rand.nextInt(6000) + 6000, and the wing fields start as the constructor sets them", () => {
  assert.ok(reference.facts.eggTimerMin >= 6000 && reference.facts.eggTimerMax <= 11999);
  for (const [roll, want] of [[0, 6000], [0.9999999, 11999]]) {
    const e = new EntityWorld(grass, [], () => roll).create("chicken", 64, 0, 64);
    assert.equal(e.eggTimer, want);
    assert.deepEqual([e.wingRotation, e.destPos, e.oFlapSpeed, e.oFlap, e.wingRotDelta], [0, 0, 0, 0, 1]);
  }
});

test("wing fields and the slow fall replay EntityChicken.onLivingUpdate through a fall, a hop and the landing", () => {
  const ew = chickenWorld({ eggTimer: 1e9 }), e = ew.entities[0], t = ENTITY_TYPES.chicken;
  assert.equal(reference.fall.ticks.length, 80);
  reference.fall.ticks.forEach((want, i) => {
    if (i === reference.fall.hopAt) e.vy = 0.42;
    ew.walk(e, t, 0);
    ew.chickenUpdate(e);
    const label = `tick ${i}`;
    assert.equal(e.onGround, want.onGround, label);
    assert.ok(Math.abs(e.y - want.y) < 1e-9 && Math.abs(e.vy - want.vy) < 1e-9, `${label} y ${e.y} ${want.y} vy ${e.vy} ${want.vy}`);
    assert.deepEqual([e.wingRotation, e.destPos, e.oFlapSpeed, e.oFlap, e.wingRotDelta], [f(want.bp), f(want.bq), f(want.br), f(want.bs), f(want.bt)], label);
  });
  // A chicken in the air never exceeds the 0.6-damped terminal speed, so it floats down slowly.
  assert.ok(reference.fall.ticks.every((r) => r.vy > -0.12 || r.onGround));
});

test("a chicken takes no fall damage", () => {
  const ew = chickenWorld({ y: 30, eggTimer: 1e9 }), e = ew.entities[0];
  for (let i = 0; i < 400 && !e.onGround; i++) ew.walk(e, ENTITY_TYPES.chicken, 0), ew.chickenUpdate(e);
  assert.ok(e.onGround);
  assert.equal(e.health, 4);
});

test("an adult lays an egg with mob.chicken.plop when the timer runs out, as EntityChicken does for seeded rand", () => {
  assert.equal(reference.eggtimer.length, 6);
  for (const want of reference.eggtimer) {
    // The sound's two nextFloat draws, then nextInt(6000) as an exact fraction.
    const jr = new JavaRandom(want.seed);
    let calls = -1;
    const random = () => (calls < 0 ? 0.5 : calls++ < 2 ? jr.nextFloat() : (jr.next(31) % 6000 + 0.5) / 6000);
    const ew = chickenWorld({}, random), e = ew.entities[0];
    calls = 0;
    Object.assign(e, { eggTimer: 1, onGround: true });
    ew.chickenUpdate(e);
    const [sound, volume, pitch] = want.sounds[0].split("|");
    const events = ew.drain();
    assert.deepEqual(events.map((x) => x.sound || x.drop), [sound, EGG]);
    assert.equal(events[0].volume, +volume);
    assert.equal(events[0].pitch, f(+pitch));
    assert.equal(events[1].count, want.drops[0][1]);
    assert.equal(e.eggTimer, want.next);
  }
});

test("a chick neither counts the egg timer down nor lays, however long it lives", () => {
  assert.deepEqual([reference.child.bu, reference.child.sounds.length, reference.child.drops.length], [1, 0, 0]);
  const ew = chickenWorld({ growingAge: -24000 }), e = ew.entities[0];
  Object.assign(e, { eggTimer: 1, onGround: true });
  for (let i = 0; i < 5; i++) ew.chickenUpdate(e);
  assert.equal(e.eggTimer, 1);
  assert.equal(ew.drain().length, 0);
});

test("a dead chicken drops 0 to 2 feathers and one raw chicken, cooked when burning (wg.b(ZI))", () => {
  const byKey = { false: new Set(), true: new Set() }, feathers = { false: {}, true: {} };
  for (const d of reference.drops) {
    const n = d.items.filter((i) => i[0] === "feather").reduce((s, i) => s + i[1], 0), meat = d.items.find((i) => i[0] !== "feather");
    assert.equal(meat[0], d.burning ? "cooked" : "raw");
    assert.equal(meat[1], 1);
    byKey[d.burning].add(meat[0]);
    feathers[d.burning][n] = (feathers[d.burning][n] || 0) + 1;
  }
  assert.deepEqual(Object.keys(feathers.false).sort(), ["0", "1", "2"]);
  for (const burning of [false, true])
    for (const n of [0, 1, 2]) {
      // Entity.rand: nextInt(3) + nextInt(1) feathers = n; isBurning cooks the meat.
      const ew = chickenWorld({ growingAge: 0 }), e = ew.entities[0];
      e.fire = burning ? 40 : 0;
      setEntityRandom(e, fixedRand((n + 0.5) / 3));
      ew.kill(e);
      const drops = ew.drain().filter((x) => x.drop);
      assert.equal(drops.filter((x) => x.drop === FEATHER).reduce((s, x) => s + x.count, 0), n);
      const meat = drops.filter((x) => x.drop !== FEATHER);
      assert.deepEqual(meat.map((x) => [x.drop, x.count]), [[burning ? COOKED_CHICKEN : RAW_CHICKEN, 1]]);
    }
});

test("a chick drops nothing, following the existing adult-only drop convention", () => {
  const ew = chickenWorld({ growingAge: -24000 }), e = ew.entities[0];
  ew.kill(e);
  assert.equal(ew.drain().filter((x) => x.drop).length, 0);
});

test("chickens say, hurt and die with the hurt sound of mob.chicken", () => {
  const ew = chickenWorld({ y: 0, eggTimer: 1e9 }), e = ew.entities[0];
  ew.damage(e, 1, 60, 64);
  assert.equal(ew.drain().find((x) => x.sound).sound, "mob.chicken.hurt");
  // A killing top-up inside the hurt window is silent; a fresh killing hit plays the death sound.
  ew.damage(e, 10, 60, 64);
  assert.ok(!ew.drain().some((x) => x.sound));
  const fresh = chickenWorld({ y: 0, eggTimer: 1e9 });
  fresh.damage(fresh.entities[0], 10, 60, 64);
  assert.ok(fresh.drain().some((x) => x.sound === "mob.chicken.hurt"));
});

test("wheat seeds breed chickens, wheat does not, and the chick is a child with its own egg timer", () => {
  const ew = chickenWorld({}, () => 0.9, [
    { id: "mob-1", type: "chicken", x: 64, y: 0, z: 64, health: 4 },
    { id: "mob-2", type: "chicken", x: 65, y: 0, z: 64, health: 4 },
  ]), p = new Survival({ inventory: { 309: 2 } }), [a, b] = ew.entities;
  assert.equal(ew.feed(a, 305, p), false);
  assert.equal(ew.feed(a, 309, p), true);
  assert.equal(ew.feed(b, 309, p), true);
  for (let i = 0; i < 60; i++) ew.tick(far, p, 309);
  const chick = ew.entities.find((e) => e.growingAge < 0);
  assert.ok(chick);
  assert.equal(chick.type, "chicken");
  assert.equal(chick.growingAge, -24000);
  assert.equal(typeof chick.eggTimer, "number");
});

test("a chicken walks toward the player holding seeds", () => {
  const ew = chickenWorld({ y: 0, eggTimer: 1e9 }), e = ew.entities[0], p = new Survival({ inventory: { 309: 1 } });
  // The AI looks for tasks every third tick and a mob must have landed to path: a few ticks.
  for (let i = 0; i < 5; i++) ew.tick({ x: 68, y: 0, z: 64 }, p, 309);
  assert.ok(e.x > 64);
});

test("the wing flap fed to the model is (sin(lerped wingRotation) + 1) * lerped destPos with the sine table", () => {
  const e = { oFlap: 1, wingRotation: 3, oFlapSpeed: 0.2, destPos: 1 };
  const a = f(1 + f(f(3 - 1) * 0.25)), b = f(0.2 + f(f(1 - 0.2) * 0.25));
  assert.equal(chickenFlap(e, 0.25), f(f(mhSin(a) + 1) * b));
  assert.equal(mobPose({ ...chickenWorld().entities[0], ...e }, 0.25).flap, chickenFlap(e, 0.25));
  assert.equal(chickenFlap({ oFlap: 5, wingRotation: 9, oFlapSpeed: 0, destPos: 0 }, 1), 0);
  assert.equal("flap" in mobPose(new EntityWorld(grass, [{ id: "mob-1", type: "pig", x: 64, y: 0, z: 64, health: 10 }]).entities[0], 0), false);
});

test("the egg roll is nextInt(8) == 0 for a chick and nextInt(32) == 0 for four, replayed from 4000 seeded Entity.rand", () => {
  const p = new Projectiles(() => 0.5), tally = {};
  assert.equal(reference.hatch.chicks.length, 4000);
  reference.hatch.chicks.forEach((want, i) => {
    const ball = { rand: new GaussianRandom(i * 2654435761), x: 10.5, y: 20.25, z: 30.75, yaw: 135 };
    assert.equal(p.layEggs(ball), want, `seed ${i}`);
    tally[want] = (tally[want] || 0) + 1;
    const events = p.drain();
    assert.equal(events.length, want ? 1 : 0);
  });
  assert.deepEqual(tally, { 0: 3510, 1: 477, 4: 13 });
  assert.ok(reference.hatch.particles.every((n) => n === 8));
});

test("GaussianRandom.nextInt matches java.util.Random.nextInt(bound)", () => {
  // Random(42): nextInt(8) = 0 and nextInt(32) = 28 are Java's first values; bounds that
  // are not powers of two redraw on the int-overflow bias test.
  const r = new GaussianRandom(42);
  assert.deepEqual([r.nextInt(10), r.nextInt(10), r.nextInt(10)], [0, 3, 8]);
  const big = new GaussianRandom(7), vals = Array.from({ length: 2000 }, () => big.nextInt(6000));
  assert.ok(vals.every((v) => v >= 0 && v < 6000));
  assert.ok(new Set(vals).size > 1500);
  const pow = new GaussianRandom(9);
  assert.ok(Array.from({ length: 200 }, () => pow.nextInt(32)).every((v) => v >= 0 && v < 32));
});

test("a thrown egg hits the ground, bursts eight particles and hatches a chick that faces the egg's yaw", () => {
  const stone = { get: (x, y, z) => (y < 10 && y >= 0 ? 3 : 0), solid(x, y, z) { return this.get(x, y, z) !== 0; } };
  let hatched = 0;
  for (let seed = 1; seed < 400 && !hatched; seed++) {
    const p = new Projectiles(floats(seed));
    p.throwEgg({ x: 2.5, y: 11, z: 2.5 }, 0, -90);
    assert.equal(p.balls[0].kind, "egg");
    for (let i = 0; i < 40 && p.balls.length; i++) p.tick(stone);
    assert.equal(p.balls.length, 0);
    assert.equal(p.particles.length > 0, true);
    for (const ev of p.drain()) {
      hatched += ev.chicks;
      const ew = new EntityWorld(grass, [], () => 0.5);
      for (let i = 0; i < ev.chicks; i++) ew.hatch(ev.x, ev.y, ev.z, ev.yaw);
      assert.equal(ew.entities.length, ev.chicks);
      for (const c of ew.entities) {
        assert.equal(c.type, "chicken");
        assert.equal(c.growingAge, -24000);
        assert.equal(Math.abs(c.rotationYaw - f(ev.yaw)) < 1e-3 || Math.abs(Math.abs(c.rotationYaw - f(ev.yaw)) - 360) < 1e-3, true);
      }
    }
  }
  assert.ok(hatched >= 1);
});

test("hatch checks the 40-mob cap and the sample chick of the probe is a child at the egg's position", () => {
  const s = reference.hatch.sample;
  assert.deepEqual([s.age, s.child, s.x, s.y, s.z, s.yaw, s.pitch], [-24000, true, 10.5, 20.25, 30.75, 135, 0]);
  const list = Array.from({ length: 40 }, (_, i) => ({ id: "mob-" + (i + 1), type: "pig", x: 64 + i * 0.01, y: 0, z: 64, health: 10 }));
  const ew = chickenWorld({}, () => 0.5, list);
  assert.equal(ew.hatch(10.5, 1, 30.5, 0), null);
  const open = new EntityWorld(grass, [], () => 0.5), c = open.hatch(s.x, s.y, s.z, s.yaw);
  assert.deepEqual([c.x, c.y, c.z], [s.x, s.y, s.z]);
});

test("eggs survive a save and load, and an old snowball save loads as a snowball", () => {
  const p = new Projectiles(() => 0.5);
  p.throwEgg({ x: 2.5, y: 11, z: 2.5 }, 10, 5);
  p.throwSnowball({ x: 2.5, y: 11, z: 2.5 }, 10, 5);
  const saved = p.serialize();
  assert.deepEqual(saved.map((b) => b.kind), ["egg", undefined]);
  const q = new Projectiles(() => 0.5);
  q.load(saved);
  assert.deepEqual(q.balls.map((b) => b.kind), ["egg", "snowball"]);
});

test("egg, feather, raw and cooked chicken are items; raw chicken smelts to cooked and gives 2 or 6 food", () => {
  assert.equal(ITEMS[EGG].name, "Egg");
  assert.equal(ITEMS[FEATHER].name, "Feather");
  assert.deepEqual([ITEMS[RAW_CHICKEN].food, ITEMS[RAW_CHICKEN].saturation], [2, 0.3]);
  assert.deepEqual([ITEMS[COOKED_CHICKEN].food, ITEMS[COOKED_CHICKEN].saturation], [6, 0.6]);
  assert.equal(SMELTING[RAW_CHICKEN], COOKED_CHICKEN);
  assert.equal(smeltingResult({ id: RAW_CHICKEN, count: 1 }).id, COOKED_CHICKEN);
  assert.equal(ITEMS[EGG].food, undefined);
});

test("chickens get a 0.3 shadow and spawn with weight 10 of 40 passive-spawn weights", () => {
  assert.equal(SHADOWS.chicken.size, f(0.3));
  const counts = {};
  for (let seed = 1; seed <= 500; seed++)
    for (const e of new EntityWorld({ ...grass, numericSeed: seed }).entities) counts[e.type] = (counts[e.type] || 0) + 1;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.ok(total > 3000);
  for (const [type, weight] of [["sheep", 12], ["pig", 10], ["chicken", 10], ["cow", 8]]) {
    const share = counts[type] / total;
    assert.ok(Math.abs(share - weight / 40) < 0.04, `${type} ${share}`);
  }
});

test("chickens save and load; the egg timer and wing state are not saved and roll fresh, as in 1.7.10", () => {
  const ew = chickenWorld({ y: 0 }), e = ew.entities[0];
  Object.assign(e, { eggTimer: 777, wingRotation: 4, destPos: 1 });
  const saved = ew.serialize()[0];
  assert.deepEqual(["eggTimer", "wingRotation", "destPos"].map((k) => k in saved), [false, false, false]);
  const again = new EntityWorld(grass, [{ ...saved, eggTimer: -5 }], () => 0.5).entities[0];
  assert.equal(again.type, "chicken");
  assert.deepEqual([again.eggTimer, again.wingRotation, again.destPos, again.wingRotDelta], [9000, 0, 0, 1]);
});
