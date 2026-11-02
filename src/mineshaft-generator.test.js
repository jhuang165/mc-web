import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { JavaRandom } from "./java-random.js";
import { randomLong } from "./structure-framework.js";
import { RecordingWorld } from "./structure-framework-fixture.js";
import { MapGenMineshaft, MINESHAFT_CHANCE } from "./mineshaft-generator.js";
import { populationSeed } from "./ore-generator.js";
import { MapGenCaves, MapGenRavine } from "./mapgen.js";
import { ChunkProviderGenerate, BiomeTerrainState } from "./terrain-generator.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/mineshaft-reference.json", import.meta.url)));
const records = (kind) => ref.records.filter((r) => r.kind === kind);
const sha1 = (s) => createHash("sha1").update(s).digest("hex");
const piecesText = (start) => JSON.stringify(start.components.map((c) => c.describe()));
function startList(gen, full) {
  return gen.structureMap.values().map((s, i) => {
    const o = { chunk: [s.chunkX, s.chunkZ], bb: s.boundingBox.toArray(), pieceCount: s.components.length, piecesSha1: sha1(piecesText(s)) };
    if (i < full) o.pieces = s.components.map((c) => c.describe());
    return o;
  });
}

test("GEN-05 mineshaft: native chance and canSpawnStructureAtCoords decisions after MapGenBase seeding", () => {
  assert.equal(MINESHAFT_CHANCE, ref.config.chance);
  const rs = records("candidates");
  assert.equal(rs.length, 4);
  let total = 0;
  for (const r of rs) {
    const gen = new MapGenMineshaft(BigInt(r.worldSeed)), rnd = gen.random, seed = BigInt.asIntN(64, BigInt(r.worldSeed));
    rnd.setSeed(seed);
    const a = randomLong(rnd), b = randomLong(rnd), accepted = [], digest = createHash("sha1");
    for (let x = r.origin[0]; x < r.origin[0] + r.size; x++) for (let z = r.origin[1]; z < r.origin[1] + r.size; z++) {
      rnd.setSeed(BigInt.asIntN(64, BigInt(x) * a) ^ BigInt.asIntN(64, BigInt(z) * b) ^ seed);
      rnd.nextInt();
      const ok = gen.canSpawnStructureAtCoords(x, z), next = BigInt.asUintN(64, randomLong(rnd));
      RecordingWorld.ints(digest, [ok ? 1 : 0, Number(BigInt.asIntN(32, next >> 32n)), Number(BigInt.asIntN(32, next))]);
      if (ok) accepted.push([x, z]);
    }
    assert.deepEqual(accepted, r.accepted, r.worldSeed);
    assert.equal(digest.digest("hex"), r.decisionSha1, r.worldSeed);
    total += r.size * r.size;
  }
  assert.equal(total, 3 * 192 * 192 + 100 * 100);
});

test("GEN-05 mineshaft: driver map order, start bounding boxes and full piece trees replay natively", () => {
  const rs = records("starts");
  assert.equal(rs.length, 6);
  let starts = 0, pieces = 0;
  for (const r of rs) {
    const gen = new MapGenMineshaft(BigInt(r.worldSeed)), after = [];
    for (const [x, z] of r.centers) { gen.generate(x, z); after.push(randomLong(gen.random).toString()); }
    const label = `${r.label} ${r.worldSeed}`;
    assert.deepEqual(after, r.randomAfter, label);
    assert.deepEqual(gen.structureMap.keys(), r.keys, label);
    const full = r.starts.filter((s) => s.pieces).length;
    assert.deepEqual(startList(gen, full), r.starts, label);
    starts += r.starts.length; pieces += r.starts.reduce((n, s) => n + s.pieceCount, 0);
  }
  assert.equal(starts, 99);
  assert.ok(pieces > 10000);
  const types = new Set(rs.flatMap((r) => r.starts.flatMap((s) => (s.pieces || []).map((p) => p[0]))));
  assert.deepEqual([...types].sort(), ["MSCorridor", "MSCrossing", "MSRoom", "MSStairs"]);
});

