import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { JavaRandom } from "./java-random.js";
import { randomLong } from "./mapgen.js";
import {
  DECORATOR_FIELDS, DECORATOR_COUNTS, decoratorCounts, WorldGenClay, WorldGenSand, WorldGenFlowers, WorldGenTallGrass,
  WorldGenDeadBush, WorldGenWaterlily, WorldGenReed, WorldGenPumpkin, WorldGenCactus,
  GRASS, DIRT, SAND, GRAVEL, WATER, FARMLAND, CACTUS, CLAY, REEDS, PUMPKIN, MYCELIUM, LILY_PAD, STAINED_CLAY, HARDENED_CLAY,
  YELLOW_FLOWER, RED_FLOWER, BROWN_MUSHROOM, RED_MUSHROOM, TALL_GRASS, DEAD_BUSH,
} from "./decoration-features.js";
const ref = JSON.parse(readFileSync(new URL("../public/research/decoration-features-reference.json", import.meta.url)));
const props = new Map(ref.config.properties.map(([id, air, water, leaves, solid, replaceable, opaque, topMask]) => [id, { air, water, leaves, solid, replaceable, opaque, topMask }]));
const mod = (a, b) => ((a % b) + b) % b;
const int32 = (hash, values) => { const b = Buffer.alloc(values.length * 4); values.forEach((v, i) => b.writeInt32LE(v, i * 4)); hash.update(b); };
const out = (x, y, z) => y < 0 || y >= 256 || x < -30000000 || z < -30000000 || x >= 30000000 || z >= 30000000;
// The probe's synthetic fixture (DecorationFeatureProbe.cell).
function mix(x, z) {
  let h = (Math.imul(x, 0x2F0B3A49) + Math.imul(z, 0x6C8E9CF5)) | 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; return h;
}
const top = (x, z) => x >= 3000 && x < 4000 ? 63 : x >= 2000 ? 254 : 62 + mod(mix(Math.floor(x / 3), Math.floor(z / 3)), 3);
const SURFACE = [2, 2, 2, 3, 12, 3, 110, 172, 159, 60, 1, 13, 9, 9, 8, 79];
function cell(x, y, z) {
  if (x >= 1000 && x < 2000) return [0, 0];
  if (x >= 3000 && x < 4000) {
    const d = mix(x, z);
    if (y < 59) return [1, 0]; if (y < 63) return [24, 0];
    if (y === 63) return [(d & 63) === 0 ? 9 : 12, 0];
    return [y === 64 && ((d >> 8) & 15) === 0 && (d & 63) !== 0 ? 81 : 0, 0];
  }
  const h = mix(x, z), t = top(x, z), k = mod(h >> 4, 16), v = mod(h >> 8, 16);
  if (y < t - 3) return [1, 0];
  if (k >= 12 && k <= 14) {
    if (y >= t - 1 && y <= t) return [k === 14 ? 8 : 9, k === 13 ? 1 + (v & 3) : 0];
    if (y === t - 2) return [[3, 82, 12, 2][v & 3], 0];
    return y < t ? [3, 0] : [0, 0];
  }
  if (y < t) return [3, k === 5 ? 2 : 0];
  if (y === t) return [SURFACE[k], k === 8 ? v : k === 5 ? 2 : 0];
  if (y === t + 1) {
    if (k === 2) return [31, 1];
    if (k === 4 && (v & 1) === 1) return [81, 0];
    if (k === 3 && (v & 1) === 1) return [83, 0];
    if (k === 10) return [78, v & 7];
    if (k === 11 && (v & 1) === 1) return [20, 0];
    if (k === 0 && (v & 3) === 0) return [37, 0];
  }
  if ((y === t + 3 || y === t + 4) && k === 1) return [18, v & 3];
  if (y === t + 3 && k === 6) return [161, 0];
  return [0, 0];
}
class FixtureWorld {
  constructor(hasNoSky) { this.hasNoSky = hasNoSky; this.edits = new Map(); this.calls = createHash("sha1"); this.callCount = 0; this.writes = []; }
  call(...a) { this.callCount++; int32(this.calls, a); }
  at(x, y, z) { return this.edits.get(`${x},${y},${z}`) ?? cell(x, y, z); }
  getBlock(x, y, z) { this.call(0, x, y, z); return out(x, y, z) ? 0 : this.at(x, y, z)[0]; }
  getBlockMetadata(x, y, z) { this.call(2, x, y, z); return out(x, y, z) ? 0 : this.at(x, y, z)[1]; }
  getLight(x, y, z) { this.call(3, x, y, z); return mod(x * 5 + y * 11 + z * 3, 16); }
  setBlock(x, y, z, id, meta, flags) {
    this.call(1, x, y, z, id, meta, flags);
    if (out(x, y, z)) return false;
    this.edits.set(`${x},${y},${z}`, [id, meta]); this.writes.push([x, y, z, id, meta, flags]); return true;
  }
  isSolid(id) { return props.get(id).solid; }
  isReplaceable(id) { return props.get(id).replaceable; }
  isOpaqueCube(id) { return props.get(id).opaque; }
  solidTop(id, meta) { return (props.get(id).topMask >> meta & 1) === 1; }
}
const generators = {
  clay: () => new WorldGenClay(4), sand: () => new WorldGenSand(SAND, 7), gravel: () => new WorldGenSand(GRAVEL, 6),
  flower: (v) => new WorldGenFlowers(v[0], v[1]), brownMushroom: () => new WorldGenFlowers(BROWN_MUSHROOM), redMushroom: () => new WorldGenFlowers(RED_MUSHROOM),
  grass: () => new WorldGenTallGrass(TALL_GRASS, 1), fern: () => new WorldGenTallGrass(TALL_GRASS, 2), deadBush: () => new WorldGenDeadBush(DEAD_BUSH),
  waterlily: () => new WorldGenWaterlily(), reed: () => new WorldGenReed(), pumpkin: () => new WorldGenPumpkin(), cactus: () => new WorldGenCactus(),
};

