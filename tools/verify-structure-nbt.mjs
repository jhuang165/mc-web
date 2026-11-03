// Records unchanged 1.7.10 structure persistence (MapGenStructureIO, StructureStart/StructureComponent NBT,
// MapGenStructureData, MapGenStructure.func_143027_a) and checks the JavaScript port against it.
// Requires the pinned client JAR, a JDK and the usual probe libraries; see StructureNbtProbe.java.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import assert from "node:assert/strict";
import { ChunkProviderGenerate, BiomeTerrainState } from "../src/terrain-generator.js";
import { MapGenCaves, MapGenRavine } from "../src/mapgen.js";
import { StructurePopulationArea } from "../src/structure-population-area.js";
import { NBT, decodeNbt, encodeNbt } from "../src/nbt.js";
import {
  STRUCTURE_DATA_NAMES, STRUCTURE_PIECE_IDS, encodeStructureData, encodeStructureDataDat,
} from "../src/structure-nbt.js";

const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url));
const exists = (p) => access(p).then(() => true, () => false);
const dirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of dirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), clientSha1 = createHash("sha1").update(await readFile(jar)).digest("hex");
assert.equal(clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || "").split(path.delimiter).filter(Boolean)) if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [path.join(os.homedir(), "Library/Application Support/minecraft/libraries"), path.join(os.homedir(), ".minecraft/libraries"), path.join(os.homedir(), ".gradle/caches")]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec("find", [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"], { maxBuffer: 1 << 24 });
    const hit = stdout.split("\n").filter(Boolean).sort()[0]; if (hit) return hit;
  }
  throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "authlib-", "netty-", "commons-io-"].map(library));
const out = path.join(research, "structure-nbt-probe"), classes = path.join(out, "classes"), probe = path.join(out, "probe"), datDir = path.join(out, "js-dat"), nativeDatDir = path.join(out, "native-dat");
await rm(classes, { recursive: true, force: true }); await mkdir(classes, { recursive: true });
for (const d of [datDir, nativeDatDir]) { await rm(d, { recursive: true, force: true }); await mkdir(d, { recursive: true }); }
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 }); await mkdir(probe, { recursive: true });
const cp = [probe, classes, jar, ...libs].join(path.delimiter);
const probes = ["TerrainProbe", "DecorationFeatureProbe", "SpringProbe", "BiomeDecoratorProbe", "MineshaftProbe", "MineshaftWorldProbe", "DungeonProbe", "BiomeOverrideProbe", "PopulationTailProbe", "PopulationWorldProbe", "StructurePopulationWorldProbe", "StructureNbtProbe"];
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, ...probes.map((n) => path.join(root, `probes/${n}.java`))]);
// Worlds are replayed one per JVM: native class statics make a run depend on earlier worlds in the same process.
const WORLDS = [[0, -19, 18], [17, -25, 5], [17, -4, -55], [17, 10, -53], [0, 0, -1], [17, 50, -12], [0, -53, -16], [0, 3, 47], [5, -50, -48], [1, 46, 3]];
const run = async (args) => {
  let stdout = "";
  for (const w of WORLDS) {
    const r = await exec("java", ["-Xmx2g", "-cp", cp, "StructureNbtProbe", ...args], { maxBuffer: 1 << 28, env: { ...process.env, STRUCTURE_NBT_SCENARIOS: w.join(":") } });
    if (/Exception|Caused by:/.test(r.stderr)) throw new Error(r.stderr);
    stdout += r.stdout;
  }
  return { stdout, records: stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse) };
};

// 1. Native persistence records.
const native = await run([]);
await writeFile(path.join(out, "raw.jsonl"), native.stdout);
const scenarios = native.records;
assert.equal(scenarios.length, 10);
const GENERATORS = Object.keys(STRUCTURE_DATA_NAMES);
// The created state, gzip-compressed as MapStorage would store it, loaded by a fresh native JVM.
for (const rec of scenarios) for (const name of GENERATORS) await writeFile(path.join(nativeDatDir, `${rec.label}.${name}.dat`), gzipSync(Buffer.from(rec.created[name], "base64")));
const nativeBack = await run(["dat", nativeDatDir]);
assert.equal(nativeBack.records.length, scenarios.length);
for (const rec of scenarios) rec.nativeReadBack = nativeBack.records.find((r) => r.label === rec.label).replay;
const CENSUS = new Set(scenarios.slice(5).map((r) => r.label));

// 2. The JavaScript port generates the same worlds and writes its own gzip .dat files (created state).
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
const jsCreated = {};
for (const rec of scenarios) {
  const seed = BigInt(rec.seed), [x, z] = rec.chunk, { terrain, manager } = terrainSource(seed, rec.type);
  jsCreated[rec.label] = {};
  const area = new StructurePopulationArea({ seed, chunkX: x, chunkZ: z, terrain, manager });
  const snapshot = () => Promise.all(GENERATORS.map(async (name) => {
    const generator = area.population.generators[name];
    jsCreated[rec.label][name] = Buffer.from(encodeStructureData(generator)).toString("base64");
    await writeFile(path.join(datDir, `${rec.label}.${name}.dat`), await encodeStructureDataDat(generator));
  }));
  // Census worlds are searched only: the JS village population still lacks door neighbour updates.
  if (CENSUS.has(rec.label)) { area.population.searchChunk(x, z); await snapshot(); continue; }
  let pending = null;
  area.run({ beforePopulate: () => { pending = snapshot(); } });
  await pending;
}

