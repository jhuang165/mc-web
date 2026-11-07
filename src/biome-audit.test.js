// Per-biome decoration audit: the unchanged ChunkProviderGenerate.populate (map features off) on one
// 6x6-chunk native terrain region per naturally occurring biome slot, four populates each
// (biome-audit-reference.json, tools/verify-biome-audit.mjs). The same replay records which blocks
// each biome's populate wrote, so the signature features asserted below fired in native-exact records.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { JavaRandom } from "./java-random.js";
import { randomLong, MapGenCaves, MapGenRavine } from "./mapgen.js";
import { ChunkProviderGenerate, BiomeTerrainState } from "./terrain-generator.js";
import { GenWorld } from "./gen-world.js";
import { BiomeDecoration } from "./biome-decorator.js";
import { populateChunk } from "./populate-chunk.js";
import { recordedWorld, stateSha1, assertEffects } from "./gen-world-recording.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/biome-audit-reference.json", import.meta.url)));
const wanted = JSON.parse(readFileSync(new URL("../tools/probes/biome-audit-regions.json", import.meta.url)));
const mod = (a, b) => ((a % b) + b) % b;
const sha1 = (bytes) => createHash("sha1").update(bytes).digest("hex");
const bits = (v) => { const b = Buffer.alloc(4); b.writeFloatLE(v); return b.readInt32LE(); };

// The probe's 6x6 region, x outer and z inner, with the combined input hash it prints.
function regionTerrain(region) {
  const seed = BigInt(region.seed), terrain = new ChunkProviderGenerate(seed, "default", new BiomeTerrainState());
  const topAt = (x, z) => terrain.biomeState.topBlock(terrain.manager.biomeAt(x, z));
  const caves = new MapGenCaves(seed, terrain.manager, topAt), ravines = new MapGenRavine(seed, terrain.manager, topAt);
  const digest = createHash("sha1"), chunks = [];
  for (let x = region.origin[0]; x < region.origin[0] + 6; x++) for (let z = region.origin[1]; z < region.origin[1] + 6; z++) {
    const { blocks, metadata } = terrain.provideChunk(x, z);
    caves.generate(x, z, blocks); ravines.generate(x, z, blocks);
    const bytes = Buffer.alloc(blocks.length * 2); blocks.forEach((v, i) => bytes.writeUInt16LE(v, i * 2));
    digest.update(`${x},${z},${sha1(bytes)},${sha1(Buffer.from(metadata))};`);
    chunks.push([x, z, blocks, metadata]);
  }
  assert.equal(digest.digest("hex"), region.inputsSha1, `region ${region.index} inputs`);
  return { chunks, biomeAt: (x, z) => terrain.manager.biomeAt(x, z) };
}

// Blocks (original IDs) whose placement is a biome's own decoration feature, by name.
const B = { sand: 12, gravel: 13, clay: 82, cactus: 81, reeds: 83, deadBush: 32, tallGrass: 31, dandelion: 37, poppy: 38,
  brownMushroom: 39, redMushroom: 40, brownBig: 99, redBig: 100, pumpkin: 86, melon: 103, vine: 106, lily: 111, emerald: 129,
  silverfish: 97, mossy: 48, ice: 79, packedIce: 174, doublePlant: 175, log: 17, log2: 162, leaves: 18, leaves2: 161, snow: 78,
  sandstone: 24, coal: 16, iron: 15, gold: 14, redstone: 73, lapis: 21, diamond: 56, dirt: 3, mycelium: 110 };
const wrote = new Map(); // slot -> Map("id:meta" -> count) of block writes during that slot's populates

