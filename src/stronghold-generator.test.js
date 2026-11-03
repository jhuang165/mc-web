import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { JavaRandom } from "./java-random.js";
import { randomLong, StructureBoundingBox } from "./structure-framework.js";
import { RecordingWorld } from "./structure-framework-fixture.js";
import {
  MapGenStronghold, StrongholdPiece, STRONGHOLD_STONES, STRONGHOLD_CHEST_CORRIDOR_LOOT, STRONGHOLD_LIBRARY_LOOT,
  STRONGHOLD_ROOM_CROSSING_LOOT, strongholdWeightTable, STRONGHOLD_DOORS, StrongholdLibrary, StrongholdPortalRoom,
} from "./stronghold-generator.js";
import { populationSeed } from "./ore-generator.js";
import { MapGenCaves, MapGenRavine } from "./mapgen.js";
import { ChunkProviderGenerate, BiomeTerrainState } from "./terrain-generator.js";
import { WorldChunkManager } from "./biome-layers.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/stronghold-reference.json", import.meta.url)));
const placement = JSON.parse(readFileSync(new URL("../public/research/structure-placement-reference.json", import.meta.url)));
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
const managers = new Map();
const manager = (seed, type = "default") => {
  const k = `${seed}/${type}`;
  if (!managers.has(k)) managers.set(k, new WorldChunkManager(BigInt(seed), type));
  return managers.get(k);
};
const generatorFor = (seed) => MapGenStronghold.forSeed(BigInt(seed), manager(seed));

test("GEN-05d stronghold: weight table, limits, loot tables and block ids match the unchanged classes", () => {
  assert.equal(ref.config.weights.length, 11);
  assert.deepEqual(strongholdWeightTable(), ref.config.weights.map((w) => [w[0], w[1], w[2]]));
  assert.deepEqual(STRONGHOLD_CHEST_CORRIDOR_LOOT, ref.config.loot.chestCorridor);
  assert.deepEqual(STRONGHOLD_LIBRARY_LOOT, ref.config.loot.library);
  assert.deepEqual(STRONGHOLD_ROOM_CROSSING_LOOT, ref.config.loot.roomCrossing);
  assert.deepEqual(ref.config.strongholdSettings, { distance: 32, spread: 3, count: 3 });
  assert.equal(ref.config.blocks.br, 120);
  assert.equal(ref.config.blocks.aV, 98);
});

test("GEN-05d stronghold: Stones selector replays native draws", () => {
  const rs = records("stones");
  assert.equal(rs.length, 2);
  for (const r of rs) {
    const rnd = new JavaRandom(BigInt(r.seed)), d = createHash("sha1"), hist = {}, first = [];
    for (let i = 0; i < r.draws; i++) {
      const edge = i % 3 !== 0, [id, meta] = STRONGHOLD_STONES.select(rnd, i & 15, i & 7, i & 31, edge);
      RecordingWorld.ints(d, [id, meta]);
      const k = `${edge ? "e" : "i"}${id}:${meta}`;
      hist[k] = (hist[k] || 0) + 1;
      if (i < 40) first.push([id, meta]);
    }
    assert.deepEqual(first, r.first);
    assert.deepEqual(Object.fromEntries(Object.entries(hist).sort(([a], [b]) => (a < b ? -1 : 1))), r.histogram);
    assert.equal(d.digest("hex"), r.sha1);
    assert.equal(randomLong(rnd).toString(), r.nextLong);
  }
});

test("GEN-05d stronghold: all four door types write the native blocks in every orientation", () => {
  const r = records("doors")[0];
  assert.deepEqual(STRONGHOLD_DOORS, r.names);
  assert.equal(r.values.length, 16);
  let writes = 0;
  for (const [mode, door, boxArr, expected] of r.values) {
    const b = StructureBoundingBox.componentBox(37, 30, -21, -1, -1, 0, 9, 7, 11, mode);
    assert.deepEqual(b.toArray(), boxArr);
    const piece = new StrongholdPiece(0);
    piece.coordBaseMode = mode; piece.boundingBox = b;
    const w = new RecordingWorld("stone"); w.fullWrites = [];
    const clip = StructureBoundingBox.xz(b.minX - 2, b.minZ - 2, b.maxX + 2, b.maxZ + 2);
    piece.placeDoor(w, null, clip, door, 1, 1, 0);
    piece.placeDoor(w, null, clip, door, 4, 3, 0);
    assert.deepEqual(w.fullWrites, expected, `mode ${mode} door ${STRONGHOLD_DOORS[door]}`);
    writes += expected.length;
  }
  assert.equal(writes, r.values.reduce((n, v) => n + v[3].length, 0));
  assert.ok(writes > 300);
});