// 3. The unchanged native loader reads the JavaScript .dat files and repopulates the same worlds.
const jsdat = await run(["dat", datDir]);
assert.equal(jsdat.records.length, scenarios.length);
const stepKey = (s) => [s.callCount, s.callsSha1, s.writeCount, s.writesSha1, s.providerNextLong].join("|");
const reference = [];
const pieceCounts = {}, startCounts = {};
for (const rec of scenarios) {
  const js = jsdat.records.find((r) => r.label === rec.label);
  assert.ok(js, rec.label);
  const entry = { census: CENSUS.has(rec.label), ...rec };
  entry.nativeReadBackMatches = stepKey(rec.nativeReadBack.step) === stepKey(rec.baseline.step) && rec.nativeReadBack.areaSha1 === rec.baseline.areaSha1
    && rec.nativeReadBack.worldNextLong === rec.baseline.worldNextLong
    && JSON.stringify(rec.nativeReadBack.populated) === JSON.stringify(rec.baseline.populated)
    && JSON.stringify(rec.nativeReadBack.mapOrder) === JSON.stringify(rec.baseline.mapOrder);
  assert.ok(entry.nativeReadBackMatches, `native read-back ${rec.label}`);
  // Native re-serialisation of the JS file equals the JS bytes; native population from it equals the baseline.
  for (const name of GENERATORS) assert.equal(js.created[name], jsCreated[rec.label][name], `native reader re-serialises JS ${name} .dat ${rec.label}`);
  for (const name of GENERATORS) assert.equal(js.created[name], rec.created[name], `JS .dat equals native created .dat ${name} ${rec.label}`);
  // The JS file is byte-identical to the native created data, so the native load must replay the native read-back.
  assert.equal(stepKey(js.replay.step), stepKey(rec.nativeReadBack.step));
  assert.equal(js.replay.areaSha1, rec.nativeReadBack.areaSha1);
  assert.equal(js.replay.worldNextLong, rec.nativeReadBack.worldNextLong);
  assert.deepEqual(js.replay.populated, rec.nativeReadBack.populated);
  entry.jsDatReplay = {
    createdBytesEqualNative: true, writeCount: js.replay.step.writeCount, writesSha1: js.replay.step.writesSha1,
    callCount: js.replay.step.callCount, callsSha1: js.replay.step.callsSha1, areaSha1: js.replay.areaSha1,
    providerNextLong: js.replay.step.providerNextLong, worldNextLong: js.replay.worldNextLong,
  };
  reference.push(entry);
  for (const name of GENERATORS) {
    const features = decodeNbt(Buffer.from(rec.created[name], "base64")).tag.value.get("data").value.get("Features").value;
    for (const [key, tag] of features) {
      const id = tag.value.get("id").value; startCounts[id] = (startCounts[id] ?? 0) + 1;
      const walk = (compound) => { for (const child of compound.get("Children")?.value.items ?? []) { const p = child.get("id").value; pieceCounts[p] = (pieceCounts[p] ?? 0) + 1; } };
      walk(tag.value);
    }
  }
}

const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const names = ["avi", "avj", "avk", "avm", "ave", "asv", "atc", "auh", "aty", "avo", "du", "dh", "azq", "aqz"];
const classesUsed = Object.fromEntries(await Promise.all(names.map(async (c) => [c, { name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex") }])));
const jvm = await exec("java", ["-XshowSettings:properties", "-version"]);
const doc = {
  target: "Minecraft Java 1.7.10", clientSha1, srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  jvm: String(jvm.stderr).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "Unchanged ChunkProviderGenerate.provideChunk and populate with all four MapGenStructure maps over the five GEN-05g native worlds plus five census worlds (two villages with the remaining house/field/street ids, a swamp hut, two jungle pyramids). After the search, and again after population, the private MapGenStructureData of each generator is serialised through its own writeToNBT inside MapStorage's {data} wrapper, raw big-endian NBT, base64, in native HashMap key order. A second native JVM (one world per JVM, because native class statics make a second run in one process differ) loads the created data as a gzip .dat through CompressedStreamTools and MapGenStructureData.readFromNBT and the unchanged MapGenStructure.func_143027_a/MapGenStructureIO.func_143035_a, then repeats the population; ordered call/write hashes, final chunk, both RNG streams, populated data and start-map iteration order are recorded. jsDatReplay: the JavaScript port's own gzip .dat files (from its own starts) are read by the same native loader and repopulate to the same hashes as the native read-back.",
  pieceIdsRegistered: STRUCTURE_PIECE_IDS.length, startCounts, pieceCounts,
  records: reference,
};
const text = JSON.stringify(doc) + "\n";
assert.ok(text.length < 12_000_000);
await writeFile(path.join(root, "../public/research/structure-nbt-reference.json"), text);
console.log("Native structure NBT:", reference.length, "worlds,", Object.values(startCounts).reduce((a, b) => a + b, 0), "starts,", Object.values(pieceCounts).reduce((a, b) => a + b, 0), "pieces,", Object.keys(pieceCounts).length, "piece ids,", text.length, "bytes");
// Keep the encoder import honest: raw bytes decode back to the same tree.
assert.equal(decodeNbt(encodeNbt(decodeNbt(Buffer.from(reference[0].created.mineshaft, "base64")))).tag.type, NBT.COMPOUND);
