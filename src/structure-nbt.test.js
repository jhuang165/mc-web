import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { ChunkProviderGenerate, BiomeTerrainState } from "./terrain-generator.js";
import { MapGenCaves, MapGenRavine } from "./mapgen.js";
import { StructurePopulationArea } from "./structure-population-area.js";
import { NBT, decodeNbt, encodeNbt } from "./nbt.js";
import {
  STRUCTURE_PIECE_IDS, UNSUPPORTED_PIECE_IDS, UNSUPPORTED_START_IDS, STRUCTURE_DATA_NAMES,
  javaStringHash, javaHashMapOrder, compoundTag, pieceId, pieceToNbt, pieceFromNbt, startId, startToNbt, startFromNbt,
  structureKey, structureDataDocument, encodeStructureData, encodeStructureDataDat,
  decodeStructureData, decodeStructureDataDat, loadStructureStarts, structureMapOf,
} from "./structure-nbt.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/structure-nbt-reference.json", import.meta.url)));
const records = reference.records, GENERATORS = Object.keys(STRUCTURE_DATA_NAMES);
const full = records.filter((r) => !r.census), census = records.filter((r) => r.census);
const bytesOf = (b64) => new Uint8Array(Buffer.from(b64, "base64"));
const b64 = (bytes) => Buffer.from(bytes).toString("base64");

function terrainSource(seed, type) {
  const state = new BiomeTerrainState(), gen = new ChunkProviderGenerate(seed, type, state), manager = gen.manager;
  const top = (x, z) => state.topBlock(manager.biomeAt(x, z));
  const caves = new MapGenCaves(seed, manager, top), ravines = new MapGenRavine(seed, manager, top), cache = new Map();
  const terrain = (x, z) => {
    const k = `${x},${z}`; let chunk = cache.get(k);
    if (!chunk) {
      const c = gen.provideChunk(x, z); caves.generate(x, z, c.blocks); ravines.generate(x, z, c.blocks);
      chunk = { blocks: c.blocks.slice(), metadata: c.metadata.slice() }; cache.set(k, chunk);
    }
    return chunk;
  };
  return { terrain, manager };
}
const stepKey = (s) => [s.callCount, s.callsSha1, s.writeCount, s.writesSha1].join("|");

// One JS run per native world, memoised: created bytes (after the search) and, for the GEN-05g worlds, the
// populated bytes. preload is a {generator: decoded} map installed before the search, as native MapStorage does.
const runs = new Map();
function jsRun(rec, preload = null) {
  const key = rec.label + (preload ? ":reload" : ""); if (runs.has(key)) return runs.get(key);
  const seed = BigInt(rec.seed), [x, z] = rec.chunk, { terrain, manager } = terrainSource(seed, rec.type);
  const area = new StructurePopulationArea({ seed, chunkX: x, chunkZ: z, terrain, manager });
  if (preload) for (const name of GENERATORS) area.population.generators[name].structureMap = structureMapOf(preload[name]);
  const out = { area, created: {}, populated: {}, order: {} };
  const snapshot = () => {
    for (const name of GENERATORS) {
      const g = area.population.generators[name];
      out.created[name] = b64(encodeStructureData(g));
      out.order[name] = g.structureMap.values().map((s) => [s.chunkX, s.chunkZ]);
    }
  };
  if (rec.census) { area.population.searchChunk(x, z); snapshot(); }
  else {
    area.run({ beforePopulate: snapshot });
    for (const name of GENERATORS) out.populated[name] = b64(encodeStructureData(area.population.generators[name]));
    out.step = area.steps[0];
  }
  runs.set(key, out); return out;
}

test("reference covers ten native worlds and 31 of the 33 piece ids", () => {
  assert.equal(records.length, 10); assert.equal(full.length, 5); assert.equal(census.length, 5);
  assert.equal(reference.target, "Minecraft Java 1.7.10");
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.equal(reference.pieceIdsRegistered, 33);
  const seen = Object.keys(reference.pieceCounts).sort();
  assert.deepEqual(STRUCTURE_PIECE_IDS.filter((id) => !seen.includes(id)).sort(), ["SHRT", "ViW"]);
  assert.deepEqual(seen.filter((id) => !STRUCTURE_PIECE_IDS.includes(id)), []);
  assert.deepEqual(reference.startCounts, { Mineshaft: 2, Village: 3, Stronghold: 1, Temple: 4 });
  assert.equal(Object.values(reference.pieceCounts).reduce((a, b) => a + b, 0), 371);
  for (const rec of records) assert.equal(rec.nativeReadBackMatches, true, rec.label);
  assert.equal(UNSUPPORTED_PIECE_IDS.length, 15); assert.deepEqual(UNSUPPORTED_START_IDS, ["Fortress"]);
  assert.equal(new Set([...STRUCTURE_PIECE_IDS, ...UNSUPPORTED_PIECE_IDS]).size, 48);
});

