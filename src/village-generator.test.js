import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { JavaRandom } from "./java-random.js";
import { randomLong } from "./structure-framework.js";
import { RecordingWorld } from "./structure-framework-fixture.js";
import { WorldChunkManager } from "./biome-layers.js";
import { populationSeed } from "./ore-generator.js";
import { VILLAGE_BIOMES, villageCandidate } from "./structure-placement.js";
import {
  B, BLACKSMITH_LOOT, NORMAL_CUBES, MapGenVillage, VILLAGE_PIECE_CLASSES, desertBlock, desertMeta,
  VillageHouse1, VillageChurch, VillageBlacksmith, VillageHall, VillageField1, VillageField2, VillageTorch,
  VillageHouse4Garden, VillageWoodHut, VillageLibrary, VillageWell, VillagePath, placeDoor,
} from "./village-generator.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/village-reference.json", import.meta.url)));
const config = ref.config, records = ref.records;
const sha1 = (s) => createHash("sha1").update(s).digest("hex");
const piecesText = (start) => JSON.stringify(start.components.map((c) => c.describe()));
const manager = (r) => new WorldChunkManager(BigInt(r.worldSeed), r.type);

// VillageProbe.W: the same analytic fixtures (flat, hills, dunes), the ordered service-call hash with call 6 for
// World.getTopSolidOrLiquidBlock and call 7 for the door's neighbour notification, and villager spawn records.
const hash3 = (x, y, z) => Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791);
const ground = (f, x, z) => (f === "flat" ? 63 : 62 + ((hash3(x >> 3, 7, z >> 3) >>> 5) & 7) + ((hash3(x >> 1, 11, z >> 1) >>> 9) & 1));
function fixtureBlock(f, x, y, z) {
  if (y < 0 || y >= 256) return 0;
  if (y === 0) return 7;
  const h = ground(f, x, z);
  if (y <= h - 4) return 1;
  if (f === "dunes") {
    if (y < h) return y >= h - 3 ? 24 : 12;
    if (y === h) return 12;
  } else {
    if (y < h) return 3;
    if (y === h) return 2;
  }
  if (f === "hills") {
    if (y <= 63) return 9;
    const k = hash3(x, 3, z) & 31;
    if (k === 0 && (y === h + 3 || y === h + 4)) return 18;
    if (k === 1 && y === h + 1) return 31;
  }
  return 0;
}
const MOVES = new Set(config.materials.filter((m) => m[3]).map((m) => m[0])), LEAVES = new Set(config.materials.filter((m) => m[5]).map((m) => m[0]));
class VillageWorld extends RecordingWorld {
  constructor(fixture, flatProvider) { super(fixture); this.flatProvider = flatProvider; }
  raw(x, y, z) {
    if (y < 0 || y >= 256 || x < -30000000 || x >= 30000000 || z < -30000000 || z >= 30000000) return 0;
    const e = this.edits.get(`${x},${y},${z}`);
    return e !== undefined ? e : fixtureBlock(this.fixture, x, y, z);
  }
  getBlock(x, y, z) { this.call(0, x, y, z); return this.raw(x, y, z); }
  getTopSolidOrLiquid(x, z) {
    this.call(6, x, z);
    for (let y = 255; y > 0; y--) { const b = this.raw(x, y, z); if (MOVES.has(b) && !LEAVES.has(b)) return y + 1; }
    return -1;
  }
  getAverageGroundLevel() { return config.providerLevels[this.flatProvider ? 1 : 0]; }
  notifyBlocksOfNeighborChange(x, y, z, id) { this.call(7, x, y, z, id); }
  spawnEntity(e) {
    this.call(5, Math.floor(e.x), Math.floor(e.y), Math.floor(e.z));
    this.entities.push([e.type, e.x, e.y, e.z, e.profession]);
    return true;
  }
}

