// Replays public/research/fx-reference.json (tools/probes/FxProbe.java through
// tools/verify-fx.mjs): the particles.png EntityFX constructors and every onUpdate, and the
// entity spawn sites (water entry, feeding hearts, death poof, potion swirls, item crumbs,
// bone meal sparkles, Crit2FX), Block.randomDisplayTick, WorldClient.doVoidFogParticles,
// Entity.isInsideOfMaterial and the drowning part of EntityLivingBase.onEntityUpdate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./lighting.js";
import { WATER, LAVA } from "./world.js";
import { ExplosionParticles } from "./explosion-particles.js";
import { randomDisplayTick, displayTicks } from "./display-ticks.js";
import { Fx, enterWater, burst, potionColor, potionParticles, itemCrumbs, boneMealSparkles } from "./fx.js";
import { eyeInWater } from "./fluids.js";
import { breathe, livingSoundRoll } from "./entities.js";

const ref = JSON.parse(await readFile(new URL("../public/research/fx-reference.json", import.meta.url)));
const records = (name) => ref.records.filter((c) => c.case === name);
const state = (raw) => {
  const r = new JavaRandom(0);
  r.seed = BigInt(raw);
  return r;
};
// Gaussian velocities (indices 4-6) can differ by an ulp: JavaRandom.nextGaussian uses
// Math.log where java.util.Random has StrictMath.log. Everything else is exact.
function gaussianCalls(actual, expected, what) {
  assert.equal(actual.length, expected.length, what);
  actual.forEach((call, i) => {
    assert.deepEqual(call.slice(0, 4), expected[i].slice(0, 4), `${what} call ${i}`);
    for (let k = 4; k < 7; k++) assert.ok(Math.abs(call[k] - expected[i][k]) <= 1e-16, `${what} call ${i} velocity ${k - 4}`);
  });
}
const VIEWER = [10.5, 65.62, 10.5];
const STONE = 3;

// The probe fixtures with this build's ids: stone below y 64; 1 a still water pool and 3 a
// still lava pool over x/z 9-11, y 64-66; 2 stone at (10, 66, 10); 4 stone at (10, 70, 10).
function world(fixture) {
  const cells = new Map(), put = (x, y, z, id) => cells.set(`${x},${y},${z}`, id);
  if (fixture === 1 || fixture === 3) for (let x = 9; x <= 11; x++) for (let z = 9; z <= 11; z++) for (let y = 64; y <= 66; y++) put(x, y, z, fixture === 1 ? WATER : LAVA);
  if (fixture === 2) put(10, 66, 10, STONE);
  if (fixture === 4) put(10, 70, 10, STONE);
  const get = (x, y, z) => cells.get(`${x},${y},${z}`) ?? (y < 64 ? STONE : 0);
  return { get, getMeta: () => 0, solid: (x, y, z) => get(x, y, z) === STONE };
}

// One Math.random stream (the raw `math` state) for the Fx and its explosion kinds; the first
// Entity.rand is the record's, later ones (spawned particles) are unrelated.
function system(math, seed, w) {
  const r = state(math), random = () => r.nextDouble();
  let first = seed;
  const entityRandom = () => {
    const s = first ?? 0;
    first = null;
    return state(s);
  };
  const fx = new Fx({ random, entityRandom, world: w, explosions: new ExplosionParticles({ random, entityRandom: () => new JavaRandom(0) }) });
  fx.viewer = VIEWER;
  const calls = [], spawn = fx.spawn.bind(fx);
  fx.spawn = (name, ...args) => {
    calls.push([name, ...args.slice(0, 6)]);
    return spawn(name, ...args);
  };
  return { fx, calls };
}

test("particles.png and iconcrack constructors and full lifetimes replay the original classes", () => {
  const list = records("particle");
  assert.equal(list.length, 31);
  for (const c of list) {
    const w = world(c.fixture), { fx, calls } = system(c.math, c.initial.seed, w), q = c.initial, what = `${c.kind} fixture ${c.fixture}`;
    const p = c.kind === "rain" ? fx.addDirect("rain", ...c.args) : fx.spawn(c.kind, ...c.args);
    assert.ok(p, what + " spawned");
    assert.deepEqual([p.x, p.y, p.z, p.mx, p.my, p.mz, p.jx, p.jy, p.scale, p.max, p.gravity, [p.r, p.g, p.b], p.width, p.height, p.yOffset],
      [q.x, q.y, q.z, q.vx, q.vy, q.vz, q.jx, q.jy, q.scale, q.maxAge, q.gravity, q.rgb, q.width, q.height, q.yOffset], what + " constructor");
    assert.deepEqual(p.box, q.box, what + " box");
    assert.equal(p.a, c.alpha, what + " alpha");
    assert.equal(p.layer, c.layer, what + " layer");
    c.tracks.forEach((expected, t) => {
      calls.length = 0;
      fx.step(w, p);
      assert.deepEqual([p.x, p.y, p.z, p.mx, p.my, p.mz, p.age, p.tex, !!p.dead, p.onGround, p.r, p.g, p.b], expected, `${what} tick ${t}`);
      assert.deepEqual(calls, c.events[t], `${what} events ${t}`);
    });
    // The probe stops at 140 ticks (the lava drip outlives it).
    assert.equal(!!p.dead, c.tracks.length < 140, what + " dies");
  }
});