test("biome audit: native populate on one region per biome slot, replayed exactly", () => {
  assert.equal(ref.regions.length, wanted.length);
  const decoration = new BiomeDecoration();
  for (const region of ref.regions) {
    const { chunks, biomeAt } = regionTerrain(region), seed = BigInt(region.seed);
    const rec = ref.records.find((r) => r.region === region.index), label = `region ${region.index} (slot ${region.slot})`;
    assert.deepEqual([Number(region.seed), ...region.origin, region.slot], wanted[region.index], `${label} spec`);
    const world = new GenWorld({
      rand: new JavaRandom(BigInt(rec.worldRand)), biomeAt,
      light: (x, y, z) => mod(x * 5 + y * 11 + z * 3 + rec.lightBase, 16),
      blockLight: (x, y, z) => mod(x * 7 + y * 3 + z * 13 + rec.lightBase, 14),
      skyLight: (x, y, z) => mod(x * 3 + y * 5 + z * 7 + rec.lightBase, 16),
    });
    for (const [x, z, blocks, meta] of chunks) world.addChunk(x, z, blocks, meta);
    const r = recordedWorld(world), entities = [];
    world.onEntity = (e) => entities.push(e);
    const write = world.onWrite;
    let current = -1;
    const slots = [];
    world.onWrite = (...a) => {
      write(...a);
      if (a[3] < 0) return;
      const m = wrote.get(current) ?? wrote.set(current, new Map()).get(current), k = `${a[3]}:${a[4]}`;
      m.set(k, (m.get(k) || 0) + 1);
    };
    const random = new JavaRandom(seed);
    for (const [cx, cz, biome, spawned, next] of rec.steps) {
      current = biomeAt(cx * 16 + 16, cz * 16 + 16).slot; // populate reads the biome at +16 before reseeding
      slots.push(current);
      const { biome: read } = populateChunk(world, random, seed, decoration, cx, cz);
      assert.equal(read.slot, current, `${label} chunk ${cx},${cz} slot`);
      assert.equal(read.id, biome, `${label} chunk ${cx},${cz} biome`); // slot 161 declares biomeID 160
      assert.equal(entities.length, spawned, `${label} chunk ${cx},${cz} entities`);
      assert.equal(randomLong(random).toString(), next, `${label} chunk ${cx},${cz} random`);
    }
    assert.ok(slots.includes(region.slot), `${label} reads its slot`);
    // The probe's removal pass: tile entities by x, z, y, chests emptied slot by slot and set to air with notification, spawners overwritten with stone at flag 2.
    for (const t of [...world.chunks.values()].flatMap((c) => [...c.tiles.values()]).sort((a, b) => a.x - b.x || a.z - b.z || a.y - b.y)) {
      if (t.kind === "chest") { for (let i = 0; i < 27; i++) world.setChestSlot(t, i, null); world.setBlockToAir(t.x, t.y, t.z); }
      else world.setBlock(t.x, t.y, t.z, 1, 0, 2);
    }
    assert.deepEqual([...world.chunks.values()].flatMap((c) => [...c.tiles.values()]), [], `${label} removed tile entities`);
    assert.deepEqual(entities.map((e) => [e.name, e.x, e.y, e.z, bits(e.yaw), bits(e.pitch), e.fleece]), rec.entities, `${label} entities`);
    assert.equal(r.callCount, rec.callCount, `${label} calls`);
    assert.equal(r.calls.digest("hex"), rec.callSha1, `${label} call order`);
    assert.equal(r.writeCount, rec.writeCount, `${label} writes`);
    assert.equal(r.writes.digest("hex"), rec.writeSha1, `${label} write order`);
    assert.equal(world.pending.length, rec.pendingCount, `${label} pending`);
    assert.equal(sha1(world.pending.map((p) => JSON.stringify(p)).join(",")), rec.pendingSha1, `${label} pending order`);
    assertEffects(r, rec, label);
    assert.equal(stateSha1(world), rec.stateSha1, `${label} state`);
    assert.equal(randomLong(world.rand).toString(), rec.worldNextLong, `${label} world random`);
  }
});

const ids = (slot) => new Set([...(wrote.get(slot) ?? [])].map(([k]) => Number(k.split(":")[0])));
const has = (slot, name) => ids(slot).has(B[name]);
// Signature features that fired in the native-exact records of each biome (blocks only its decorate or tree/plant generators place).
const SIGNATURES = {
  0: ["sand"], 1: ["tallGrass", "doublePlant", "poppy"], 2: ["cactus", "deadBush"], 3: ["emerald", "silverfish"], 4: ["log", "leaves"],
  5: ["log", "doublePlant"], 6: ["lily", "vine", "clay", "reeds"], 14: ["brownBig", "redBig"], 15: ["brownBig", "redBig"],
  17: ["cactus", "deadBush"], 21: ["log", "vine"], 22: ["log", "vine"], 23: ["melon", "vine"], 29: ["log2", "leaves2", "redBig", "doublePlant"],
  30: ["log", "doublePlant"], 31: ["doublePlant"], 32: ["doublePlant", "deadBush"], 33: ["doublePlant"], 34: ["emerald", "silverfish"],
  35: ["log2", "leaves2", "doublePlant"], 36: ["log2", "leaves2"], 38: ["log", "deadBush"], 129: ["doublePlant"], 130: ["cactus", "deadBush", "reeds"],
  131: ["emerald", "silverfish"], 132: ["log", "poppy", "doublePlant"], 134: ["vine", "lily", "clay"], 140: ["packedIce"], 149: ["log", "vine"],
  157: ["log2", "leaves2", "doublePlant"], 160: ["doublePlant", "deadBush"], 161: ["doublePlant", "deadBush"], 162: ["emerald", "silverfish"],
  163: ["log2", "leaves2"], 164: ["log2", "leaves2"], 165: ["cactus", "deadBush"], 166: ["deadBush"], 167: ["deadBush"],
};
test("biome audit: per-biome signature features fired in native-exact populates", () => {
  for (const [slot, names] of Object.entries(SIGNATURES))
    for (const name of names) assert.ok(has(Number(slot), name), `slot ${slot} ${name}`);
  const slots = [...wrote.keys()].filter((s) => s >= 0);
  const expected = new Set(wanted.map((w) => w[3]));
  for (const s of expected) assert.ok(wrote.has(s), `slot ${s} populated`);
  assert.ok(expected.size >= 55, `${expected.size} slots`);
});
