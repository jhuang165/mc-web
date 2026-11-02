// Native live-area Java 1.7.10 population: four seeds × three world types.
// See PopulationWorldProbe.java and public/research/population-live.md.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { ChunkProviderGenerate, BiomeTerrainState } from "../src/terrain-generator.js";
import { JavaRandom } from "../src/java-random.js";
import { BIOMES_TO_SPAWN_IN } from "../src/biome-layers.js";

const exec = promisify(execFile),
  root = path.dirname(fileURLToPath(import.meta.url)),
  exists = (p) => access(p).then(() => true, () => false);
// [label, seed, world type], using the browser spawn-biome viewport.
export const POPULATION_WORLDS = [0n,17n,10n,8675309n].flatMap(seed => ['default','amplified','largeBiomes'].map(type => [`${type}-${seed}`,seed,type]));
function origin(seed, type) {
  const gen = new ChunkProviderGenerate(seed, type, new BiomeTerrainState());
  const spawn = gen.manager.findBiomePosition(0, 0, 256, BIOMES_TO_SPAWN_IN, new JavaRandom(seed));
  return [(spawn ? spawn[0] >> 4 : 0) - 4, (spawn ? spawn[2] >> 4 : 0) - 4];
}
const researchDirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "population-world-probe");
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), "e80d9b3bf5085002218d4be59e668bac718abbc6");
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || "").split(path.delimiter).filter(Boolean)) if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [path.join(os.homedir(), "Library/Application Support/minecraft/libraries"), path.join(os.homedir(), ".minecraft/libraries"), path.join(os.homedir(), ".gradle/caches")]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec("find", [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"], { maxBuffer: 1 << 24 });
    const hit = stdout.split("\n").filter(Boolean).sort()[0];
    if (hit) return hit;
  }
  throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "authlib-", "netty-", "commons-io-"].map(library));
const classes = path.join(out, "classes");
await rm(classes, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const probe = path.join(out, "probe");
await mkdir(probe, { recursive: true });
const cp = [probe, classes, jar, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, ...["TerrainProbe", "SpringProbe", "DecorationFeatureProbe", "BiomeDecoratorProbe", "MineshaftProbe", "MineshaftWorldProbe", "DungeonProbe", "BiomeOverrideProbe", "PopulationTailProbe", "PopulationWorldProbe"].map((n) => path.join(root, `probes/${n}.java`))]);
const specs = POPULATION_WORLDS.map(([label, seed, type]) => [label, seed, type, ...origin(seed, type)].join(":"));
const { stdout, stderr } = await exec("java", ["-Xmx2g", "-cp", cp, "PopulationWorldProbe", ...specs], { maxBuffer: 1 << 30 });
await writeFile(path.join(out,"raw.jsonl"),stdout);
await writeFile(path.join(out,"trace.txt"),stderr);
if(/Exception|Caused by:/.test(stderr))throw new Error(stderr);
const rows = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
const records=rows;
assert.equal(records.length, POPULATION_WORLDS.length);
for(const r of records) { assert.equal(r.inputs.length,64); assert.equal(r.steps.length,64); assert.equal(r.areaSha1.length,64); }
const { stderr: version } = await exec("java", ["-XshowSettings:properties", "-version"]);
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const names = ["aqz", "aqx", "ave", "asw", "atc", "avm", "avk", "asv", "asx", "asy", "asz", "ata", "atb", "apx", "ahb", "aoc", "aje", "ajf", "amy", "ama", "apj", "xm", "akx"];
const classesUsed = Object.fromEntries(await Promise.all(names.map(async (c) => [c, {
  name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex"),
}])));
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  jvm: String(version).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "Unchanged ChunkProviderGenerate.provideChunk and populate with map features ON and only mineshafts enabled; village/stronghold/temple subclasses do no draws or writes. All 64 live chunks terrain/start search first, then 64 populates in x-outer/z-inner order. Lazy halo has terrain/caves/ravines only. World.rand seed 0. World/Chunk block callbacks and tile entities run unchanged. Light services are explicit fixtures: full/block 0, saved sky 15; no light propagation. Inputs and area hashes pack original id | metadata<<12 as int32 LE per x,z,y. Per-chunk ordered calls/writes and post-populate RNG; chest slots, spawners, carts, animals, pending ticks, drops and world RNG are captured. HashMap iteration is this JVM (Java 8+).",
  records,
};
const text = JSON.stringify(reference) + "\n";
console.log("reference bytes",text.length);
assert.ok(text.length < 6_000_000);
await writeFile(path.join(root, "../public/research/population-world-reference.json"), text);
console.log('Native population:', records.length, 'worlds;', records.reduce((n,r)=>n+r.tiles.length,0),'tiles;',text.length,'bytes');