test("Crit2FX constructor update and two more spawn the original crit calls, then dies", () => {
  const [c] = records("crit2"), w = world(0), { fx, calls } = system(c.math, c.seed, w);
  const target = () => ({ x: 10.5, z: 10.5, minY: 64, width: Math.fround(0.9), height: Math.fround(1.3), mx: 0.2, my: 0.1, mz: -0.1 });
  const p = fx.crit2(target);
  assert.deepEqual(calls, c.constructor);
  for (const expected of c.events) {
    calls.length = 0;
    fx.step(w, p);
    assert.deepEqual(calls, expected);
  }
  assert.equal(!!p.dead, c.dead);
});

test("Entity.handleWaterMovement splash volume, pitch, bubbles and splashes", () => {
  const list = records("water");
  assert.equal(list.length, 5);
  for (const c of list) {
    if (c.first) {
      // The entity's first update only marks it wet; the caller skips enterWater.
      assert.deepEqual([c.sounds, c.calls], [[], []]);
      continue;
    }
    const calls = [], fx = { spawn: (...a) => calls.push(a) };
    const [mx, my, mz] = c.motion, out = enterWater(fx, { x: c.x, z: c.z, minY: c.minY, width: c.width, mx, my, mz }, new JavaRandom(77));
    assert.deepEqual([["game.neutral.swim.splash", out.volume, out.pitch]], c.sounds, `width ${c.width}`);
    assert.deepEqual(calls, c.calls, `width ${c.width}`);
  }
});

test("feeding hearts and the death poof use the original box spread", () => {
  for (const [name, count, up] of [["hearts", 7, 0.5], ["death", 20, 0]]) {
    const [c] = records(name), calls = [], fx = { spawn: (...a) => calls.push(a) };
    burst(fx, name === "hearts" ? "heart" : "explode", count, c, new JavaRandom(c.seed), up);
    gaussianCalls(calls, c.calls, name);
  }
});

test("potion colour and swirl particles over 40 ticks (normal, ambient, player yOffset)", () => {
  const list = records("potion");
  assert.equal(list.length, 15);
  for (const c of list) {
    const effects = [];
    for (let i = 0; i < c.effects.length; i += 2) effects.push({ id: c.effects[i], amplifier: c.effects[i + 1] });
    const color = potionColor(effects), what = `${c.effects} mode ${c.mode}`;
    assert.equal(color, c.color, what + " colour");
    const calls = [], fx = { spawn: (...a) => calls.push(a) }, rand = new JavaRandom(c.seed);
    const e = { x: 10.5, y: c.y, z: 10.5, yOffset: c.yOffset, width: Math.fround(0.6), height: Math.fround(1.8) };
    for (let t = 0; t < 40; t++) potionParticles(fx, e, color, rand, { ambient: c.mode === 1 });
    assert.deepEqual(calls, c.calls, what);
  }
  assert.equal(potionColor([]), 0);
});

test("broken-item crumbs rotate by pitch and yaw and share Math.random with the constructors", () => {
  const list = records("crumbs");
  assert.equal(list.length, 4);
  for (const c of list) {
    const { fx, calls } = system(c.math, null, world(0));
    itemCrumbs(fx, 5, "iconcrack_267", { x: 10.5, y: c.eye, z: 10.5, yaw: c.yaw, pitch: c.pitch }, new JavaRandom(c.seed));
    assert.deepEqual(calls, c.calls, `yaw ${c.yaw} pitch ${c.pitch}`);
  }
});

test("bone meal sparkles reach the block's maxY and skip air", () => {
  const list = records("bonemeal");
  assert.equal(list.length, 4);
  for (const c of list) {
    const calls = [], fx = { spawn: (...a) => calls.push(a) };
    boneMealSparkles(fx, c.block, 10, 64, 10, c.maxY, new JavaRandom(71));
    gaussianCalls(calls, c.calls, `block ${c.block}`);
  }
});

