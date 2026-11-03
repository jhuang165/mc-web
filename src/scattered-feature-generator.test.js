import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./java-random.js";
import { randomLong, StructureBoundingBox, DISPENSER, CHEST } from "./structure-framework.js";
import { RecordingWorld } from "./structure-framework-fixture.js";
import { populationSeed } from "./ore-generator.js";
import { WorldChunkManager } from "./biome-layers.js";
import {
  SWAMP_SLOT, JUNGLE_SLOTS, DIRECTION_OFFSET_X, DIRECTION_OFFSET_Z, LEVER_INVERT,
  DESERT_PYRAMID_LOOT, JUNGLE_PYRAMID_LOOT, JUNGLE_DISPENSER_LOOT, SWAMP_HUT_SPAWN_LIST,
  DesertPyramid, JunglePyramid, SwampHut, StructureScatteredFeatureStart, MapGenScatteredFeature,
} from "./scattered-feature-generator.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/scattered-feature-reference.json", import.meta.url)));
const records = (kind) => ref.records.filter((r) => r.kind === kind);
const mats = new Map(ref.config.materials.map(([id, air, blocks, leaves]) => [id, { air, blocks, leaves }]));
const SLOT = { TeDP: 2, TeJP: 21, TeSH: 6 };
const mod = (a, b) => ((a % b) + b) % b;
const hash2 = (x, z) => Math.imul(x, 73856093) ^ Math.imul(z, 83492791);

// JS mirror of ScatteredFeatureProbe.fixture (stone, water, air and a hilly surface with sand, trees, tall grass).
function fixtureBlock(f, x, y, z) {
  if (f === "air" || y < 0 || y > 255) return 0;
  if (f === "stone") return y > 63 ? 0 : 1;
  if (f === "water") return y <= 50 ? 1 : y <= 62 ? 9 : 0;
  const h = 54 + (hash2(x >> 2, z >> 2) & 31);
  if (y < h - 3) return 1;
  if (y < h) return 3;
  if (y === h) return h < 62 ? 12 : 2;
  if (h < 62) return y <= 62 ? 9 : 0;
  const col = mod(hash2(x * 3 + 1, z * 5 + 2), 11);
  if (col === 0 && y <= h + 3) return y <= h + 2 ? 17 : 18;
  if (col === 1 && y === h + 1) return 31;
  return 0;
}
class World extends RecordingWorld {
  constructor(fixture, flat = false) { super(fixture); this.flat = flat; }
  getBlock(x, y, z) {
    this.call(0, x, y, z);
    if (y < 0 || y >= 256 || x < -30000000 || x >= 30000000 || z < -30000000 || z >= 30000000) return 0;
    const e = this.edits.get(`${x},${y},${z}`);
    return e !== undefined ? e : fixtureBlock(this.fixture, x, y, z);
  }
  raw(x, y, z) { const e = this.edits.get(`${x},${y},${z}`); return y < 0 || y >= 256 ? 0 : e !== undefined ? e : fixtureBlock(this.fixture, x, y, z); }
  getTopSolidOrLiquidBlock(x, z) {
    this.call(6, x, z);
    for (let k = 255; k > 0; k--) { const m = mats.get(this.raw(x, k, z)); if (m.blocks && !m.leaves) return k + 1; }
    return -1;
  }
  getAverageGroundLevel() { return this.flat ? 4 : 64; }
  setBlock(x, y, z, id, meta, flags) {
    const ok = super.setBlock(x, y, z, id, meta, flags), k = `${x},${y},${z}`;
    if (!ok) return ok;
    this.tiles.delete(k);
    const mk = (kind, size) => {
      const t = { kind, size, slots: Array(size).fill(null), writes: [] };
      t.setSlot = (i, s) => { t.slots[i] = s; t.writes.push([i, s]); };
      return t;
    };
    if (id === CHEST) this.tiles.set(k, mk("chest", 27));
    if (id === DISPENSER) this.tiles.set(k, mk("dispenser", 9));
    return ok;
  }
  spawnEntity(e) {
    this.call(5, Math.floor(e.x), Math.floor(e.y), Math.floor(e.z));
    this.entities.push([e.type, e.x, e.y, e.z, e.yaw, e.pitch]);
    return true;
  }
  tileList() { return [...this.tiles].map(([k, t]) => [k, t.kind, t.slots, t.writes.map(([i, s]) => [i, s])]); }
}
const describe = (start) => start.components.map((c) => c.describe());
const stubStart = (slot, random, cx, cz) => new StructureScatteredFeatureStart({ getBiomeId: () => slot }, random, cx, cz);
function checkWrites(w, c, label) {
  assert.equal(w.writeCount, c.writeCount, label);
  if (c.writes) assert.deepEqual(w.fullWrites, c.writes, label);
  assert.equal(w.writes.digest("hex"), c.writesSha1, label);
  assert.equal(w.callCount, c.callCount, label);
  assert.equal(w.calls.digest("hex"), c.callsSha1, label);
  assert.deepEqual(w.entities, c.entities, label);
}

