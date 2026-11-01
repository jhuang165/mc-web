import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./lighting.js";
import { isPlant, SNOW_LAYER } from "./world.js";
import { TILES } from "./block-textures.js";
import { rayBounds } from "./projectiles.js";
import { ParticleSystem, PARTICLE_LIMIT, particleTile, particleBasis, particleQuad, particleLightCell, quantize, spawnRunningParticles, vanillaBlock } from "./particles.js";

const reference = JSON.parse(await readFile(new URL("../public/research/particle-reference.json", import.meta.url)));
const record = (name) => reference.records.find((r) => r.case === name);
const near = (a, b, e = 1e-9, what = "") => assert.ok(Math.abs(a - b) <= e, `${what} ${a} != ${b}`);

// A java.util.Random positioned at a recorded internal state (not a seed).
const stateRandom = (raw) => {
  const r = new JavaRandom(0);
  r.seed = BigInt(raw);
  return r;
};

// The probe's world in this build's ids: stone below y 64, plus its cells.
function stage() {
  const cells = new Map(), key = (x, y, z) => x + "," + y + "," + z;
  return {
    put(x, y, z, id, meta = 0) {
      cells.set(key(x, y, z), [id, meta]);
    },
    get(x, y, z) {
      return cells.get(key(x, y, z))?.[0] ?? (y < 64 ? 3 : 0);
    },
    getMeta(x, y, z) {
      return cells.get(key(x, y, z))?.[1] ?? 0;
    },
    solid(x, y, z) {
      const b = this.get(x, y, z);
      if (b === SNOW_LAYER) return (this.getMeta(x, y, z) & 7) !== 0;
      return b !== 0 && b !== 10 && b !== 42 && b !== 20 && b !== 45 && b !== 51 && !isPlant(b);
    },
  };
}
const world = stage();
// destroy-pocket: stone above and at +x, cobwebs at +z and -x.
world.put(20, 65, 20, 3);
world.put(21, 64, 20, 3);
world.put(21, 65, 20, 3);
world.put(20, 64, 21, 51);
world.put(19, 64, 20, 51);
world.put(30, 65, 30, 3); // hit-stone-*
world.put(34, 64, 34, 29); // hit-farmland-1
world.put(36, 64, 36, 38); // hit-wheat-2 (wheat meta 7)
world.put(50, 63, 50, 1); // dust-* (grass)

// A system replaying one probe case: Math.random from its recorded state and
// each particle's Entity.rand from the state recorded for it.
function replaying(rec, extra = {}) {
  const math = stateRandom(rec.math), seeds = rec.particles.map((p) => p.seed);
  let n = 0;
  const system = new ParticleSystem({ random: () => math.nextDouble(), entityRandom: () => stateRandom(seeds[n++]), ...extra });
  system.math = math;
  return system;
}
function sameParticle(p, q, what, { rgb = true } = {}) {
  for (const [a, b] of [["x", "x"], ["y", "y"], ["z", "z"], ["mx", "vx"], ["my", "vy"], ["mz", "vz"], ["jx", "jx"], ["jy", "jy"], ["scale", "scale"], ["gravity", "gravity"], ["width", "width"], ["height", "height"], ["yOffset", "yOffset"]])
    near(p[a], q[b], 1e-12, `${what} ${a}`);
  assert.equal(p.max, q.maxAge, `${what} maxAge`);
  assert.equal(TILES[p.tile], q.icon, `${what} icon`);
  if (rgb) assert.deepEqual([p.r, p.g, p.b], q.rgb, `${what} rgb`);
  p.box.forEach((v, i) => near(v, q.box[i], 1e-12, `${what} box[${i}]`));
}
// EffectRenderer.updateEffects until every particle of the case has died,
// comparing [posX, posY, posZ, onGround] after each tick it was alive for.
function sameTracks(system, made, rec, name) {
  if (rec.tracks.every((t) => !t.length)) return 0;
  const seen = made.map(() => 0);
  for (let t = 0; t < 200 && made.some((p) => !p.dead); t++) {
    const alive = made.map((p) => !p.dead);
    system.tick(world);
    made.forEach((p, k) => {
      if (!alive[k]) return;
      const want = rec.tracks[k][seen[k]++];
      assert.ok(want, `${name} #${k} lived past the original (tick ${t})`);
      near(p.x, want[0], 1e-9, `${name} #${k} t${t} x`);
      near(p.y, want[1], 1e-9, `${name} #${k} t${t} y`);
      near(p.z, want[2], 1e-9, `${name} #${k} t${t} z`);
      assert.equal(p.onGround ? 1 : 0, want[3], `${name} #${k} t${t} onGround`);
    });
  }
  made.forEach((p, k) => assert.equal(seen[k], rec.tracks[k].length, `${name} #${k} track length`));
  assert.equal(system.list.length, 0);
  return seen.reduce((a, b) => a + b, 0);
}

