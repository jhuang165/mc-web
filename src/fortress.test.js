// Native replay of the 1.7.10 Nether fortress (fortress-reference.json, from tools/probes/FortressProbe.java over the
// unchanged MapGenNetherBridge / StructureNetherBridgePieces / ChunkProviderHell classes): weight tables, chest loot,
// spawn list, placement scans, native start driver piece lists, and real Nether populations around native fortresses.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { JavaRandom } from "./java-random.js";
import { randomLong } from "./structure-framework.js";
import {
  MapGenNetherBridge, FORTRESS_CHEST_LOOT, FORTRESS_SPAWN_LIST, fortressWeightTable, fortressMonsterSpawnList, FORTRESS_PIECE_CLASSES,
} from "./fortress.js";
import { NetherArea } from "./nether-generator.js";
import { recordedWorld } from "./gen-world-recording.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/fortress-reference.json", import.meta.url)));
const records = (kind) => ref.records.filter((r) => r.kind === kind);
const sha1 = (s) => createHash("sha1").update(s).digest("hex");
const areaHash = (c) => {
  const b = Buffer.alloc(65536 * 4);
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < 256; y++) b.writeInt32LE(c.getBlock(x, y, z) | c.getMeta(x, y, z) << 12, ((x * 16 + z) * 256 + y) * 4);
  return createHash("sha1").update(b).digest("hex");
};
function startList(gen, full) {
  return gen.structureMap.values().map((s, i) => {
    const text = JSON.stringify(s.components.map((c) => c.describe()));
    const o = { chunk: [s.chunkX, s.chunkZ], bb: s.boundingBox.toArray(), pieceCount: s.components.length, piecesSha1: sha1(text) };
    if (i < full) o.pieces = s.components.map((c) => c.describe());
    return o;
  });
}