// Original ids of the display-tick records -> this build's: torch, lit furnace, fire, stone,
// planks, leaves, flowing/still water, flowing/still lava.
const DISPLAY_ID = { 50: 20, 62: 14, 51: 45, 1: STONE, 5: 7, 18: 5, 8: WATER, 9: WATER, 10: LAVA, 11: LAVA };

test("torch, lit furnace, fire, leaves and liquid display ticks replay the original calls, sounds and draws", () => {
  const list = records("display");
  assert.equal(list.length, 17);
  for (const c of list) {
    const cells = new Map([[`10,70,10`, [DISPLAY_ID[c.block], c.meta]]]);
    for (const [x, y, z, id, meta] of c.cells) cells.set(`${x},${y},${z}`, [DISPLAY_ID[id], meta]);
    const cell = (x, y, z) => cells.get(`${x},${y},${z}`) ?? [y < 64 ? STONE : 0, 0];
    const w = { get: (x, y, z) => cell(x, y, z)[0], getMeta: (x, y, z) => cell(x, y, z)[1] };
    for (const [seed, expected, expectedSounds, after] of c.runs) {
      const calls = [], sounds = [], rand = new JavaRandom(seed);
      const fx = { spawn: (name, x, y, z, vx = 0, vy = 0, vz = 0) => calls.push([name, x, y, z, vx, vy, vz]) };
      const canStrike = (x, y, z) => {
        assert.deepEqual([x, y, z], [10, 71, 10]);
        return c.strike;
      };
      randomDisplayTick(w, 10, 70, 10, w.get(10, 70, 10), rand, { fx, lit: () => true, canStrike, sound: (...a) => sounds.push(a) });
      const what = `${c.name} seed ${seed}`;
      assert.deepEqual(calls, expected, what);
      assert.deepEqual(sounds, expectedSounds, what + " sounds");
      assert.equal(rand.seed, BigInt(after), what + " draws");
    }
  }
});

test("void fog rolls depthsuspend for air below y 8 from World.rand", () => {
  const list = records("voidfog");
  assert.equal(list.length, 3);
  for (const c of list) {
    const calls = [], rand = new JavaRandom(c.seed);
    const fx = { spawn: (name, x, y, z, vx = 0, vy = 0, vz = 0) => calls.push([name, x, y, z, vx, vy, vz]) };
    displayTicks({ get: () => 0, getMeta: () => 0 }, 10, 4, 10, { rand, fx });
    assert.deepEqual(calls, c.calls, `seed ${c.seed}`);
    assert.equal(rand.seed, BigInt(c.after), `seed ${c.seed} draws`);
  }
});

test("isInsideOfMaterial(water) compares the eye with the cell's liquid surface", () => {
  const list = records("inside");
  assert.equal(list.length, 5);
  for (const c of list) {
    assert.equal(c.eye, Math.fround(Math.fround(c.height) * Math.fround(0.85)));
    const w = { get: (x, y, z) => (x === 10 && y === 65 && z === 10 ? WATER : y < 64 ? STONE : 0), getMeta: () => c.meta };
    for (const [y, inside] of c.grid) assert.equal(eyeInWater(w, 10.5, y + c.eye, 10.5), inside, `meta ${c.meta} feet ${y}`);
  }
});

test("a mob under water counts its air down to -20, then bubbles and drowns, with the living-sound roll", () => {
  const [c] = records("drown"), w = world(1), rand = new JavaRandom(c.seed);
  const [mx, my, mz] = c.motion, e = { x: c.x, y: c.y, z: c.z, vx: mx, vy: my, vz: mz, air: c.air };
  c.ticks.forEach(([air, expected, attacks], t) => {
    const calls = [], fx = { spawn: (...a) => calls.push(a) };
    // The probe's entity starts dry, so its first tick is the water-entry splash.
    if (t === 0) enterWater(fx, { x: e.x, z: e.z, minY: e.y, width: Math.fround(0.9), mx, my, mz }, rand);
    const drowned = breathe(w, e, Math.fround(1.3), rand, fx);
    // EntityLiving.onEntityUpdate then rolls the living sound (EntityAnimal: 120 ticks).
    livingSoundRoll(e, rand, 120);
    assert.equal(e.air, air, `tick ${t} air`);
    assert.deepEqual(calls, expected, `tick ${t} calls`);
    assert.deepEqual(drowned ? [["drown", 2]] : [], attacks, `tick ${t} attack`);
  });
  const dry = { x: 10.5, y: 70, z: 10.5, air: -5 };
  assert.equal(breathe(w, dry, 1.3, rand, null), false);
  assert.equal(dry.air, 300);
});