test("GEN-04 decoration features: native block identities and material classes", () => {
  assert.deepEqual(ref.config.blocks, [GRASS, DIRT, SAND, GRAVEL, WATER, FARMLAND, CACTUS, CLAY, REEDS, PUMPKIN, MYCELIUM, LILY_PAD,
    STAINED_CLAY, HARDENED_CLAY, YELLOW_FLOWER, RED_FLOWER, BROWN_MUSHROOM, RED_MUSHROOM, TALL_GRASS, DEAD_BUSH]);
  const ids = (key) => [...props].filter(([, p]) => p[key]).map(([id]) => id);
  // decoration-features.js hard-codes these three material identities.
  assert.deepEqual([ids("air"), ids("water"), ids("leaves")], [[0], [8, 9], [18, 161]]);
});

test("GEN-04 decoration features: BiomeDecorator counts for every registered biome", () => {
  assert.deepEqual(ref.config.fields, DECORATOR_FIELDS);
  assert.deepEqual([...DECORATOR_COUNTS.keys()], ref.config.decorators.map(([slot]) => slot));
  for (const [slot, , , , counts] of ref.config.decorators) assert.deepEqual(DECORATOR_COUNTS.get(slot), counts, `slot ${slot}`);
  assert.deepEqual(decoratorCounts(2), { sand: 3, clay: 1, gravel: 1, trees: -999, bigMushrooms: 0, flowers: 2, grass: 1, deadBush: 2, waterlily: 0, mushrooms: 0, reeds: 50, cacti: 10, liquids: 1 });
});

test("GEN-04 decoration features: native writes, call order and Random stream", () => {
  const seen = new Set();
  for (const r of ref.records) {
    const label = JSON.stringify([r.feature, r.seed, r.pos]);
    const w = new FixtureWorld(r.noSky), random = new JavaRandom(BigInt(r.seed));
    const result = generators[r.feature](r.variant).generate(w, random, ...r.pos);
    assert.equal(result, r.result, label);
    assert.deepEqual(w.writes, r.writes, label);
    assert.equal(w.callCount, r.callCount, label);
    assert.equal(w.calls.digest("hex"), r.callSha1, label);
    assert.equal(randomLong(random).toString(), r.nextLong, label);
    seen.add(`${r.feature}:${r.writes.length > 0}`);
    if (!r.result) seen.add(`${r.feature}:rejected`);
    if (r.pos[1] >= 255 && r.writes.some(([, y]) => y === 255)) seen.add(`y255:${r.noSky}`);
    for (const [, y, , id, meta] of r.writes) if (id === PUMPKIN) seen.add(`pumpkin:${meta}`);
  }
  for (const f of Object.keys(generators)) assert.ok(seen.has(`${f}:true`) && seen.has(`${f}:false`), f);
  for (const k of ["clay:rejected", "sand:rejected", "gravel:rejected", "y255:false", "pumpkin:0", "pumpkin:3"]) assert.ok(seen.has(k), k);
  assert.ok(!seen.has("y255:true"), "hasNoSky worlds place no flower at y 255");
});
