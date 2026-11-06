// Replays public/research/extra-particle-reference.json (tools/probes/ExtraParticleProbe.java through
// tools/verify-extra-particles.mjs): the reddust, enchantmenttable and slime particles (constructor, every
// onUpdate, renderParticle vertices) and the Block.randomDisplayTick of their emitters.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { Fx } from "./fx.js";
import { ExplosionParticles } from "./explosion-particles.js";
import { randomDisplayTick } from "./display-ticks.js";
import { particleQuad, spriteQuad, colorByte } from "./particles.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/extra-particle-reference.json", import.meta.url)));
const records = (name) => ref.records.filter((c) => c.case === name);
const state = (raw) => {
  const r = new JavaRandom(0);
  r.seed = BigInt(raw);
  return r;
};
const VIEWER = [10.5, 65.62, 10.5], STONE = 3;

// Probe fixtures: stone below y 64; 1 a water pool (unused here), 2 stone at (10, 66, 10).
function world(fixture) {
  const get = (x, y, z) => (fixture === 2 && x === 10 && y === 66 && z === 10 ? STONE : y < 64 ? STONE : 0);
  return { get, getMeta: () => 0, solid: (x, y, z) => get(x, y, z) === STONE };
}
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
  return fx;
}

test("reddust, enchantmenttable and slime constructors and full lifetimes replay the original classes", () => {
  const list = records("particle");
  assert.equal(list.length, 14);
  assert.deepEqual([...new Set(list.map((c) => c.kind))], ["reddust", "enchantmenttable", "slime"]);
  for (const c of list) {
    const w = world(c.fixture), fx = system(c.math, c.initial.seed, w), q = c.initial, what = `${c.kind} fixture ${c.fixture} ${c.args}`;
    const p = fx.spawn(c.kind, ...c.args);
    assert.ok(p, what + " spawned");
    assert.deepEqual([p.x, p.y, p.z, p.mx, p.my, p.mz, p.jx, p.jy, p.scale, p.max, p.gravity, [p.r, p.g, p.b], p.width, p.height, p.yOffset],
      [q.x, q.y, q.z, q.vx, q.vy, q.vz, q.jx, q.jy, q.scale, q.maxAge, q.gravity, q.rgb, q.width, q.height, q.yOffset], what + " constructor");
    assert.deepEqual(p.box, q.box, what + " box");
    assert.equal(p.layer, c.layer, what + " layer");
    c.tracks.forEach((expected, t) => {
      fx.step(w, p);
      assert.deepEqual([p.x, p.y, p.z, p.mx, p.my, p.mz, p.age, p.tex, !!p.dead, p.onGround, p.r, p.g, p.b], expected, `${what} tick ${t}`);
    });
    assert.equal(!!p.dead, true, what + " dies");
  }
});

test("a rejected spawn (Minimal setting or out of range) draws no randomness", () => {
  const fx = new Fx({ worldRandom: new JavaRandom(1) });
  fx.viewer = VIEWER;
  assert.equal(fx.spawn("reddust", 80, 64, 80, 0, 0, 0), null);
  fx.setting = 2;
  assert.equal(fx.spawn("enchantmenttable", 10.5, 66, 10.5, 0, -1, 0), null);
});