function terrainChunks(r) {
  const terrain = new ChunkProviderGenerate(BigInt(r.worldSeed), "default", new BiomeTerrainState());
  const topAt = (x, z) => terrain.biomeState.topBlock(terrain.manager.biomeAt(x, z));
  const caves = new MapGenCaves(BigInt(r.worldSeed), terrain.manager, topAt), ravines = new MapGenRavine(BigInt(r.worldSeed), terrain.manager, topAt);
  const chunks = new Map();
  for (const [x, z, hash] of r.inputs) {
    const { blocks } = terrain.provideChunk(x, z); caves.generate(x, z, blocks); ravines.generate(x, z, blocks);
    const bytes = Buffer.alloc(blocks.length * 2); blocks.forEach((v, i) => bytes.writeUInt16LE(v, i * 2));
    assert.equal(createHash("sha1").update(bytes).digest("hex"), hash, `input ${r.worldSeed} ${x},${z}`);
    chunks.set(`${x},${z}`, blocks);
  }
  return chunks;
}

function populate(r) {
  const w = new RecordingWorld(r.fixture, r.fixture === "natural" ? terrainChunks(r) : null);
  const gen = new MapGenMineshaft(BigInt(r.worldSeed));
  for (const c of r.chunks) {
    const [cx, cz] = c.chunk, label = `${r.label} ${r.worldSeed} chunk ${cx},${cz}`;
    gen.generate(cx, cz);
    w.reset(); w.fullWrites = c.writes ? [] : null;
    const random = new JavaRandom(populationSeed(BigInt(r.worldSeed), cx, cz));
    assert.equal(gen.generateStructuresInChunk(w, random, cx, cz), c.result, label);
    assert.equal(w.writeCount, c.writeCount, label);
    if (c.writes) assert.deepEqual(w.fullWrites, c.writes, label);
    assert.equal(w.writes.digest("hex"), c.writesSha1, label);
    assert.equal(w.callCount, c.callCount, label);
    assert.equal(w.calls.digest("hex"), c.callsSha1, label);
    assert.deepEqual(w.entities, c.entities, label);
    assert.equal(randomLong(random).toString(), c.nextLong, label);
  }
  assert.deepEqual(w.tileList(), r.tiles, r.label);
  assert.deepEqual(startList(gen, 0), r.startsAfter, r.label);
}

test("GEN-05 mineshaft: synthetic stone/pockets/water/air population writes, minecart loot, spawners, piece removal and RNG", () => {
  const rs = records("populate").filter((r) => r.fixture !== "natural");
  assert.equal(rs.length, 10);
  for (const r of rs) populate(r);
  const chunks = rs.flatMap((r) => r.chunks);
  // Minecart chests with level-30 enchanted books and corridor rails under carts.
  assert.ok(chunks.some((c) => c.entities.some((e) => e[0] === "MinecartChest" && e[4].some((s) => s && s[0] === 403))));
  assert.ok(chunks.filter((c) => c.entities.length).length >= 20);
  assert.ok(rs.some((r) => r.tiles.some((t) => t[1] === "spawner" && t[2] === "CaveSpider")));
  // Liquid vetoes permanently drop pieces from their start.
  const water = rs.find((r) => r.fixture === "water"), stone = rs.find((r) => r.fixture === "stone" && r.worldSeed === water.worldSeed);
  const count = (r) => r.startsAfter.reduce((n, s) => n + s.pieceCount, 0);
  assert.ok(count(water) < count(stone));
});

test("GEN-05 mineshaft: population over unchanged native terrain/surface/cave/ravine chunks", () => {
  const rs = records("populate").filter((r) => r.fixture === "natural");
  assert.equal(rs.length, 3);
  for (const r of rs) populate(r);
  assert.ok(rs.every((r) => r.chunks.some((c) => c.writeCount > 0)));
});
