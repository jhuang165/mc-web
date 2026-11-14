// Replays public/research/snowcloud-particle-reference.json (tools/probes/SnowCloudParticleProbe.java through
// tools/verify-snowcloud-particles.mjs): the snowshovel, cloud and footstep particles built by the unchanged
// RenderGlobal.doSpawnParticle (constructor, every onUpdate, the renderParticle vertices of the first two).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { Fx } from "./fx.js";
import { spriteQuad, colorByte } from "./particles.js";
import { footstepAlpha, footstepQuad } from "./snow-cloud-particles.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/snowcloud-particle-reference.json", import.meta.url)));
const records = (name) => ref.records.filter((c) => c.case === name);
const state = (raw) => {
  const r = new JavaRandom(0);
  r.seed = BigInt(raw);
  return r;
};
const VIEWER = [10.5, 65.62, 10.5], STONE = 3;
const PLAYER = { x: 10.5, y: 65.62, z: 10.5, minY: 64.0, my: 0.1 };

function world(fixture) {
  const get = (x, y, z) => (fixture === 2 && x === 10 && y === 66 && z === 10 ? STONE : y < 64 ? STONE : 0);
  return { get, getMeta: () => 0, solid: (x, y, z) => get(x, y, z) === STONE };
}
function system(math, seed, w, fixture) {
  const r = state(math), random = () => r.nextDouble();
  let first = seed;
  const entityRandom = () => {
    const s = first ?? 0;
    first = null;
    return state(s);
  };
  const fx = new Fx({ random, entityRandom, world: w });
  fx.viewer = VIEWER;
  if (fixture === 5) fx.nearestPlayer = () => PLAYER; // the probe's World.playerEntities holds one player
  return fx;
}

test("snowshovel, cloud and footstep constructors and full lifetimes replay the original classes", () => {
  const list = records("particle");
  assert.equal(list.length, 12);
  assert.deepEqual([...new Set(list.map((c) => c.kind))], ["snowshovel", "cloud", "footstep"]);
  for (const c of list) {
    const w = world(c.fixture), fx = system(c.math, c.initial.seed, w, c.fixture), q = c.initial, what = `${c.kind} fixture ${c.fixture} ${c.args}`;
    const p = fx.spawn(c.kind, ...c.args);
    assert.ok(p, what + " spawned");
    const maxAge = c.kind === "footstep" ? p.stepsMax : p.max;
    assert.deepEqual([p.x, p.y, p.z, p.mx, p.my, p.mz, p.jx, p.jy, p.gravity, [p.r, p.g, p.b], p.width, p.height, p.yOffset],
      [q.x, q.y, q.z, q.vx, q.vy, q.vz, q.jx, q.jy, q.gravity, q.rgb, q.width, q.height, q.yOffset], what + " constructor");
    if (c.kind !== "footstep") assert.deepEqual([p.scale, maxAge], [q.scale, q.maxAge], what + " scale and life");
    assert.deepEqual(p.box, q.box, what + " box");
    assert.equal(p.layer, c.layer, what + " layer");
    const tracks = c.kind === "footstep" ? [] : c.tracks;
    tracks.forEach((expected, t) => {
      fx.step(w, p);
      assert.deepEqual([p.x, p.y, p.z, p.mx, p.my, p.mz, p.age, p.tex, !!p.dead, p.onGround, p.r, p.g, p.b], expected, `${what} tick ${t}`);
    });
    if (c.kind !== "footstep") assert.equal(!!p.dead, true, what + " dies");
  }
});

test("a footstep ignores its particle age: it stays put and dies on its 200th update", () => {
  const [r] = records("footlife"), w = world(0), fx = system(ref.records.find((c) => c.kind === "footstep").math, 0, w, 0);
  const p = fx.spawn("footstep", 10.5, 64, 10.5, 0, 0, 0);
  let ticks = 0;
  while (!p.dead && ticks < 1000) {
    fx.step(w, p);
    ticks++;
  }
  assert.equal(ticks, r.ticks);
  assert.deepEqual([p.x, p.y, p.z, p.mx, p.my, p.mz], [...r.pos, ...r.motion]);
  assert.equal(p.layer, r.layer);
});