function startList(gen, full) {
  return gen.structureMap.values().map((s, i) => {
    const o = { chunk: [s.chunkX, s.chunkZ], bb: s.boundingBox.toArray(), valid: s.isSizeableStructure(), pieceCount: s.components.length, piecesSha1: sha1(piecesText(s)) };
    if (i < full) o.pieces = s.components.map((c) => c.describe());
    return o;
  });
}
const coverage = (b) => {
  const out = [];
  for (let cx = Math.floor((b[0] - 23 + 15) / 16); cx <= Math.floor((b[3] - 8) / 16); cx++)
    for (let cz = Math.floor((b[2] - 23 + 15) / 16); cz <= Math.floor((b[5] - 8) / 16); cz++) out.push([cx, cz]);
  return out;
};
const village = () => records.filter((r) => r.kind === "village");
const generator = (r) => new MapGenVillage(BigInt(r.worldSeed), manager(r), { size: String(r.size), distance: String(r.distance) });

test("GEN-05c villages: block ids, solid-cube table, desert substitution, loot, professions and biomes match the unchanged classes", () => {
  const names = { a: "AIR", d: "DIRT", e: "COBBLESTONE", f: "PLANKS", g: "SAPLING", i: "FLOWING_WATER", j: "WATER", k: "FLOWING_LAVA", n: "GRAVEL", r: "LOG", s: "LOG2", A: "SANDSTONE", L: "WOOL", T: "DOUBLE_STONE_SLAB", U: "STONE_SLAB", X: "BOOKSHELF", Z: "OBSIDIAN", aJ: "FENCE", aY: "IRON_BARS", aZ: "GLASS_PANE", aa: "TORCH", ad: "OAK_STAIRS", ae: "CHEST", ai: "CRAFTING_TABLE", aj: "WHEAT", ak: "FARMLAND", al: "FURNACE", ao: "WOODEN_DOOR", ap: "LADDER", ar: "STONE_STAIRS", aw: "WOODEN_PRESSURE_PLATE", bM: "CARROTS", bN: "POTATOES", bz: "SANDSTONE_STAIRS" };
  let checked = 0;
  for (const [obf, id] of Object.entries(config.blocks)) if (names[obf]) { assert.equal(B[names[obf]], id, obf); checked++; }
  assert.equal(checked, Object.keys(names).length);
  assert.equal(config.materials.length, 256);
  assert.deepEqual([...NORMAL_CUBES].sort((a, b) => a - b), config.materials.filter((m) => m[4]).map((m) => m[0]));
  // Every (id, meta) pair of the substitution table, nothing else.
  const rows = [];
  for (let id = 0; id < 256; id++) for (let meta = 0; meta < 16; meta++) {
    const nid = desertBlock(id), nmeta = desertMeta(id, meta);
    if (nid !== id || nmeta !== meta) rows.push([id, meta, nid, nmeta]);
  }
  assert.deepEqual(rows, config.desert);
  assert.deepEqual(BLACKSMITH_LOOT, config.loot);
  assert.deepEqual(VILLAGE_BIOMES, config.villageBiomes);
  assert.equal(config.size, 0);
  assert.deepEqual(config.providerLevels, [64, 4]);
  const byClass = { avq: VillageHouse1, avy: VillageChurch, avz: VillageBlacksmith, avv: VillageHall, avr: VillageField1, avs: VillageField2, avt: VillageTorch, avw: VillageHouse4Garden, avx: VillageWoodHut, awc: VillageLibrary, awf: VillageWell, awb: VillagePath };
  assert.equal(config.professions.length, Object.keys(byClass).length);
  for (const [cls, p0, p1, p2] of config.professions) {
    const piece = Object.create(byClass[cls].prototype);
    assert.deepEqual([piece.profession(0), piece.profession(1), piece.profession(2)], [p0, p1, p2], cls);
  }
  assert.equal(VILLAGE_PIECE_CLASSES.length, 13);
  assert.deepEqual(new Set(VILLAGE_PIECE_CLASSES.map((c) => c.saveId)), new Set(["ViStart", "ViW", "ViSR", "ViL", "ViBH", "ViST", "ViSH", "ViSmH", "ViPH", "ViDF", "ViF", "ViS", "ViTRH"]));
});