test("the probe ran on the unchanged 1.7.10 client", () => {
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.equal(reference.records.length, 529);
});

test("Block.getIcon(0, meta), the particle icon, for every block of this build", () => {
  const blocks = record("blocks").blocks;
  for (const b of blocks) {
    assert.equal(TILES[particleTile(b.id, b.meta)], b.icon, `block ${b.id}:${b.meta}`);
    assert.equal(b.gravity, 1, "blockParticleGravity");
    assert.deepEqual(vanillaBlock(b.id, b.meta, b.mc === 62), [b.mc, b.meta], `vanilla id of ${b.id}`);
  }
  // The chest's block icon is planks_oak, not the chest texture's top.
  assert.equal(TILES[particleTile(41, 2)], "planks_oak");
  for (const id of [0, 10, 42, 45]) assert.equal(particleTile(id), -1);
  // Only leaves have a render colour (0x48B518); see particles.md for the atlas substitution.
  assert.deepEqual([...new Set(blocks.filter((b) => b.id !== 1 && b.id !== 39).map((b) => b.renderColor))].sort((a, b) => a - b), [4764952, 16777215]);
});

test("hit bounds match the original's fixed block bounds", () => {
  const blocks = record("blocks").blocks;
  // Torches, ladders and snow take their bounds from setBlockBoundsBasedOnState (selection);
  // the rest are fixed in their constructors.
  for (const b of blocks.filter((b) => [29, 30, 39, 41, 43, 44, 48, 49, 50].includes(b.id) || (b.id >= 31 && b.id <= 38))) {
    const w = stage();
    w.put(0, 70, 0, b.id, b.meta);
    rayBounds(w, 0, 70, 0, b.id).forEach((v, i) => near(v, b.bounds[i], 1e-7, `bounds ${b.id}:${b.meta}[${i}]`));
  }
});

test("addBlockDestroyEffects: 64 particles in a 4 x 4 x 4 grid, replayed with their lifetimes and paths", () => {
  let checked = 0;
  for (const [name, x, y, z, id, meta] of [["destroy-stone", 10, 64, 10, 3, 0], ["destroy-pocket", 20, 64, 20, 2, 0], ["destroy-wool", 12, 64, 12, 19, 14], ["destroy-wheat", 14, 64, 14, 38, 0]]) {
    const rec = record(name), system = replaying(rec);
    assert.equal(system.destroyBlock(world, x, y, z, id, meta), 64);
    assert.equal(system.list.length, rec.particles.length);
    const made = [...system.list];
    made.forEach((p, k) => sameParticle(p, rec.particles[k], `${name} #${k}`));
    assert.deepEqual(made.map((p) => p.max), rec.particles.map((p) => p.maxAge));
    checked += sameTracks(system, made, rec, name);
  }
  assert.ok(checked > 2000);
});

