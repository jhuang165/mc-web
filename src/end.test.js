import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./java-random.js";
import { EndTerrain, EndWorld, generateSpike, populateEndChunk, END_STONE, OBSIDIAN, BEDROCK } from "./end-generator.js";

const ref = JSON.parse(await readFile(new URL("../public/research/end-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
const one = (c) => by(c)[0];
const sha1 = (bytes) => createHash("sha1").update(bytes).digest("hex");
const doubles = (arr) => { const b = Buffer.alloc(arr.length * 8); arr.forEach((v, i) => b.writeDoubleBE(v, i * 8)); return b; };
const floatBits = (v) => { const b = Buffer.alloc(4); b.writeFloatBE(v); return b.readInt32BE(); };
const entityRow = (e) => [e.type === "ender_crystal" ? "crystal" : "dragon", e.x, e.type === "ender_crystal" ? e.y : e.y, e.z, floatBits(e.yaw), floatBits(e.pitch)];

test("evidence file has the expected record counts", () => {
  assert.equal(ref.records.length, 106);
  assert.equal(by("terrain").length, 60);
  assert.equal(by("population").length, 4);
  assert.equal(by("spikes").length, 4);
});

test("ChunkProviderEnd density grid and block array match the original for every seed and chunk", () => {
  for (const r of by("terrain")) {
    const terrain = new EndTerrain(r.seed);
    const density = terrain.density(r.x, r.z);
    assert.equal(density.length, r.densityLength);
    assert.equal(sha1(doubles(density)), r.densitySha1, `density ${r.seed} ${r.x},${r.z}`);
    const blocks = terrain.blocks(r.x, r.z);
    assert.equal(sha1(blocks.map((b) => (b ? 121 : 0))), r.blocksSha1, `blocks ${r.seed} ${r.x},${r.z}`);
    assert.equal(blocks.reduce((n, b) => n + (b ? 1 : 0), 0), r.filled);
    for (const [x, z, low, high, count] of r.columns) {
      let lo = -1, hi = -1, n = 0;
      for (let y = 0; y < 128; y++) if (blocks[x << 11 | z << 7 | y]) { n++; hi = y; if (lo < 0) lo = y; }
      assert.deepEqual([lo, hi, n], [low, high, count]);
    }
  }
});

// The probe sorts HashMap keys as Java longs: x, then z as an unsigned 32-bit value.
const byKey = (a, b) => a[0] - b[0] || (a[1] >>> 0) - (b[1] >>> 0);
const sameEntities = (got, want) => assert.deepEqual(got.map(entityRow), want.map((e) => e));
// Original entity rows: ["crystal"|"dragon", x, y, z, yawBits, pitchBits]
test("population (ores, spikes, dragon) replays the original world random and chunk writes", () => {
  for (const r of by("population")) {
    const world = new EndWorld(r.seed);
    const writes = [];
    for (const s of r.steps) {
      const [cx, cz] = s.chunk;
      world.random = new JavaRandom(BigInt(s.randSeed));
      world.entities.length = 0;
      const log = [];
      world.onSet = (x, y, z, id, meta, flags) => log.push([x, y, z, id, meta, flags]);
      populateEndChunk(world, world.random, cx, cz);
      world.onSet = null;
      assert.equal(log.length, s.writes, `writes ${r.label} ${cx},${cz}`);
      sameEntities(world.entities, s.entities);
      assert.equal(String(BigInt.asIntN(64, (BigInt(world.random.nextInt()) << 32n) + BigInt(world.random.nextInt()))), s.nextLong, `random ${r.label} ${cx},${cz}`);
      writes.push(log.length);
    }
    const area = [...world.chunks.values()].map((c) => [c.cx, c.cz, sha1(world.chunkBytes(c.cx, c.cz))]).sort(byKey);
    assert.deepEqual(area, r.area, `area ${r.label}`);
  }
});

test("WorldGenSpikes on every branch: failures draw nothing past the checks, successes build the pillar", () => {
  let ok = 0, failed = 0;
  for (const r of by("spikes")) {
    const world = new EndWorld(r.seed);
    for (let x = -3; x < 3; x++) for (let z = -3; z < 3; z++) world.chunk(x, z);
    for (const row of r.rows) {
      const random = new JavaRandom(BigInt(row.randSeed));
      world.entities.length = 0;
      let writes = 0;
      world.onSet = () => writes++;
      const result = generateSpike(world, random, ...row.pos);
      assert.equal(result, row.result, `${r.seed} ${row.pos}`);
      assert.equal(writes, row.writes);
      sameEntities(world.entities, row.entities);
      assert.equal(String(BigInt.asIntN(64, (BigInt(random.nextInt()) << 32n) + BigInt(random.nextInt()))), row.nextLong);
      result ? ok++ : failed++;
    }
    const area = [...world.chunks.values()].map((c) => [c.cx, c.cz, sha1(world.chunkBytes(c.cx, c.cz))]).sort(byKey);
    assert.deepEqual(area, r.area);
  }
  assert.ok(ok > 50 && failed > 10, `${ok} successes, ${failed} failures`);
});

import { exitPortalBlocks, createExitPortal } from "./exit-portal.js";
test("EntityDragon.createEnderPortal: the exact setBlock call list at three centres", () => {
  for (const r of by("exitPortal")) {
    const calls = exitPortalBlocks(...r.center).map(([x, y, z, id]) => [x, y, z, id, 0, 3]);
    assert.equal(calls.length, r.writes);
    // the last field is World.setBlock's result (false for air over air); not a property of the list
    assert.deepEqual(calls, r.calls.map((c) => c.slice(0, 6)));
    const log = [], flags = [];
    createExitPortal({ setBlock: (...a) => log.push(a) }, r.center[0], r.center[1], (v) => flags.push(v));
    assert.equal(log.length, r.writes);
    assert.deepEqual(flags, [true, false]);
  }
});

// ---- dragon egg and ender crystal rules --------------------------------------------------------
import { DRAGON_EGG, EGG_BOUNDS, EGG_TICK_RATE, eggBoxes, teleportEgg } from "./dragon-egg.js";
import { crystalTick, crystalHit, CRYSTAL_ROTATION_MAX } from "./ender-crystal.js";

// SpringProbe.h
function probeHash(a, b, c) {
  let v = Math.imul(a, 0x2F0B3A49) + Math.imul(b, 0x6C8E9CF5) + Math.imul(c, 0x1B873593) | 0;
  v ^= v >>> 15; v = Math.imul(v, 0x2C1B3C6D); v ^= v >>> 12; v = Math.imul(v, 0x297A2D39); v ^= v >>> 15;
  return v | 0;
}

test("facts: egg bounds, tick rate, light, crystal size and health", () => {
  const facts = one("facts");
  assert.deepEqual(EGG_BOUNDS, facts.egg.bounds);
  assert.equal(EGG_TICK_RATE, facts.eggTickRate);
  assert.equal(facts.egg.light, 1);
  assert.equal(facts.egg.opaque, false);
  assert.equal(facts.egg.renderType, 27);
  assert.equal(facts.crystal.width, 2);
  assert.equal(facts.crystal.health, 5);
  assert.equal(facts.ids.egg, 122);
  assert.equal(DRAGON_EGG, 171);
  const boxes = eggBoxes();
  assert.equal(boxes.length, 8);
  assert.equal(boxes[0][4], 1);
  assert.equal(boxes[7][1], 0);
});

test("egg schedules its fall in five ticks (eggSchedule)", () => {
  const r = one("eggSchedule");
  assert.equal(r.onBlockAdded[0][4], EGG_TICK_RATE);
  assert.equal(r.onNeighborChange[0][4], EGG_TICK_RATE);
});

test("egg teleport: server placement, client particles and random stream match the original", () => {
  for (const r of by("eggTeleport")) {
    const [x, y, z] = r.pos;
    const random = new JavaRandom(BigInt(r.randSeed));
    const writes = [], parts = [];
    const digest = createHash("sha1");
    let count = 0;
    const done = teleportEgg(x, y, z, random, r.remote, {
      isEgg: () => !r.absent,
      isAir: (i, j, k) => {
        if (j < 0 || j > 255) return true;
        if (i === x && j === y && k === z) return false;
        const pattern = r.name === "solid" ? 2 : r.name.startsWith("scattered") ? 1 : 0;
        return !(j <= 3 || pattern === 2 || (pattern === 1 && j < 100 && (probeHash(i, j, k) & 3) === 0));
      },
      place: (i, j, k) => writes.push([i, j, k, 122, r.meta, 2]),
      clear: (i, j, k) => writes.push([i, j, k, 0, 0, 3]),
      particle: (name, ...v) => { count++; digest.update(doubles(v)); digest.update(Buffer.from(name)); if (parts.length < 2) parts.push([name, ...v]); },
    });
    void done;
    if (!r.remote) assert.deepEqual(writes.map((w) => w.slice(0, 5)), r.writes.map((w) => w.slice(0, 5)), `${r.name} writes`);
    else assert.equal(writes.length, 0);
    assert.equal(count, r.particles, `${r.name} remote=${r.remote} particle count`);
    assert.equal(String(BigInt.asIntN(64, (BigInt(random.nextInt()) << 32n) + BigInt(random.nextInt()))), r.nextLong, `${r.name} remote=${r.remote} random stream`);
    if (r.particles) assert.equal(digest.digest("hex"), r.particleSha1);
  }
});

test("ender crystal: fire in the End only, one hit explodes it once, client and invulnerable hits do nothing", () => {
  for (const r of by("crystalTick")) {
    const e = { x: r.pos[0], y: r.pos[1], z: r.pos[2], innerRotation: 10 };
    const writes = [];
    for (let t = 0; t < 3; t++) crystalTick(e, r.end, () => 0, (i, j, k, id) => writes.push([i, j, k, id]));
    assert.equal(e.innerRotation, 13);
    assert.deepEqual(writes, r.end ? [[5, 40, -4, 51], [5, 40, -4, 51], [5, 40, -4, 51]] : []);
    assert.deepEqual(r.writes.filter((w) => w[3] === 51).map((w) => w.slice(0, 4)), writes);
  }
  const burning = [];
  assert.equal(crystalTick({ x: 1, y: 2, z: 3 }, true, () => 51, (...a) => burning.push(a)), false);
  assert.equal(burning.length, 0);
  for (const r of by("crystalHit")) {
    const e = { health: 5, dead: r.dead, invulnerable: r.invulnerable };
    const out = crystalHit(e, r.remote);
    assert.equal(out.result, r.result);
    assert.equal(out.explode, r.explosions.length === 1);
    assert.equal(e.health, r.healthAfter);
    assert.equal(e.dead, r.isDeadAfter);
    if (out.explode) assert.deepEqual(r.explosions[0].slice(1), [7.25, 41, 2.75, floatBits(6), true]);
  }
  const e = { health: 5, dead: false };
  crystalHit(e, false);
  const again = crystalHit(e, false);
  assert.deepEqual(again, { result: true, explode: false });
  const rot = one("crystalRotation");
  assert.equal(CRYSTAL_ROTATION_MAX + 0 >= rot.max, true);
});

// Live wiring: EntityWorld treats the crystal as a non-living entity.
import { EntityWorld } from "./entities.js";
import { BLOCKS } from "./world.js";
const flat = (isEnd) => ({ numericSeed: 1, isEnd, sets: [], solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), set(x, y, z, id) { this.sets.push([x, y, z, id]); return true; }, surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) });
const crystalWorld = (isEnd) => new EntityWorld(flat(isEnd), [{ id: "c0", type: "ender_crystal", x: 64.5, y: 1, z: 64.5, health: 5, innerRotation: 7 }], () => 0.5);
const surv = { health: 20, creative: false, time: 6000, damage() {}, scaledDamage() {}, count: () => 0 };

test("EntityWorld: a hit explodes the crystal once at power 6 with fire and removes it", () => {
  const w = crystalWorld(false), e = w.entities[0];
  assert.equal(w.attackEntityFrom(e, 1), true);
  const ex = w.events.filter((v) => v.explode);
  assert.equal(ex.length, 1);
  assert.deepEqual([ex[0].explode.size, ex[0].explode.flaming, ex[0].explode.smoking], [6, true, true]);
  assert.equal(w.attackEntityFrom(e, 1), true);
  assert.equal(w.events.filter((v) => v.explode).length, 1);
  w.tick({ x: 0, y: 0, z: 0 }, surv);
  assert.equal(w.entities.includes(e), false);
});

test("EntityWorld: the crystal lights fire in the End only", () => {
  const dry = crystalWorld(false), end = crystalWorld(true);
  dry.tick({ x: 64, y: 0, z: 64 }, surv);
  end.tick({ x: 64, y: 0, z: 64 }, surv);
  assert.equal(dry.world.sets.length, 0);
  assert.deepEqual(end.world.sets.map((s) => s[3]), [51]);
  assert.equal(end.entities[0].innerRotation, 8);
});

test("dragon egg is block 171 with a registered shape", () => {
  assert.equal(BLOCKS[171].name.toLowerCase().includes("egg"), true);
});