test("reference is the pinned 1.7.10 client and covers the expected record counts", () => {
  assert.equal(ref.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.equal(records("config").length, 1);
  assert.equal(records("placement").length, 32);
  assert.equal(records("starts").length, 16);
  assert.equal(records("population").length, 8);
});

test("fortress config: weight tables, limits, loot, spawn list and block ids match the unchanged classes", () => {
  const c = records("config")[0];
  assert.deepEqual(fortressWeightTable(), c.weights);
  assert.deepEqual(FORTRESS_CHEST_LOOT, c.loot);
  assert.deepEqual(FORTRESS_SPAWN_LIST, c.spawnList);
  assert.equal(c.structureName, "Fortress");
  assert.equal(new MapGenNetherBridge(0n).structureName, "Fortress");
  assert.deepEqual(c.blocks, { bj: 112, bk: 113, bl: 114, bm: 115, aM: 88, k: 10, ac: 52, ae: 54 });
  assert.equal(FORTRESS_PIECE_CLASSES.length, 15);
});

for (const r of records("placement")) test(`fortress placement seed ${r.seed} over ${r.size}x${r.size} chunks from ${r.origin}`, () => {
  const m = new MapGenNetherBridge(BigInt(r.seed)), hits = [];
  for (let x = r.origin[0]; x < r.origin[0] + r.size; x++) for (let z = r.origin[1]; z < r.origin[1] + r.size; z++) if (m.canSpawnStructureAtCoords(x, z)) hits.push([x, z]);
  assert.deepEqual(hits, r.hits);
});

for (const r of records("starts")) test(`fortress starts seed ${r.worldSeed}: native driver piece lists`, () => {
  const gen = new MapGenNetherBridge(BigInt(r.worldSeed)), after = [];
  for (const [x, z] of r.centers) { gen.generate(x, z); after.push(randomLong(gen.random).toString()); }
  assert.deepEqual(after, r.randomAfter, "random after each driver call");
  assert.deepEqual(startList(gen, r.starts.reduce((n, s) => n + ("pieces" in s ? 1 : 0), 0)), r.starts);
});

const tilesOf = (area, r) => {
  const w = area.world, out = [];
  for (let x = r.origin[0] * 16; x < (r.origin[0] + r.size) * 16; x++) for (let z = r.origin[1] * 16; z < (r.origin[1] + r.size) * 16; z++) for (let y = 0; y < 256; y++) {
    const id = w.getBlock(x, y, z);
    if (id !== 54 && id !== 52) continue;
    const t = w.getTileEntity(x, y, z);
    out.push(t.kind === "chest" ? [x, y, z, "chest", t.slots] : [x, y, z, "spawner", t.name]);
  }
  return out;
};

for (const rec of records("population")) test(`Nether fortress population ${rec.label}: real aqv + atd`, () => {
  const area = new NetherArea({ seed: rec.seed, chunkX: rec.origin[0], chunkZ: rec.origin[1], size: rec.size, populated: rec.populated }), w = area.world;
  const inputs = [], steps = [];
  let recording, startsBefore = null;
  area.run({
    afterGenerate(x, z, c) { inputs.push([x, z, areaHash(c)]); },
    beforePopulate() { if (!startsBefore) startsBefore = startList(area.provider.bridge, 0); recording = recordedWorld(w); },
    afterPopulate(x, z) { steps.push({ chunk: [x, z], calls: recording.callCount, callSha1: recording.calls.digest("hex"), writes: recording.writeCount, writeSha1: recording.writes.digest("hex") }); },
  });
  assert.deepEqual(inputs, rec.inputs, "native inputs before population");
  assert.deepEqual(startsBefore, rec.startsBefore, "starts found by provideChunk");
  assert.equal(steps.length, rec.steps.length);
  steps.forEach((s, i) => assert.deepEqual(s, rec.steps[i], `step ${i}`));
  w.onCall = null; w.onWrite = null;
  const hashes = [];
  for (let x = rec.origin[0]; x < rec.origin[0] + rec.size; x++) for (let z = rec.origin[1]; z < rec.origin[1] + rec.size; z++) hashes.push(areaHash(w.chunk(x, z)));
  assert.deepEqual(hashes, rec.areaSha1, "area after population");
  assert.deepEqual(startList(area.provider.bridge, 0), rec.startsAfter, "pieces after generation (unkept pieces removed)");
  assert.deepEqual(tilesOf(area, rec), rec.tiles, "chests and spawners");
  assert.deepEqual(w.pending, rec.pending, "pending ticks");
  assert.equal(randomLong(area.provider.hellRNG).toString(), rec.hellNextLong, "hellRNG");
  assert.equal(randomLong(w.rand).toString(), rec.worldNextLong, "world rand");
  // aqv.a(monster, x, y, z): the fortress list inside pieces and on nether brick under a start's footprint.
  let fortress = 0;
  for (const [x, y, z, expected] of rec.spawnProbes) {
    const list = fortressMonsterSpawnList(area.provider.bridge, (bx, by, bz) => w.getBlock(bx, by, bz), x, y, z);
    assert.equal(list !== null ? 1 : 0, expected, `spawn list at ${x},${y},${z}`);
    if (list) { assert.deepEqual(list, FORTRESS_SPAWN_LIST); fortress++; }
  }
  assert.ok(fortress > 0 && fortress < rec.spawnProbes.length);
});

test("the references hold blaze spawners, loot chests and every piece type", () => {
  const types = new Set(), tiles = records("population").flatMap((r) => r.tiles);
  for (const s of records("starts")) for (const st of s.starts) for (const p of st.pieces ?? []) types.add(p[0]);
  assert.ok(tiles.some((t) => t[3] === "spawner" && t[4] === "Blaze"));
  assert.ok(tiles.some((t) => t[3] === "chest" && t[4].some((s) => s)));
  assert.ok(types.size >= 10, [...types].join());
});

test("placement uses the world seed through the region Random (no other state)", () => {
  const a = new MapGenNetherBridge(5n), b = new MapGenNetherBridge(5n);
  b.random = new JavaRandom(123n);
  for (let x = 0; x < 40; x += 3) assert.equal(a.canSpawnStructureAtCoords(x, x * 2), b.canSpawnStructureAtCoords(x, x * 2));
});