// The probe's IIcon for items spans 0..1 in both axes.
const ICON = [[0, 1], [0, 1]];
const color = (p) => ((colorByte(p.a) << 24) | (colorByte(p.b) << 16) | (colorByte(p.g) << 8) | colorByte(p.r)) | 0;
const KIND = { enchantmenttable: "enchant", slime: "iconcrack" };
for (const r of records("draw"))
  test(`${r.kind} draws the original vertices`, () => {
    for (const frame of r.frames) {
      const s = frame.state, own = Object.values(s.own)[0];
      const p = { px: s.prev[0], py: s.prev[1], pz: s.prev[2], x: s.pos[0], y: s.pos[1], z: s.pos[2], age: s.age, max: s.max, scale: s.scale, tex: s.tex,
        jx: s.jitter[0], jy: s.jitter[1], r: s.rgba[0], g: s.rgba[1], b: s.rgba[2], a: s.rgba[3], box: [0, s.box[0], 0, 0, s.box[1], 0], yOffset: s.yOffset, layer: s.layer,
        kind: KIND[r.kind] ?? r.kind, base: own };
      for (const d of frame.draws) {
        const [x, xz, z, yz, xy] = d.basis, basis = { x, xz, z, yz, xy };
        const light = p.layer === 0 ? Fx.prototype.brightness.call(null, p, d.partial, r.light) : r.light;
        assert.equal(light, d.brightness, `${r.kind} brightness`);
        const ours = p.layer === 0 ? spriteQuad(p, d.partial, basis, Fx.prototype.sprite.call(null, p, d.partial)) : particleQuad(p, d.partial, basis, ...ICON);
        assert.equal(ours.length, d.vertices.length);
        d.vertices.forEach((v, i) => {
          for (let k = 0; k < 5; k++) assert.ok(ours[i][k] === v[k], `${r.kind} vertex ${i}[${k}] ${ours[i][k]} != ${v[k]} tick ${frame.tick} partial ${d.partial}`);
          assert.equal(color(p), v[5], `${r.kind} colour`);
        });
      }
    }
  });

// Original ids -> this build's: lit/unlit torch, wire, lit/unlit ore, repeater, enchanting table, bookshelf, stone.
const ID = { 76: 120, 75: 119, 55: 107, 74: 65, 73: 64, 93: 112, 94: 112, 116: 86, 47: 21, 1: STONE };
function displayWorld(c) {
  const cells = new Map([["10,70,10", [ID[c.block], c.meta ?? 0]]]);
  for (const [x, y, z, id, meta] of c.cells ?? []) cells.set(`${x},${y},${z}`, [ID[id], meta]);
  const cell = (x, y, z) => cells.get(`${x},${y},${z}`) ?? [y < 64 ? STONE : 0, 0];
  return { get: (x, y, z) => cell(x, y, z)[0], getMeta: (x, y, z) => cell(x, y, z)[1] };
}

test("wire, redstone torch, redstone ore and enchanting table display ticks replay the original spawns and draws", () => {
  const list = records("display");
  assert.equal(list.length, 17);
  let spawned = 0;
  for (const c of list) {
    const w = displayWorld(c);
    for (const [seed, expected, after, worldAfter] of c.runs) {
      const calls = [], rand = new JavaRandom(seed), world = new JavaRandom(seed + 1000);
      const fx = { spawn: (name, x, y, z, vx = 0, vy = 0, vz = 0) => calls.push([name, x, y, z, vx, vy, vz]) };
      randomDisplayTick(w, 10, 70, 10, w.get(10, 70, 10), rand, { fx, worldRand: world });
      const what = `${c.name} seed ${seed}`;
      assert.deepEqual(calls, expected, what);
      assert.equal(rand.seed, BigInt(after), what + " tick draws");
      assert.equal(world.seed, BigInt(worldAfter), what + " World.rand draws");
      spawned += calls.length;
    }
  }
  assert.ok(spawned > 700, `${spawned} spawns: `+"the cases exercise the spawns");
});

test("the powered repeater slides reddust along its delay slot; an unpowered one spawns nothing", () => {
  const list = records("repeater");
  assert.equal(list.length, 2);
  for (const c of list)
    for (const m of c.metas) {
      const w = { get: (x, y, z) => (x === 10 && y === 70 && z === 10 ? 112 : y < 64 ? STONE : 0), getMeta: () => m.meta };
      for (const [seed, expected, after] of m.runs) {
        const calls = [], rand = new JavaRandom(seed), fx = { spawn: (name, ...a) => calls.push([name, ...a]) };
        randomDisplayTick(w, 10, 70, 10, 112, rand, { fx, repeaterLit: () => c.block === 94 });
        assert.deepEqual(calls, expected, `block ${c.block} meta ${m.meta} seed ${seed}`);
        assert.equal(rand.seed, BigInt(after));
      }
    }
});
