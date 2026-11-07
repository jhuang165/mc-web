// Records the populated state of a witch hut (TeSH "Witch" flag) in data/Temple.dat: the unchanged native population of a
// chunk that contains the hut, replayed by the JavaScript port, then read back natively from the port's own gzip .dat.
// Uses StructureNbtProbe unchanged (STRUCTURE_NBT_SCENARIOS) and writes public/research/temple-nbt-reference.json.
// Requires the pinned client JAR, a JDK and the usual probe libraries; see StructureNbtProbe.java.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { ChunkProviderGenerate, BiomeTerrainState } from "../src/terrain-generator.js";
import { MapGenCaves, MapGenRavine } from "../src/mapgen.js";
import { StructurePopulationArea } from "../src/structure-population-area.js";
import { decodeNbt } from "../src/nbt.js";
import {
  STRUCTURE_DATA_NAMES, encodeStructureData, encodeStructureDataDat, decodeStructureData,
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
const out = path.join(research, "temple-nbt-probe"), classes = path.join(out, "classes"), probe = path.join(out, "probe"), datDir = path.join(out, "js-dat");
await rm(classes, { recursive: true, force: true }); await mkdir(classes, { recursive: true });
for (const d of [datDir]) { await rm(d, { recursive: true, force: true }); await mkdir(d, { recursive: true }); }
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 }); await mkdir(probe, { recursive: true });
const cp = [probe, classes, jar, ...libs].join(path.delimiter);
const probes = ["TerrainProbe", "DecorationFeatureProbe", "SpringProbe", "BiomeDecoratorProbe", "MineshaftProbe", "MineshaftWorldProbe", "DungeonProbe", "BiomeOverrideProbe", "PopulationTailProbe", "PopulationWorldProbe", "StructurePopulationWorldProbe", "StructureNbtProbe"];
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, ...probes.map((n) => path.join(root, `probes/${n}.java`))]);
// seed, populated chunk: the Seed 0 swamp hut at x 48..56, z 752..758 lies in the populate window (x 40..55, z 744..759) of chunk (2,46).
const WORLDS = [[0, 2, 46], [0, 3, 46]];
const run = async (args) => {
  let stdout = "";
  for (const w of WORLDS) {
    const r = await exec("java", ["-Xmx2g", "-cp", cp, "StructureNbtProbe", ...args], { maxBuffer: 1 << 28, env: { ...process.env, STRUCTURE_NBT_SCENARIOS: w.join(":") } });
    if (/Exception|Caused by:/.test(r.stderr)) throw new Error(r.stderr);
    stdout += r.stdout;
  }
  return stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
};
const scenarios = await run([]);
assert.equal(scenarios.length, WORLDS.length);
const GENERATORS = Object.keys(STRUCTURE_DATA_NAMES);
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
const b64 = (b) => Buffer.from(b).toString("base64");
const witchOf = (text) => {
  const out = [];
  for (const [, s] of decodeNbt(Buffer.from(text, "base64")).tag.value.get("data").value.get("Features").value)
    for (const c of s.value.get("Children").value.items) if (c.get("id").value === "TeSH") out.push(c.get("Witch").value);
  return out;
};
const jsCreated = {}, jsPopulated = {};
for (const rec of scenarios) {
  const seed = BigInt(rec.seed), [x, z] = rec.chunk, { terrain, manager } = terrainSource(seed, rec.type);
  const area = new StructurePopulationArea({ seed, chunkX: x, chunkZ: z, terrain, manager });
  jsCreated[rec.label] = {}; jsPopulated[rec.label] = {};
  area.run({ beforePopulate: () => { for (const n of GENERATORS) jsCreated[rec.label][n] = b64(encodeStructureData(area.population.generators[n])); } });
  for (const n of GENERATORS) jsPopulated[rec.label][n] = b64(encodeStructureData(area.population.generators[n]));
  for (const n of GENERATORS) {
    assert.equal(jsCreated[rec.label][n], rec.created[n], `${rec.label} ${n} created`);
    // The village population in this world still lacks door neighbour updates; only the Temple data is held to the native bytes.
    if (n === "scatteredFeature") assert.equal(jsPopulated[rec.label][n], rec.baseline.populated[n], `${rec.label} ${n} populated`);
    await writeFile(path.join(datDir, `${rec.label}.${n}.dat`), await encodeStructureDataDat(decodeStructureData(Buffer.from(rec.created[n], "base64")).starts));
  }
}
const back = await run(["dat", datDir]);
const stepKey = (s) => [s.callCount, s.callsSha1, s.writeCount, s.writesSha1, s.providerNextLong].join("|");
const witch = {};
for (const rec of scenarios) {
  const dat = back.find((r) => r.label === rec.label);
  for (const n of GENERATORS) assert.equal(dat.created[n], rec.created[n], `${rec.label}: native re-serialises the JS ${n} .dat`);
  // Native population from the JS file equals the native baseline when both start from the same data.
  assert.equal(stepKey(dat.replay.step), stepKey(rec.baseline.step), rec.label);
  assert.equal(dat.replay.areaSha1, rec.baseline.areaSha1);
  assert.deepEqual(dat.replay.populated, rec.baseline.populated);
  witch[rec.label] = { created: witchOf(rec.created.scatteredFeature), populated: witchOf(rec.baseline.populated.scatteredFeature) };
}
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const names = ["avi", "avj", "avk", "avm", "ave", "asv", "atc", "auh", "aty", "avo", "du", "dh", "azq", "aqz"];
const classesUsed = Object.fromEntries(await Promise.all(names.map(async (c) => [c, { name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex") }])));
const jvm = await exec("java", ["-XshowSettings:properties", "-version"]);
const doc = {
  target: "Minecraft Java 1.7.10", clientSha1, srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  jvm: String(jvm.stderr).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "StructureNbtProbe (see structure-nbt-reference.json) over two Seed 0 worlds whose populated chunk contains the swamp hut found by the port's searcher (witch spawns once in addComponentParts, flag Witch). created = private Temple MapGenStructureData after the search, baseline.populated after the population; witch lists the TeSH Witch flag in both. The JavaScript port's population writes the same Temple.dat bytes and its gzip files are read back by the unchanged native loader (replay hashes equal the baseline).",
  witch, records: scenarios.map((r) => ({ label: r.label, seed: r.seed, chunk: r.chunk, created: { scatteredFeature: r.created.scatteredFeature }, populated: { scatteredFeature: r.baseline.populated.scatteredFeature }, step: r.baseline.step, areaSha1: r.baseline.areaSha1 })),
};
const text = JSON.stringify(doc) + "\n";
await writeFile(path.join(root, "../public/research/temple-nbt-reference.json"), text);
console.log("Temple NBT:", scenarios.length, "worlds, witch flags", JSON.stringify(witch), text.length, "bytes");