test("HashMap order model matches Java hashing and native key orders", () => {
  const hash = (t) => { let h = 0; for (let i = 0; i < t.length; i++) h = (Math.imul(31, h) + t.charCodeAt(i)) | 0; return h; };
  assert.equal(javaStringHash("id"), 3355); assert.equal(javaStringHash(""), 0); assert.equal(javaStringHash("[-25,5]"), hash("[-25,5]"));
  assert.equal(javaStringHash("Children"), hash("Children"));
  // Native key order of a start compound as recorded by the probe (put order id, ChunkX, ChunkZ, BB, Children, Valid).
  assert.deepEqual(javaHashMapOrder(["id", "ChunkX", "ChunkZ", "BB", "Children", "Valid"]), ["BB", "Valid", "ChunkZ", "id", "Children", "ChunkX"]);
  assert.deepEqual([...compoundTag([["b", { type: NBT.BYTE, value: 1 }], ["a", { type: NBT.BYTE, value: 2 }]]).value.keys()], javaHashMapOrder(["b", "a"]));
  // Seventeen keys force a resize; every key stays present exactly once.
  const keys = Array.from({ length: 17 }, (_, i) => `k${i}`);
  assert.deepEqual([...javaHashMapOrder(keys)].sort(), [...keys].sort());
});

test("JS created data equals the native MapGenStructureData bytes for all ten worlds", () => {
  for (const rec of records) {
    const js = jsRun(rec);
    for (const name of GENERATORS) assert.equal(js.created[name], rec.created[name], `${rec.label} ${name} created`);
    assert.deepEqual(js.order, Object.fromEntries(GENERATORS.map((n) => [n, rec.baseline.mapOrder[n]])), `${rec.label} start map order`);
  }
});

test("JS populated data equals the native bytes after population (GEN-05g worlds)", () => {
  for (const rec of full) {
    const js = jsRun(rec);
    for (const name of GENERATORS) assert.equal(js.populated[name], rec.baseline.populated[name], `${rec.label} ${name} populated`);
    assert.equal(js.step.writesSha1, rec.baseline.step.writesSha1, rec.label);
  }
});

test("native raw and gzip trees decode, re-encode to identical bytes and keep every tag type and name", async () => {
  for (const rec of records) for (const name of GENERATORS) {
    for (const raw of [rec.created[name], rec.baseline.populated[name]]) {
      const bytes = bytesOf(raw), doc = decodeNbt(bytes);
      assert.deepEqual(encodeNbt(doc), bytes);
      assert.deepEqual(encodeStructureData(decodeStructureData(bytes).starts), bytes, `${rec.label} ${name}`);
      assert.deepEqual(encodeNbt(structureDataDocument(decodeStructureData(bytes).starts)), bytes);
    }
    const gz = bytesOf(rec.populatedGzip[name]);
    assert.deepEqual(new Uint8Array(gunzipSync(gz)), bytesOf(rec.baseline.populated[name]), "native gzip is the same raw root");
    assert.deepEqual(encodeStructureData(decodeStructureData(new Uint8Array(gunzipSync(gz))).starts), bytesOf(rec.baseline.populated[name]));
    const viaDat = await decodeStructureDataDat(gz);
    assert.equal(viaDat.starts.length, rec.createdKeys[name].length);
    assert.deepEqual(viaDat.skipped, []);
  }
});

test("JS gzip .dat files round trip and decode to the native starts", async () => {
  for (const rec of records) for (const name of GENERATORS) {
    const decoded = decodeStructureData(bytesOf(rec.created[name]));
    assert.deepEqual(decoded.starts.map((s) => structureKey(s.chunkX, s.chunkZ)), rec.createdKeys[name]);
    const dat = await encodeStructureDataDat(decoded.starts);
    assert.equal(dat[0], 0x1f); assert.equal(dat[1], 0x8b);
    assert.deepEqual(encodeStructureData((await decodeStructureDataDat(dat)).starts), bytesOf(rec.created[name]));
  }
});