test("GEN-05e scattered features: constants match the unchanged classes", () => {
  assert.equal(SWAMP_SLOT, ref.config.slots.swamp);
  assert.deepEqual(JUNGLE_SLOTS, [ref.config.slots.jungle, ref.config.slots.jungleHills]);
  assert.deepEqual(DIRECTION_OFFSET_X, ref.config.directionX);
  assert.deepEqual(DIRECTION_OFFSET_Z, ref.config.directionZ);
  assert.deepEqual(LEVER_INVERT, ref.config.leverInvert);
  assert.deepEqual(DESERT_PYRAMID_LOOT, ref.config.loot.desert);
  assert.deepEqual(JUNGLE_PYRAMID_LOOT, ref.config.loot.jungle);
  assert.deepEqual(JUNGLE_DISPENSER_LOOT, ref.config.loot.dispenser);
  assert.equal(SWAMP_HUT_SPAWN_LIST.length, ref.config.spawnList.length);
  assert.deepEqual(SWAMP_HUT_SPAWN_LIST.map((e) => [e.weight, e.minGroup, e.maxGroup]), ref.config.spawnList.map((e) => e.slice(1)));
  assert.equal(ref.config.averageGroundLevel.default, 64);
  assert.equal(ref.config.averageGroundLevel.flat, 4);
});

test("GEN-05e scattered features: start piece type, box and orientation for every biome slot, seed and chunk", () => {
  const rows = records("startChoice")[0].rows;
  assert.ok(rows.length > 500);
  const seen = new Set();
  for (const [slot, cx, cz, seedText, pieces, box, next, startSeed] of rows) {
    const label = `slot ${slot} ${cx},${cz} ${seedText}`;
    const random = new JavaRandom(BigInt(startSeed)), start = stubStart(slot, random, cx, cz);
    assert.deepEqual(describe(start), pieces, label);
    assert.deepEqual(start.boundingBox.toArray(), box, label);
    assert.equal(randomLong(random).toString(), next, label);
    seen.add(`${pieces[0][0]}:${pieces[0][1]}`);
  }
  assert.deepEqual([...seen].sort(), ["TeDP:0", "TeDP:1", "TeDP:2", "TeDP:3", "TeJP:0", "TeJP:1", "TeJP:2", "TeJP:3", "TeSH:0", "TeSH:1", "TeSH:2", "TeSH:3"]);
  // Biome slots: jungle, jungle hills -> jungle pyramid, swampland -> swamp hut, everything else -> desert pyramid.
  const kinds = new Map();
  for (const r of rows) kinds.set(r[0], (kinds.get(r[0]) || new Set()).add(r[4][0][0]));
  for (const [slot, set] of kinds) assert.deepEqual([...set], [slot === 6 ? "TeSH" : slot === 21 || slot === 22 ? "TeJP" : "TeDP"], `slot ${slot}`);
});

test("GEN-05e scattered features: MapGenBase placement over the real biome manager, start map order and swamp-hut queries", () => {
  const rs = records("starts");
  assert.equal(rs.length, 4);
  let starts = 0, queries = 0, hits = 0;
  for (const r of rs) {
    const gen = new MapGenScatteredFeature(BigInt(r.worldSeed), new WorldChunkManager(BigInt(r.worldSeed), "default")), after = [];
    for (const [x, z] of r.centers) { gen.generate(x, z); after.push(randomLong(gen.random).toString()); }
    assert.deepEqual(after, r.randomAfter, r.worldSeed);
    assert.deepEqual(gen.structureMap.keys(), r.keys, r.worldSeed);
    const list = gen.structureMap.values().map((s) => ({ chunk: [s.chunkX, s.chunkZ], bb: s.boundingBox.toArray(), pieces: describe(s) }));
    assert.deepEqual(list, r.starts, r.worldSeed);
    for (const [x, y, z, expected] of r.swampQueries) { assert.equal(gen.isSwampHut(x, y, z), expected, `${r.worldSeed} ${x},${y},${z}`); queries++; if (expected) hits++; }
    starts += r.starts.length;
  }
  assert.ok(starts >= 40 && queries > 500 && hits > 0);
  const types = new Set(rs.flatMap((r) => r.starts.flatMap((s) => s.pieces.map((p) => p[0]))));
  assert.ok(types.has("TeDP") && types.has("TeSH"));
});