test("footprint draw: alpha follows the (2 - 2t^2) * 0.2 ramp and the quad is flat, 0.25 across (bytecode-read)", () => {
  const p = { x: 10.5, y: 64, z: 10.5, steps: 0, stepsMax: 200 };
  assert.equal(footstepAlpha(p, 0), Math.fround(0.2));
  p.steps = 100; // t = 0.5, t^2 = 0.25: 2 - 0.5 = 1.5, capped at 1
  assert.equal(footstepAlpha(p, 0), Math.fround(0.2));
  p.steps = 200; // t = 1: 2 - 2 = 0
  assert.equal(footstepAlpha(p, 0), 0);
  p.steps = 150; // t = 0.75, t^2 = 0.5625: 2 - 1.125 = 0.875
  assert.equal(footstepAlpha(p, 0), Math.fround(Math.fround(0.875) * Math.fround(0.2)));
  const q = footstepQuad(p, [0, 0, 0]);
  assert.deepEqual(q.map((v) => [v[3], v[4]]), [[0, 1], [1, 1], [1, 0], [0, 0]]);
  assert.ok(q.every((v) => v[1] === 64));
  assert.equal(q[1][0] - q[0][0], 0.25);
  assert.equal(q[0][2] - q[3][2], 0.25);
});

test("a cloud with no player nearby ignores the pull; a distant one does too", () => {
  const w = world(0), fx = system(5, 7, w, 0);
  fx.nearestPlayer = () => ({ ...PLAYER, x: 30, z: 30 });
  const p = fx.spawn("cloud", 10.5, 66.2, 10.5, 0, 0, 0);
  const y0 = p.y;
  fx.step(w, p);
  assert.ok(Math.abs(p.y - y0) < 0.1);
});

const color = (p) => ((colorByte(p.a) << 24) | (colorByte(p.b) << 16) | (colorByte(p.g) << 8) | colorByte(p.r)) | 0;
for (const r of records("draw"))
  test(`${r.kind} draws the original vertices`, () => {
    for (const frame of r.frames) {
      const s = frame.state, own = Object.values(s.own)[0];
      const p = { px: s.prev[0], py: s.prev[1], pz: s.prev[2], x: s.pos[0], y: s.pos[1], z: s.pos[2], age: s.age, max: s.max, scale: s.scale, tex: s.tex,
        jx: s.jitter[0], jy: s.jitter[1], r: s.rgba[0], g: s.rgba[1], b: s.rgba[2], a: s.rgba[3], box: [0, s.box[0], 0, 0, s.box[1], 0], yOffset: s.yOffset, layer: s.layer,
        kind: r.kind, base: own };
      for (const d of frame.draws) {
        const [x, xz, z, yz, xy] = d.basis, basis = { x, xz, z, yz, xy };
        assert.equal(Fx.prototype.brightness.call(null, p, d.partial, r.light), d.brightness, `${r.kind} brightness`);
        const ours = spriteQuad(p, d.partial, basis, Fx.prototype.sprite.call(null, p, d.partial));
        assert.equal(ours.length, d.vertices.length);
        d.vertices.forEach((v, i) => {
          for (let k = 0; k < 5; k++) assert.ok(ours[i][k] === v[k], `${r.kind} vertex ${i}[${k}] ${ours[i][k]} != ${v[k]} tick ${frame.tick} partial ${d.partial}`);
          assert.equal(color(p), v[5], `${r.kind} colour`);
        });
      }
    }
  });

// BlockPumpkin.onBlockAdded (bytecode-read): building a snow golem spawns 120 "snowshovel" over the column, three
// World.rand doubles each; the iron golem branch spawns none.
test("building a snow golem spawns 120 snowshovel particles from the world random", async () => {
  const { installMooshroomGolem } = await import("./mooshroom-golem-live.js");
  const { SNOW_BLOCK, IRON_BLOCK } = await import("./snow-golem.js");
  const { PUMPKIN } = await import("./world.js");
  class Stub {}
  installMooshroomGolem(Stub);
  const make = (below) => {
    const m = new Stub(), calls = [];
    const cells = new Map([["5,70,5", PUMPKIN], ["5,69,5", below], ["5,68,5", below]]);
    m.world = { get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? 0, set: (x, y, z) => cells.delete(`${x},${y},${z}`) };
    m.entities = [];
    m.create = (type, x, y, z) => ({ type, x, y, z });
    m.spawnIronGolem = () => {};
    m.fx = { worldRandom: new JavaRandom(99), spawn: (...a) => calls.push(a) };
    return { m, calls };
  };
  const snow = make(SNOW_BLOCK);
  assert.ok(snow.m.tryBuildGolem(5, 70, 5));
  assert.equal(snow.calls.length, 120);
  const r = new JavaRandom(99);
  for (const c of snow.calls) {
    assert.deepEqual(c, ["snowshovel", 5 + r.nextDouble(), 68 + r.nextDouble() * 2.5, 5 + r.nextDouble(), 0, 0, 0]);
  }
  const iron = make(IRON_BLOCK);
  iron.m.tryBuildGolem(5, 70, 5);
  assert.equal(iron.calls.length, 0);
});