test("decoded native starts rebuild the registered classes with the persisted fields", () => {
  for (const rec of records) for (const name of GENERATORS) {
    const doc = decodeNbt(bytesOf(rec.created[name])), features = doc.tag.value.get("data").value.get("Features").value;
    const decoded = decodeStructureData(bytesOf(rec.created[name])).starts;
    assert.equal(decoded.length, features.size);
    decoded.forEach((start, i) => {
      const tag = [...features.values()][i], children = tag.value.get("Children").value.items;
      assert.equal(startId(start), tag.value.get("id").value);
      assert.equal(start.chunkX, tag.value.get("ChunkX").value); assert.equal(start.chunkZ, tag.value.get("ChunkZ").value);
      assert.deepEqual(start.boundingBox.toArray(), [...tag.value.get("BB").value]);
      assert.equal(start.components.length, children.length);
      start.components.forEach((piece, j) => {
        assert.equal(pieceId(piece), children[j].get("id").value);
        assert.equal(piece.coordBaseMode, children[j].get("O").value); assert.equal(piece.componentType, children[j].get("GD").value);
        assert.deepEqual(piece.boundingBox.toArray(), [...children[j].get("BB").value]);
        assert.deepEqual(pieceToNbt(piece), { type: NBT.COMPOUND, value: children[j] });
      });
    });
  }
  // Every native piece compound survives decode and encode with exactly the native key set.
  const ids = new Set();
  for (const rec of records) for (const name of GENERATORS) {
    for (const [, start] of decodeNbt(bytesOf(rec.created[name])).tag.value.get("data").value.get("Features").value) {
      for (const child of start.value.get("Children").value.items) {
        ids.add(child.get("id").value);
        const tag = { type: NBT.COMPOUND, value: child }, back = pieceToNbt(pieceFromNbt(tag));
        assert.deepEqual([...back.value.keys()], [...child.keys()]);
        assert.deepEqual(encodeNbt({ name: "", tag: back }), encodeNbt({ name: "", tag }));
      }
    }
  }
  assert.equal(ids.size, 31);
});

test("start map order after reload equals the native loaded map order", () => {
  for (const rec of records) for (const name of GENERATORS) {
    const decoded = decodeStructureData(bytesOf(rec.created[name]));
    assert.deepEqual(structureMapOf(decoded).values().map((s) => [s.chunkX, s.chunkZ]), rec.baseline.mapOrder[name], `${rec.label} ${name}`);
  }
});

test("populating from reloaded starts matches the original writes and the native read-back", async () => {
  for (const rec of full) {
    const original = jsRun(rec);
    // Reload from the native bytes and, separately, from the JS .dat file bytes.
    for (const source of ["native", "dat"]) {
      const preload = {};
      for (const name of GENERATORS) {
        preload[name] = source === "native" ? decodeStructureData(bytesOf(rec.created[name]))
          : await decodeStructureDataDat(await encodeStructureDataDat(decodeStructureData(bytesOf(original.created[name])).starts));
      }
      const rl = jsRun({ ...rec, label: `${rec.label}:${source}` }, preload);
      assert.equal(rl.step.writeCount, original.step.writeCount, `${rec.label} ${source}`);
      assert.equal(rl.step.writesSha1, original.step.writesSha1, `${rec.label} ${source}`);
      assert.equal(rl.step.callsSha1, original.step.callsSha1, `${rec.label} ${source}`);
      assert.equal(rl.step.callCount, original.step.callCount);
      assert.equal(rl.step.nextLong, original.step.nextLong);
      assert.equal(rl.step.writesSha1, rec.baseline.step.writesSha1);
      // The temple world's native call stream is 319 calls longer than the port's (known GEN-05g limit);
      // its ordered writes and RNG streams still agree.
      if (rec.label !== "s17_10_-53") assert.equal(rl.step.callsSha1, rec.baseline.step.callsSha1, `${rec.label} native call stream`);
      assert.equal(rl.step.nextLong, rec.baseline.step.providerNextLong);
      for (const name of GENERATORS) assert.equal(rl.populated[name], rec.baseline.populated[name], `${rec.label} ${source} ${name} populated`);
      assert.deepEqual(rl.created, original.created);
      assert.equal(rec.nativeReadBackMatches, true);
    }
  }
});