test("GEN-05c villages: options parse like MapGenVillage and placement reuses villageCandidate", () => {
  const m = { areBiomesViable: () => true };
  assert.equal(new MapGenVillage(1n, m).distance, 32);
  assert.equal(new MapGenVillage(1n, m, { distance: "3" }).distance, 9);
  assert.equal(new MapGenVillage(1n, m, { distance: "abc", size: "-4" }).distance, 32);
  assert.equal(new MapGenVillage(1n, m, { size: "-4" }).size, 0);
  assert.equal(new MapGenVillage(1n, m, { size: "3x" }).size, 0);
  assert.equal(new MapGenVillage(1n, m, { size: "2", distance: "20" }).size, 2);
  const r = village()[0], mgr = manager(r), gen = new MapGenVillage(BigInt(r.worldSeed), mgr, { distance: String(r.distance) });
  for (const [x, z] of [[0, 0], [-1, -1], r.centre, [5, -9]])
    assert.equal(gen.canSpawnStructureAtCoords(x, z), villageCandidate(BigInt(r.worldSeed), mgr, x, z, { distance: r.distance }));
});

test("GEN-05c villages: driver map order, start boxes, validity and every piece replay the unchanged Start/StructureVillagePieces", () => {
  let starts = 0, pieces = 0, valid = 0;
  const types = new Set(), modes = new Set();
  for (const r of village()) {
    const gen = generator(r), label = `${r.label} ${r.worldSeed} ${r.centre}`;
    gen.generate(r.centre[0], r.centre[1]);
    assert.equal(randomLong(gen.random).toString(), r.randomAfter, label);
    assert.deepEqual(gen.structureMap.keys(), r.keys, label);
    const full = r.starts.filter((s) => s.pieces).length;
    assert.deepEqual(startList(gen, full), r.starts, label);
    starts += r.starts.length;
    for (const s of r.starts) {
      pieces += s.pieceCount;
      if (s.valid) valid++;
      for (const p of s.pieces || []) { types.add(p[0]); modes.add(p[1]); }
    }
  }
  assert.equal(village().length, 25);
  assert.equal(starts, 31);
  assert.equal(pieces, 562);
  assert.equal(valid, 24);
  assert.ok(valid > 0 && valid < starts);
  assert.deepEqual([...types].sort(), ["ViBH", "ViDF", "ViF", "ViL", "ViPH", "ViS", "ViSH", "ViSR", "ViST", "ViSmH", "ViStart", "ViTRH"]);
  assert.deepEqual([...modes].sort(), [0, 1, 2, 3]);
});

function populate(r) {
  const seed = BigInt(r.worldSeed), gen = generator(r);
  gen.generate(r.centre[0], r.centre[1]);
  // The chunks covering a sizeable start, once each, in start-map order (the probe's own order).
  const wanted = [], seen = new Set();
  for (const s of gen.structureMap.values()) if (s.isSizeableStructure())
    for (const c of coverage(s.boundingBox.toArray())) if (!seen.has(c.join())) { seen.add(c.join()); wanted.push(c); }
  assert.deepEqual(wanted, r.chunks.map((c) => c.chunk), r.label);
  const w = new VillageWorld(r.fixture, r.flatProvider);
  let writes = 0, entities = 0, calls = 0;
  for (const c of r.chunks) {
    const [cx, cz] = c.chunk, label = `${r.label} ${r.worldSeed} chunk ${cx},${cz}`;
    w.reset(); w.fullWrites = c.writes ? [] : null;
    const random = new JavaRandom(populationSeed(seed, cx, cz));
    assert.equal(gen.generateStructuresInChunk(w, random, cx, cz), c.result, label);
    assert.equal(w.writeCount, c.writeCount, label);
    if (c.writes) assert.deepEqual(w.fullWrites, c.writes, label);
    assert.equal(w.writes.digest("hex"), c.writesSha1, label);
    assert.equal(w.callCount, c.callCount, label);
    assert.equal(w.calls.digest("hex"), c.callsSha1, label);
    assert.deepEqual(w.entities, c.entities, label);
    assert.equal(randomLong(random).toString(), c.nextLong, label);
    writes += w.writeCount; entities += w.entities.length; calls += w.callCount;
  }
  assert.deepEqual(w.tileList(), r.tiles, r.label);
  assert.deepEqual(startList(gen, 0), r.startsAfter, r.label);
  return { writes, entities, calls, chunks: r.chunks.length };
}