test("GEN-05e scattered features: chunk-bounded population writes, loot, once-only flags, witch and RNG replay", () => {
  const rs = records("populate");
  assert.ok(rs.length >= 28);
  let writes = 0, full = 0, calls = 0;
  const kinds = new Set(), orientations = new Set(), witches = [], negative = new Set();
  for (const r of rs) {
    const label = `${r.type} mode ${r.mode} ${r.fixture} ${r.worldSeed} ${r.chunk}`, [cx, cz] = r.chunk;
    const w = new World(r.fixture, r.flat), gen = new MapGenScatteredFeature(BigInt(r.worldSeed), null);
    const start = stubStart(SLOT[r.type], new JavaRandom(BigInt(r.startSeed)), cx, cz);
    assert.deepEqual(describe(start), r.initial, label);
    assert.deepEqual(start.boundingBox.toArray(), r.startBox, label);
    gen.structureMap.set(cx, cz, start);
    for (const c of r.chunks) {
      const [x, z] = c.chunk, cl = `${label} chunk ${x},${z}`;
      w.reset(); w.fullWrites = c.writes ? [] : null;
      const random = new JavaRandom(populationSeed(BigInt(r.worldSeed), x, z));
      assert.equal(gen.generateStructuresInChunk(w, random, x, z), c.result, cl);
      checkWrites(w, c, cl);
      assert.deepEqual(describe(start), c.pieces, cl);
      assert.equal(randomLong(random).toString(), c.nextLong, cl);
      writes += c.writeCount; calls += c.callCount; if (c.writes) full++;
      witches.push(...c.entities);
    }
    assert.deepEqual(w.tileList(), r.tiles, label);
    kinds.add(r.type); orientations.add(`${r.type}${r.mode}`);
    if (r.chunk.some((v) => v < 0) || r.startBox.slice(0, 3).some((v) => v < 0)) negative.add(r.type);
  }
  assert.deepEqual([...kinds].sort(), ["TeDP", "TeJP", "TeSH"]);
  assert.equal(orientations.size, 12);
  assert.ok(full >= 30 && writes > 30000 && calls > 100000);
  assert.ok(negative.size >= 2);
  assert.ok(witches.length >= 1 && witches.every((e) => e[0] === "Witch"));
  // Chests, dispensers and book rows are filled; jungle trap dispensers hold arrows.
  const tiles = rs.flatMap((r) => r.tiles);
  assert.ok(tiles.some((t) => t[1] === "dispenser" && t[2].some((s) => s && s[0] === 262)));
  assert.ok(tiles.some((t) => t[1] === "chest" && t[2].some((s) => s && s[0] === 403)));
});

test("GEN-05e scattered features: direct pieces over partial, thin and Y-limited boxes keep one RNG stream and once-only flags", () => {
  const rs = records("pieces");
  assert.ok(rs.length >= 36);
  let calls = 0, failures = 0, successes = 0;
  for (const r of rs) {
    const label = `${r.type} mode ${r.mode} ${r.fixture} ${r.worldSeed} ${r.chunk}`, [cx, cz] = r.chunk;
    const w = new World(r.fixture), start = stubStart(SLOT[r.type], new JavaRandom(BigInt(r.startSeed)), cx, cz);
    assert.deepEqual(describe(start), r.initial, label);
    const piece = start.components[0], random = new JavaRandom(BigInt(r.pieceSeed));
    assert.ok(piece instanceof { TeDP: DesertPyramid, TeJP: JunglePyramid, TeSH: SwampHut }[r.type], label);
    r.calls.forEach((c, i) => {
      const cl = `${label} call ${i}`;
      w.reset();
      assert.equal(piece.addComponentParts(w, random, new StructureBoundingBox(...c.bb)), c.result, cl);
      checkWrites(w, c, cl);
      assert.deepEqual(piece.describe(), c.piece, cl);
      calls++; c.result ? successes++ : failures++;
    });
    assert.deepEqual(w.tileList(), r.tiles, label);
    assert.equal(randomLong(random).toString(), r.nextLong, label);
  }
  assert.ok(calls >= 380 && failures > 0 && successes > 0);
});