test("addBlockHitEffects: one particle per call pushed 0.1 out of the face, motion x 0.2, scale x 0.6", () => {
  // EffectRenderer.rand is new Random(7) before hit-stone-0 and runs on through the cases.
  const rand = new JavaRandom(7);
  for (const [name, x, y, z, side] of [...[0, 1, 2, 3, 4, 5].map((s) => ["hit-stone-" + s, 30, 65, 30, s]), ["hit-farmland-1", 34, 64, 34, 1], ["hit-wheat-2", 36, 64, 36, 2]]) {
    const rec = record(name), system = replaying(rec, { rand });
    for (let k = 0; k < 4; k++) assert.ok(system.hitBlock(world, x, y, z, side));
    const made = [...system.list];
    assert.equal(made.length, 4);
    made.forEach((p, k) => sameParticle(p, rec.particles[k], `${name} #${k}`));
    sameTracks(system, made, rec, name);
  }
  // Air makes nothing and draws nothing.
  const before = rand.seed, system = new ParticleSystem({ rand });
  assert.equal(system.hitBlock(world, 38, 64, 38, 1), null);
  assert.equal(rand.seed, before);
  assert.equal(record("hit-air").particles.length, 0);
});

test("Entity.onEntityUpdate: a sprinting entity throws one blockcrack per tick from the block under its feet", () => {
  for (const [vid, vmeta, id, meta] of [[1, 0, 3, 0], [2, 0, 1, 0], [35, 14, 19, 14], [18, 0, 5, 0]]) {
    const name = `sprint-${vid}-${vmeta}`, rec = record(name), system = replaying(rec), rand = new JavaRandom(99);
    world.put(40, 63, 40, id, meta);
    const runner = { x: 40.3, y: 64, z: 40.7, mx: 0.28, mz: -0.11, sprinting: true, inWater: false };
    for (let k = 0; k < 3; k++) assert.ok(spawnRunningParticles(system, world, runner, rand, [40.3, 65.62, 40.7]));
    const made = [...system.list];
    assert.equal(made.length, rec.calls.length);
    rec.calls.forEach((c, k) => {
      assert.equal(c[0], `blockcrack_${vid}_${vmeta}`);
      near(made[k].x, c[1], 1e-12);
      near(made[k].y, c[2], 1e-12);
      near(made[k].z, c[3], 1e-12);
    });
    // On leaves the original multiplies by getRenderColor (0x48B518); the atlas tile here
    // already carries the biome foliage colour, so the particle keeps 0.6.
    made.forEach((p, k) => sameParticle(p, rec.particles[k], `${name} #${k}`, { rgb: id !== 5 }));
    if (id === 5) {
      const c = 4764952, f = Math.fround, want = [c >> 16, (c >> 8) & 255, c & 255].map((v) => f(f(0.6) * f(v / 255)));
      assert.deepEqual(rec.particles[0].rgb, want);
      assert.deepEqual([made[0].r, made[0].g, made[0].b], [f(0.6), f(0.6), f(0.6)]);
    }
    sameTracks(system, made, rec, name);
  }
  // Out of the 16-block range of the view entity: nothing, and Math.random is not drawn.
  const far = record("sprint-far"), system = replaying(far);
  assert.equal(record("far-math").before, record("far-math").after);
  assert.equal(spawnRunningParticles(system, world, { x: 40.3, y: 64, z: 40.7, mx: 0, mz: 0, sprinting: true, inWater: false }, new JavaRandom(99), [60, 65.62, 40.7]), null);
  assert.equal(system.math.seed, BigInt(far.math));
  // Not sprinting, in water last tick, or over air: nothing.
  assert.equal(system.running(world, { x: 40.3, y: 64, z: 40.7, mx: 0.3, mz: 0, sprinting: false }, new JavaRandom(1)), null);
  assert.equal(system.running(world, { x: 40.3, y: 64, z: 40.7, mx: 0.3, mz: 0, sprinting: true, inWater: true }, new JavaRandom(1)), null);
  assert.equal(system.running(world, { x: 40.3, y: 70, z: 40.7, mx: 0.3, mz: 0, sprinting: true }, new JavaRandom(1)), null);
});

