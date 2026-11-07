// Nether fortress persistence (data/Fortress.dat) replayed against fortress-nbt-reference.json, recorded by
// tools/verify-fortress-nbt.mjs from the unchanged 1.7.10 MapGenNetherBridge / MapGenStructureData / MapGenStructureIO.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { MapGenNetherBridge, FORTRESS_PIECE_CLASSES } from "./fortress.js";
import { NetherArea } from "./nether-generator.js";
import { randomLong } from "./structure-framework.js";
import { NBT, decodeNbt } from "./nbt.js";
import {
  STRUCTURE_PIECE_IDS, UNSUPPORTED_PIECE_IDS, STRUCTURE_START_CLASSES, FORTRESS_DATA_NAME, pieceId, pieceToNbt, pieceFromNbt,
  encodeStructureData, encodeStructureDataDat, decodeStructureData, decodeStructureDataDat, structureMapOf, startToNbt, startFromNbt,
} from "./structure-nbt.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/fortress-nbt-reference.json", import.meta.url)));
const bytesOf = (b64) => new Uint8Array(Buffer.from(b64, "base64"));
const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const FORTRESS_IDS = ["NeBCr", "NeBEF", "NeBS", "NeCCS", "NeCE", "NeCSR", "NeCTB", "NeMT", "NeRC", "NeSC", "NeSCLT", "NeSCRT", "NeSCSC", "NeSR", "NeStart"];

