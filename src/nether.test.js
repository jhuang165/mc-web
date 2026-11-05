// Native replay of the 1.7.10 Nether generator (nether-reference.json, from tools/probes/NetherProbe.java over the
// unchanged ChunkProviderHell / MapGenCavesHell / populate features): per-stage chunk hashes, the hellRNG state,
// and 4x4-generated / 3x3-populated areas with write and call hashes, pending ticks and both random streams.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ChunkProviderHell, NetherArea, NETHERRACK, SOUL_SAND, BEDROCK, GLOWSTONE, QUARTZ_ORE } from "./nether-generator.js";
import { randomLong } from "./mapgen.js";
import { recordedWorld } from "./gen-world-recording.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/nether-reference.json", import.meta.url)));
const chunks = ref.records.filter((r) => r.kind === "chunk"), populations = ref.records.filter((r) => r.kind === "population");
const idsHash = (a) => { const b = Buffer.alloc(a.length * 2); for (let i = 0; i < a.length; i++) b.writeUInt16LE(a[i], i * 2); return createHash("sha1").update(b).digest("hex"); };
const counts = (a) => { const m = {}; for (const v of a) m[v] = (m[v] ?? 0) + 1; return Object.fromEntries(Object.entries(m).sort((x, y) => x[0] - y[0])); };
const areaHash = (c) => {
  const b = Buffer.alloc(65536 * 4);
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < 256; y++) b.writeInt32LE(c.getBlock(x, y, z) | c.getMeta(x, y, z) << 12, ((x * 16 + z) * 256 + y) * 4);
  return createHash("sha1").update(b).digest("hex");
};
const providers = new Map();
const provider = (seed) => { if (!providers.has(seed)) providers.set(seed, new ChunkProviderHell(BigInt(seed))); return providers.get(seed); };

test("reference is the pinned 1.7.10 client and covers the expected record counts", () => {
  assert.equal(ref.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.equal(chunks.length, 64);
  assert.equal(populations.length, 8);
});

for (const r of chunks) test(`ChunkProviderHell ${r.seed} ${r.x},${r.z}: terrain, surface, caves, hellRNG`, () => {
  const p = new ChunkProviderHell(BigInt(r.seed)), blocks = new Uint16Array(32768);
  p.reseed(r.x, r.z);
  p.terrain(r.x, r.z, blocks);
  assert.equal(idsHash(blocks), r.terrainSha1, "terrain");
  p.surface(r.x, r.z, blocks);
  assert.equal(idsHash(blocks), r.surfaceSha1, "surface");
  p.caves.generate(r.x, r.z, blocks);
  assert.equal(idsHash(blocks), r.sha1, "caves");
  assert.deepEqual(counts(blocks), r.counts);
  // The one-shot path equals the staged path and leaves hellRNG where the original does.
  const g = new ChunkProviderHell(BigInt(r.seed)), full = g.generateChunk(r.x, r.z);
  assert.equal(idsHash(full.blocks), r.sha1);
  assert.equal(randomLong(g.hellRNG).toString(), r.nextLong);
});

for (const rec of populations) test(`Nether population ${rec.label}: 4x4 generated, 3x3 populated`, () => {
  const area = new NetherArea({ seed: rec.seed, chunkX: rec.origin[0], chunkZ: rec.origin[1], size: rec.size, populated: rec.populated }), w = area.world;
  const inputs = [], steps = [];
  let recording;
  area.run({
    afterGenerate(x, z, c) { inputs.push([x, z, areaHash(c)]); },
    beforePopulate() { recording = recordedWorld(w); },
    afterPopulate(x, z) { steps.push({ chunk: [x, z], calls: recording.callCount, callSha1: recording.calls.digest("hex"), writes: recording.writeCount, writeSha1: recording.writes.digest("hex") }); },
  });
  assert.deepEqual(inputs, rec.inputs, "native inputs before population");
  assert.equal(steps.length, rec.steps.length);
  steps.forEach((s, i) => assert.deepEqual(s, rec.steps[i], `step ${i}`));
  w.onCall = null; w.onWrite = null;
  const hashes = [];
  for (let x = rec.origin[0]; x < rec.origin[0] + rec.size; x++) for (let z = rec.origin[1]; z < rec.origin[1] + rec.size; z++) hashes.push(areaHash(w.chunk(x, z)));
  assert.deepEqual(hashes, rec.areaSha1, "area after population");
  assert.deepEqual(w.pending, rec.pending, "pending ticks");
  assert.equal(randomLong(area.provider.hellRNG).toString(), rec.hellNextLong, "hellRNG");
  assert.equal(randomLong(w.rand).toString(), rec.worldNextLong, "world rand");
});

test("the Nether shape: bedrock floor and ceiling, netherrack bulk, soul sand, glowstone and quartz across the population", () => {
  const seen = new Set();
  for (const r of chunks) provider(r.seed);
  const p = provider("0"), { blocks } = p.generateChunk(0, 0);
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
    assert.equal(blocks[(x * 16 + z) * 128], BEDROCK);
    assert.equal(blocks[(x * 16 + z) * 128 + 127], BEDROCK);
  }
  for (const r of chunks) for (const id of Object.keys(r.counts)) seen.add(Number(id));
  for (const id of [BEDROCK, NETHERRACK, 11, 13]) assert.ok(seen.has(id), `generated ${id}`);
  const area = new NetherArea({ seed: 0n, chunkX: 0, chunkZ: 0, size: 3, populated: 2 }).run(), written = new Set();
  for (const c of area.world.chunks.values()) for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < 128; y++) written.add(c.getBlock(x, y, z));
  assert.ok(written.has(GLOWSTONE) && written.has(QUARTZ_ORE), `population placed glowstone and quartz (${[...written].join(",")})`);
  void SOUL_SAND;
});