test("playAuxSFX 2006: 150 x min(0.2 + data / 15, 2.5) blockdust from the top of the block landed on", () => {
  for (const data of [1, 4, 12, 40]) {
    const name = "dust-" + data, rec = record(name), system = replaying(rec, { worldRandom: new JavaRandom(5) });
    const count = system.landingDust(world, 50, 63, 50, data, [50.5, 65.62, 50.5]);
    assert.equal(count, rec.particles.length);
    assert.equal(system.list.length, rec.calls.length);
    const made = [...system.list];
    rec.calls.forEach((c, k) => {
      assert.equal(c[0], "blockdust_2_0");
      // EntityBlockDustFX keeps the given velocity exactly.
      assert.deepEqual([made[k].mx, made[k].my, made[k].mz], c.slice(4));
    });
    made.forEach((p, k) => sameParticle(p, rec.particles[k], `${name} #${k}`));
    sameTracks(system, made, rec, name);
  }
  assert.deepEqual([1, 4, 12, 40].map((d) => record("dust-" + d).particles.length), [40, 70, 150, 375]);
  assert.equal(new ParticleSystem().landingDust(world, 52, 70, 52, 4), 0);
});

test("EffectRenderer.addEffect keeps at most 4000 per layer, dropping the oldest", () => {
  const system = new ParticleSystem();
  for (let i = 0; i < 70; i++) system.destroyBlock(world, 10, 64, 10, 3, 0);
  assert.equal(PARTICLE_LIMIT, 4000);
  assert.equal(system.list.length, 4000);
  const first = system.list[0];
  system.destroyBlock(world, 10, 64, 10, 3, 0);
  assert.equal(system.list.length, 4000);
  assert.ok(!system.list.includes(first));
  system.clear();
  assert.equal(system.list.length, 0);
  assert.equal(system.destroyBlock(world, 10, 64, 10, 45, 0), 0);
});

test("EntityDiggingFX.renderParticle: billboard corners from ActiveRenderInfo and a 4-pixel icon window", () => {
  // Yaw 0, pitch 0 (facing south): rotationX 1, rotationZ 0, rotationYZ 0, rotationXY 0, rotationXZ 1.
  const b = particleBasis(0, 0);
  assert.deepEqual([b.x, b.z, b.yz, b.xy, b.xz], [1, 0, -0, 0, 1]);
  // Front view (thirdPersonView 2) mirrors the horizontal terms.
  const m = particleBasis(0, 0, true);
  assert.deepEqual([m.x, m.z, m.xz], [-1, -0, 1]);
  // Looking straight down (pitch 90): the quad lies flat.
  const down = particleBasis(0, 90);
  near(down.xz, 0, 1e-4);
  near(down.xy, 1, 1e-4);
  const p = { x: 1, y: 2, z: 3, px: 0, py: 2, pz: 3, scale: 10, jx: 0, jy: 2 };
  // s = 0.1 x scale; partial 0.5 is halfway from prevPos; corners (u0, v1), (u0, v0), (u1, v0), (u1, v1).
  const q = particleQuad(p, 0.5, b, [0, 16], [0, 16]);
  q.forEach((c, i) => [0.5 + [-1, -1, 1, 1][i], 2 + [-1, 1, 1, -1][i], 3].forEach((v, k) => near(c[k], v, 1e-6)));
  assert.deepEqual(q.map((c) => [c[3], c[4]]), [[0, 12], [0, 8], [4, 8], [4, 12]]);
  // The renderer maps this build's camera yaw 0 (facing -z) to Java yaw 180.
  const north = particleBasis(180, 0);
  near(north.x, -1, 1e-6);
  near(north.z, 0, 1e-4);
  // Brightness cell: floor(posY - yOffset + height x 0.66), and colour quantised to /255.
  assert.deepEqual(particleLightCell({ x: 1.5, y: 2.95, z: 3.5, yOffset: 0.1, box: [0, 2.85, 0, 0, 3.05, 0] }), [1, 2, 3]);
  assert.deepEqual(particleLightCell({ x: 1.5, y: 2.95, z: 3.5, yOffset: 0.1, box: [0, 2.85, 0, 0, 4.05, 0] }), [1, 3, 3]);
  assert.equal(quantize(Math.fround(0.6)), 153 / 255);
  assert.equal(quantize(Math.fround(0.6) * Math.fround(72 / 255)), 43 / 255);
});