test("reference is the pinned 1.7.10 client and covers every fortress piece id", () => {
  assert.equal(ref.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.equal(ref.driver.length, 16); assert.equal(ref.records.length, 8);
  assert.deepEqual(Object.keys(ref.pieceCounts).sort(), FORTRESS_IDS);
  assert.deepEqual(Object.keys(ref.startCounts), ["Fortress"]); assert.ok(ref.startCounts.Fortress >= 50);
  assert.ok(ref.flagCounts.chestTrue > 0 && ref.flagCounts.chestFalse > 0 && ref.flagCounts.mobTrue > 0 && ref.flagCounts.mobFalse > 0 && ref.flagCounts.seeds > 10);
  for (const r of ref.records) { assert.equal(r.nativeReadBackMatches, true); assert.equal(r.jsDatReplayMatches, true); }
});

test("the registry covers all fortress ids and nothing is unsupported any more", () => {
  for (const id of FORTRESS_IDS) assert.ok(STRUCTURE_PIECE_IDS.includes(id), id);
  assert.equal(STRUCTURE_PIECE_IDS.length, 48); assert.deepEqual(UNSUPPORTED_PIECE_IDS, []);
  assert.equal(STRUCTURE_START_CLASSES.Fortress.name, "NetherBridgeStart"); assert.equal(FORTRESS_DATA_NAME, "Fortress");
  assert.equal(new Set(FORTRESS_PIECE_CLASSES.map((c) => pieceId(Object.create(c.prototype)))).size, 15);
});

for (const rec of ref.driver) test(`fortress driver ${rec.label}: JS Fortress.dat equals the native bytes`, () => {
  const gen = new MapGenNetherBridge(BigInt(rec.worldSeed));
  for (const [x, z] of rec.centers) gen.generate(x, z);
  assert.equal(b64(encodeStructureData(gen)), rec.data);
  assert.deepEqual(gen.structureMap.values().map((s) => [s.chunkX, s.chunkZ]), rec.mapOrder);
  // Decode then encode is the identity, and start map order after reload equals the native loaded order.
  const decoded = decodeStructureData(bytesOf(rec.data));
  assert.equal(decoded.skipped.length, 0);
  assert.deepEqual(encodeStructureData(decoded.starts), bytesOf(rec.data));
  assert.deepEqual(structureMapOf(decoded).values().map((s) => [s.chunkX, s.chunkZ]), rec.mapOrder);
});

function jsPopulation(rec, preload = null) {
  const area = new NetherArea({ seed: rec.seed, chunkX: rec.origin[0], chunkZ: rec.origin[1], size: rec.size, populated: rec.populated });
  if (preload) area.provider.bridge.structureMap = structureMapOf(preload);
  let created = null;
  area.run({ beforePopulate() { created ??= b64(encodeStructureData(area.provider.bridge)); } });
  return { created, populated: b64(encodeStructureData(area.provider.bridge)), hell: randomLong(area.provider.hellRNG).toString(), world: randomLong(area.world.rand).toString() };
}

for (const rec of ref.records) test(`fortress population ${rec.label}: created and populated data equal native, also after a reload`, async () => {
  const js = jsPopulation(rec);
  assert.equal(js.created, rec.created); assert.equal(js.populated, rec.populatedData);
  assert.equal(js.hell, rec.hellNextLong); assert.equal(js.world, rec.worldNextLong);
  // Reload from the native bytes and from the JS gzip .dat; both repopulate to the same final data and RNG streams.
  const dat = await decodeStructureDataDat(await encodeStructureDataDat(decodeStructureData(bytesOf(rec.created)).starts));
  for (const preload of [decodeStructureData(bytesOf(rec.created)), dat]) {
    const again = jsPopulation(rec, preload);
    assert.equal(again.created, rec.created); assert.equal(again.populated, rec.populatedData);
    assert.equal(again.hell, rec.hellNextLong); assert.equal(again.world, rec.worldNextLong);
  }
  // The populated file (pieces removed, chest and spawner flags set) round-trips byte for byte.
  assert.deepEqual(encodeStructureData(decodeStructureData(bytesOf(rec.populatedData)).starts), bytesOf(rec.populatedData));
  assert.deepEqual(new Uint8Array(gunzipSync(Buffer.from(await encodeStructureDataDat(decodeStructureData(bytesOf(rec.populatedData)).starts)))), bytesOf(rec.populatedData));
});

test("every recorded native fortress piece compound survives decode and encode with exactly its key set", () => {
  const ids = new Set(), fields = {};
  const raws = [...ref.driver.map((d) => d.data), ...ref.records.flatMap((r) => [r.created, r.populatedData])];
  for (const raw of raws) for (const [, start] of decodeNbt(bytesOf(raw)).tag.value.get("data").value.get("Features").value) {
    assert.equal(start.value.get("id").value, "Fortress");
    const decoded = startFromNbt(start);
    assert.deepEqual(encodeStructureData([decoded]).length > 0, true);
    assert.deepEqual(startToNbt(decoded), start);
    for (const child of start.value.get("Children").value.items) {
      const id = child.get("id").value; ids.add(id);
      fields[id] ??= [...child.keys()].filter((k) => !["id", "BB", "O", "GD"].includes(k)).sort().join(",");
      const tag = { type: NBT.COMPOUND, value: child }, back = pieceToNbt(pieceFromNbt(tag));
      assert.deepEqual([...back.value.keys()], [...child.keys()]);
      assert.deepEqual(back, tag);
    }
  }
  assert.deepEqual([...ids].sort(), FORTRESS_IDS);
  // The persisted extras: only NeBEF (Seed), NeSCLT/NeSCRT (Chest) and NeMT (Mob) carry data beyond id/BB/O/GD.
  assert.deepEqual(fields, { NeBCr: "", NeBEF: "Seed", NeBS: "", NeCCS: "", NeCE: "", NeCSR: "", NeCTB: "", NeMT: "Mob", NeRC: "", NeSC: "", NeSCLT: "Chest", NeSCRT: "Chest", NeSCSC: "", NeSR: "", NeStart: "" });
});

test("a fortress save compound is read like native: the Start piece rebuilds without generator state, bad types throw", () => {
  const first = decodeStructureData(bytesOf(ref.driver[0].data)).starts[0];
  const startPiece = first.components[0];
  assert.equal(pieceId(startPiece), "NeStart"); assert.deepEqual(startPiece.pendingPieces, []);
  const chest = first.components.find((c) => pieceId(c) === "NeSCLT" || pieceId(c) === "NeSCRT");
  const tag = pieceToNbt(chest), m = new Map(tag.value); m.set("Chest", { type: NBT.STRING, value: "x" });
  assert.throws(() => pieceFromNbt({ type: NBT.COMPOUND, value: m }));
});