test("GEN-05c villages: population writes, ordered world calls, chests, villager spawn records and RNG replay exactly", () => {
  const total = { writes: 0, entities: 0, calls: 0, chunks: 0 };
  for (const r of village()) for (const [k, v] of Object.entries(populate(r))) total[k] += v;
  assert.deepEqual(total, { writes: 172786, entities: 315, calls: 326433, chunks: 662 });
  assert.deepEqual(ref.counts.population, total);
  const chunks = village().flatMap((r) => r.chunks);
  assert.ok(chunks.filter((c) => c.writes).length >= 4);
  const professions = new Set(chunks.flatMap((c) => c.entities.map((e) => e[4])));
  assert.deepEqual([...professions].sort(), [0, 1, 2, 3, 4]);
  assert.ok(village().some((r) => r.tiles.length > 0 && r.tiles.every((t) => t[1] === "chest" && t[2].some((s) => s))));
  assert.ok(village().some((r) => r.type === "default" && r.fixture === "dunes"));
  assert.ok(village().some((r) => r.flatProvider));
  // A desert Start (awa.b) turns its pieces' cobblestone, planks and stairs into sandstone.
  const desertFull = village().filter((r) => r.starts.some((s) => s.pieces && s.pieces[0][12] === true && s.valid));
  assert.ok(desertFull.length > 0 && desertFull.some((r) => r.chunks.some((c) => c.writes && c.writes.some((w) => w[3] === 128))));
  assert.ok(village().some((r) => r.centre[0] < 0 && r.centre[1] < 0));
  assert.ok(village().some((r) => r.starts.some((s) => !s.valid)));
});

test("GEN-05c villages: door placement replays ItemDoor.func_150924_a for every facing and neighbour state", () => {
  let hinges = 0;
  assert.equal(ref.door.cases.length, 324);
  for (const [facing, l0, l1, r0, r1, writes, callCount, callsSha1] of ref.door.cases) {
    const w = new VillageWorld("flat", false);
    const dx = facing === 1 ? -1 : facing === 3 ? 1 : 0, dz = facing === 0 ? 1 : facing === 2 ? -1 : 0;
    w.edits.set(`${5 - dx},70,${5 - dz}`, l0); w.edits.set(`${5 - dx},71,${5 - dz}`, l1);
    w.edits.set(`${5 + dx},70,${5 + dz}`, r0); w.edits.set(`${5 + dx},71,${5 + dz}`, r1);
    w.fullWrites = [];
    placeDoor(w, 5, 70, 5, facing);
    const label = `${facing} ${l0} ${l1} ${r0} ${r1}`;
    assert.deepEqual(w.fullWrites, writes, label);
    assert.equal(w.callCount, callCount, label);
    assert.equal(w.calls.digest("hex"), callsSha1, label);
    if (writes[1][4] === 9) hinges++;
  }
  assert.ok(hinges > 50 && hinges < 270);
  // The neighbour notification follows both setters.
  const log = [], w = new VillageWorld("air", false);
  w.setBlock = function (...a) { log.push(["set", ...a]); return RecordingWorld.prototype.setBlock.apply(this, a); };
  w.notifyBlocksOfNeighborChange = (...a) => log.push(["notify", ...a]);
  placeDoor(w, 0, 70, 0, 2);
  assert.deepEqual(log, [["set", 0, 70, 0, 64, 2, 2], ["set", 0, 71, 0, 64, 8, 2], ["notify", 0, 70, 0, 64], ["notify", 0, 71, 0, 64]]);
});