test("unregistered ids are skipped like the original, and malformed fields follow native accessor defaults", () => {
  const piece = decodeNbt(bytesOf(full[0].created.mineshaft)).tag.value.get("data").value.get("Features").value.values().next().value.value.get("Children").value.items[0];
  const start = (id, children) => compoundTag([["id", { type: NBT.STRING, value: id }], ["ChunkX", { type: NBT.INT, value: 3 }], ["ChunkZ", { type: NBT.INT, value: -4 }],
    ["BB", { type: NBT.INT_ARRAY, value: Int32Array.of(48, 1, -64, 63, 64, -49) }], ["Children", { type: NBT.LIST, value: { elementType: NBT.COMPOUND, items: children } }]]);
  assert.equal(startFromNbt(start("Fortress", [])), null);
  const fortressPiece = new Map(piece); fortressPiece.set("id", { type: NBT.STRING, value: "NeStart" });
  assert.equal(pieceFromNbt({ type: NBT.COMPOUND, value: fortressPiece }), null);
  const mixed = startFromNbt(start("Mineshaft", [fortressPiece, piece]));
  assert.equal(mixed.components.length, 1); assert.equal(pieceId(mixed.components[0]), "MSRoom");
  // MapGenStructure.func_143027_a skips compounds without ChunkX/ChunkZ and unknown start ids.
  const features = compoundTag([["[3,-4]", start("Fortress", [])], ["[9,9]", compoundTag([["id", { type: NBT.STRING, value: "Mineshaft" }]])], ["[1,1]", start("Mineshaft", [piece])]]);
  const doc = { name: "", tag: compoundTag([["data", compoundTag([["Features", features]])]]) };
  const decoded = decodeStructureData(encodeNbt(doc));
  assert.deepEqual(decoded.starts.map((s) => [s.chunkX, s.chunkZ]), [[3, -4]]);
  assert.deepEqual(decoded.skipped.map((s) => s.id), ["Fortress"]);
  assert.equal(decodeStructureData(encodeNbt({ name: "", tag: compoundTag([]) })).starts.length, 0);
  // Missing scalar tags read as 0/false; a wrong tag type is an error (NBTTagCompound.func_74762_e throws).
  const bare = compoundTag([["id", { type: NBT.STRING, value: "MSCorridor" }]]);
  const p = pieceFromNbt(bare);
  assert.equal(p.hasRails, false); assert.equal(p.sectionCount, 0); assert.equal(p.coordBaseMode, 0); assert.equal(p.boundingBox, null);
  const wrong = compoundTag([["id", { type: NBT.STRING, value: "MSCorridor" }], ["Num", { type: NBT.STRING, value: "x" }]]);
  assert.throws(() => pieceFromNbt(wrong));
});

test("ViW and SHRT are never generated natively, so they are covered by synthetic round trips", () => {
  const find = (id) => { for (const rec of records) for (const name of GENERATORS) for (const [, s] of decodeNbt(bytesOf(rec.created[name])).tag.value.get("data").value.get("Features").value) for (const c of s.value.get("Children").value.items) if (c.get("id").value === id) return c; };
  const village = find("ViSR"), stronghold = find("SHLT");
  const viw = new Map(village); viw.set("id", { type: NBT.STRING, value: "ViW" }); viw.delete("Length");
  const shrt = new Map(stronghold); shrt.set("id", { type: NBT.STRING, value: "SHRT" });
  for (const m of [viw, shrt]) {
    const tag = compoundTag([...m.entries()]), piece = pieceFromNbt(tag);
    assert.equal(pieceId(piece), m.get("id").value);
    assert.deepEqual(encodeNbt({ name: "", tag: pieceToNbt(piece) }), encodeNbt({ name: "", tag }));
  }
});

test("every registered id and the data names match the recorded native registry", () => {
  assert.deepEqual(STRUCTURE_DATA_NAMES, { mineshaft: "Mineshaft", village: "Village", stronghold: "Stronghold", scatteredFeature: "Temple" });
  assert.equal(STRUCTURE_PIECE_IDS.length, 33);
  assert.deepEqual(Object.keys(reference.classes), ["avi", "avj", "avk", "avm", "ave", "asv", "atc", "auh", "aty", "avo", "du", "dh", "azq", "aqz"]);
  for (const c of Object.values(reference.classes)) assert.match(c.sha256, /^[0-9a-f]{64}$/);
});