test("GEN-05d stronghold: ring positions and coordinate lists match the native positions", () => {
  const rs = records("positions");
  assert.equal(rs.length, 16);
  for (const r of rs) {
    const gen = generatorFor(r.worldSeed);
    assert.deepEqual(gen.positions, r.positions, r.worldSeed);
    assert.deepEqual(gen.getCoordList(), r.coordList, r.worldSeed);
  }
  // The 3 native positions of the earlier placement reference agree.
  const sh = placement.records.filter((x) => x.kind === "stronghold" && x.type === "default" && x.count === 3);
  assert.ok(sh.length > 0);
  for (const x of sh) assert.deepEqual(MapGenStronghold.forSeed(BigInt(x.seed), manager(x.seed)).positions, x.positions);
});

test("GEN-05d stronghold: driver, regenerate-until-portal-room loop, map order and full piece trees replay natively", () => {
  const rs = records("starts");
  assert.equal(rs.length, 16);
  let starts = 0, pieces = 0, fullPieces = 0, retries = 0;
  const types = {};
  for (const r of rs) {
    const gen = generatorFor(r.worldSeed), after = [];
    for (const [x, z] of r.centers) { gen.generate(x, z); after.push(randomLong(gen.random).toString()); }
    const label = `${r.label} ${r.worldSeed}`;
    assert.deepEqual(after, r.randomAfter, label);
    assert.deepEqual(gen.structureMap.keys(), r.keys, label);
    assert.deepEqual(gen.attemptLog.map(([x, z, n]) => [x, z, n]), r.attempts.map(([x, z, n]) => [x, z, n]), label);
    const full = r.starts.filter((s) => s.pieces).length;
    assert.deepEqual(startList(gen, full), r.starts, label);
    for (const s of r.starts) for (const p of s.pieces || []) { types[p[0]] = (types[p[0]] || 0) + 1; fullPieces++; }
    for (const a of r.attempts) if (a[2] > 1) retries++;
    starts += r.starts.length; pieces += r.starts.reduce((n, s) => n + s.pieceCount, 0);
  }
  assert.equal(starts, 48);
  assert.ok(retries >= 1, "at least one start must exercise the regenerate loop");
  assert.ok(pieces > 5000);
  assert.deepEqual(Object.keys(types).sort(), ["SH5C", "SHCC", "SHFC", "SHLT", "SHLi", "SHPH", "SHPR", "SHRC", "SHS", "SHSD", "SHSSD", "SHStart"]);
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

// World that also hashes the writes of the current piece call, like the probe's per-call digest.
class CallWorld extends RecordingWorld {
  setBlock(x, y, z, id, meta, flags) {
    if (this.cur && !(y < 0 || y >= 256 || x < -30000000 || x >= 30000000 || z < -30000000 || z >= 30000000)) RecordingWorld.ints(this.cur, [x, y, z, id, meta, flags]);
    return super.setBlock(x, y, z, id, meta, flags);
  }
}

const calledTypes = {};
let spawnerSeen = 0, chestSeen = 0, frameSeen = 0;
function populate(r) {
  const chunks = r.fixture === "natural" ? terrainChunks(r) : null;
  const w = new RecordingWorld(r.fixture, chunks), wb = new CallWorld(r.fixture, chunks);
  const gen = generatorFor(r.worldSeed), genB = generatorFor(r.worldSeed);
  let pieceCalls = 0;
  for (const c of r.chunks) {
    const [cx, cz] = c.chunk, label = `${r.label} ${r.worldSeed} chunk ${cx},${cz}`;
    gen.generate(cx, cz); genB.generate(cx, cz);
    w.reset(); w.fullWrites = c.writes ? [] : null; wb.reset();
    const random = new JavaRandom(populationSeed(BigInt(r.worldSeed), cx, cz));
    assert.equal(gen.generateStructuresInChunk(w, random, cx, cz), c.result, label);
    assert.equal(w.writeCount, c.writeCount, label);
    if (c.writes) assert.deepEqual(w.fullWrites, c.writes, label);
    assert.equal(w.writes.digest("hex"), c.writesSha1, label);
    assert.equal(w.callCount, c.callCount, label);
    assert.equal(w.calls.digest("hex"), c.callsSha1, label);
    assert.equal(randomLong(random).toString(), c.nextLong, label);
    // Second pass: the same loop unrolled per addComponentParts call, with each call's kept flag, write count and write digest.
    const rb = new JavaRandom(populationSeed(BigInt(r.worldSeed), cx, cz)), x = (cx << 4) + 8, z = (cz << 4) + 8;
    const bb = StructureBoundingBox.xz(x, z, x + 15, z + 15), calls = [];
    genB.structureMap.values().forEach((st, si) => {
      if (!st.boundingBox.intersectsWithXZ(x, z, x + 15, z + 15)) return;
      let pi = 0;
      st.components = st.components.filter((p) => {
        if (!p.boundingBox.intersectsWith(bb)) { pi++; return true; }
        wb.cur = createHash("sha1"); const w0 = wb.writeCount;
        const keep = p.addComponentParts(wb, rb, bb); pieceCalls++;
        const tk = p.describe().slice(0, 1).concat(p.constructor.saveId === "SHRC" ? [p.roomType] : p.constructor.saveId === "SHLi" ? [p.isLarge] : []).join(":");
        calledTypes[tk] = (calledTypes[tk] || 0) + 1;
        calls.push([si, pi, keep ? 1 : 0, wb.writeCount - w0, wb.cur.digest("hex").slice(0, 12)]);
        wb.cur = null;
        if (keep) pi++;
        return keep;
      });
    });
    assert.deepEqual(calls, c.calls, label);
    assert.equal(wb.writes.digest("hex"), c.writesSha1, label);
    assert.equal(randomLong(rb).toString(), c.nextLong, label);
  }
  assert.equal(pieceCalls, r.pieceCalls, r.label);
  assert.deepEqual(w.tileList(), r.tiles, r.label);
  assert.deepEqual(wb.tileList(), r.tiles, r.label);
  assert.deepEqual(startList(gen, 0), r.startsAfter, r.label);
  assert.deepEqual(startList(genB, 0), r.startsAfter, r.label);
  for (const t of r.tiles) { if (t[1] === "spawner") spawnerSeen++; else chestSeen++; }
  for (const c of r.chunks) if (c.writes) frameSeen += c.writes.filter((q) => q[3] === 120).length;
}

test("GEN-05d stronghold: synthetic stone/pockets/water/air population writes, loot, spawners, portal frames, piece removal and RNG", () => {
  const rs = records("populate").filter((r) => r.fixture !== "natural");
  assert.equal(rs.length, 10);
  for (const r of rs) populate(r);
  const wanted = ["SHS", "SHLT", "SHFC", "SHSD", "SHSSD", "SHRC:0", "SHRC:1", "SHRC:2", "SHRC:3", "SHRC:4", "SHCC", "SHPH", "SHLi:true", "SHLi:false", "SH5C", "SHStart", "SHPR"];
  assert.deepEqual(Object.keys(calledTypes).sort(), wanted.sort(), "every piece type and variant is exercised by addComponentParts");
  assert.ok(chestSeen > 0, "chests with native loot were placed");
  assert.ok(spawnerSeen > 0, "silverfish spawners were placed");
  assert.ok(frameSeen >= 12, "end portal frames were recorded in full writes");
  const rows = rs.filter((r) => r.worldSeed === "8675309");
  const water = rows.find((r) => r.fixture === "water"), stone = rows.find((r) => r.fixture === "stone");
  const count = (r) => r.startsAfter.reduce((n, s) => n + s.pieceCount, 0);
  assert.ok(count(water) < count(stone), "liquid vetoes drop pieces permanently");
});

test("GEN-05d stronghold: population over unchanged native terrain/surface/cave/ravine chunks", () => {
  const rs = records("populate").filter((r) => r.fixture === "natural");
  assert.equal(rs.length, 3);
  for (const r of rs) populate(r);
  assert.ok(rs.every((r) => r.chunks.some((c) => c.writeCount > 0)));
});

test("GEN-05d stronghold: coverage of piece variants, silverfish spawners and eye-of-ender frames in the evidence", () => {
  assert.equal(StrongholdPortalRoom.saveId, "SHPR");
  assert.equal(StrongholdLibrary.saveId, "SHLi");
  const all = records("starts").flatMap((r) => r.starts.flatMap((s) => s.pieces || []));
  assert.ok(all.some((p) => p[0] === "SHLi" && p[10] === true), "large library present");
  assert.ok(all.some((p) => p[0] === "SHLi" && p[10] === false), "small library present");
  assert.equal(all.filter((p) => p[0] === "SHRT").length, 0, "RightTurn weights spawn LeftTurn natively (inherited finder)");
  assert.deepEqual([0, 1, 2, 3, 4].filter((t) => all.some((p) => p[0] === "SHRC" && p[10] === t)), [0, 1, 2, 3, 4]);
  const rs = records("populate");
  assert.ok(rs.some((r) => r.tiles.some((t) => t[1] === "spawner" && t[2] === "Silverfish")));
  assert.ok(rs.some((r) => r.tiles.some((t) => t[1] === "chest" && t[2].some((s) => s && s[0] === 403))), "enchanted books in chests");
  const frames = rs.flatMap((r) => r.chunks.flatMap((c) => (c.writes || []).filter((q) => q[3] === 120)));
  assert.ok(frames.length >= 12 && frames.some((q) => q[4] >= 4) && frames.some((q) => q[4] < 4));
});
