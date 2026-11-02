// Records live-world mineshafts (GEN-05b) from unchanged 1.7.10 ChunkProviderGenerate.provideChunk,
// MapGenMineshaft and Chunk.populateChunk scheduling over an 8x8 live area plus a one-chunk ring;
// see MineshaftWorldProbe.java. Requires the pinned client JAR, a JDK and the usual probe libraries.
// The live area's origin chunk is the browser's (java-world.js: spawn chunk - 4), computed here with
// the JS biome search that the terrain references already pin.
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
// [label, seed, world type]: seeds whose start search finds a mineshaft crossing the live area.
export const MINESHAFT_WORLDS = [
  ["default-0", 0n, "default"],
  ["default-17", 17n, "default"],
  ["amplified-10", 10n, "amplified"],
  ["largeBiomes-0", 0n, "largeBiomes"],
];
function origin(seed, type) {
  const gen = new ChunkProviderGenerate(seed, type, new BiomeTerrainState());
  const spawn = gen.manager.findBiomePosition(0, 0, 256, BIOMES_TO_SPAWN_IN, new JavaRandom(seed));
  return [(spawn ? spawn[0] >> 4 : 0) - 4, (spawn ? spawn[2] >> 4 : 0) - 4];
}
const researchDirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "mineshaft-world-probe");
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
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "authlib-", "netty-"].map(library));
const classes = path.join(out, "classes");
await rm(classes, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const probe = path.join(out, "probe");
await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, ...["TerrainProbe", "SpringProbe", "DecorationFeatureProbe", "BiomeDecoratorProbe", "MineshaftProbe", "MineshaftWorldProbe"].map((n) => path.join(root, `probes/${n}.java`))]);
const specs = MINESHAFT_WORLDS.map(([label, seed, type]) => [label, seed, type, ...origin(seed, type)].join(":"));
const { stdout } = await exec("java", ["-cp", cp, "MineshaftWorldProbe", ...specs], { maxBuffer: 1 << 30 });
const rows = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
const config = rows.shift(), records = rows;
assert.equal(config.kind, "config");
assert.equal(records.length, MINESHAFT_WORLDS.length);
for (const r of records) {
  assert.equal(r.kind, "world");
  assert.equal(r.inputs.length, 100);
  assert.equal(r.populated.length, 81);
  assert.equal(r.areaSha1.length, 64);
  assert.ok(r.chunks.some((c) => c.writeCount > 0), r.label);
}
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
  method: "Per seed, chunks origin-1..origin+8 on each axis load in x-outer, z-inner order: unchanged ChunkProviderGenerate.provideChunk (terrain, biome surface, MapGenCaves, MapGenRavine, Chunk construction, skylight map; mapFeatures off), then unchanged MapGenMineshaft start search (MapGenBase.func_151539_a), then Chunk.populateChunk's four checks (copied), whose populate step is ChunkProviderGenerate.populate's reseed and the unchanged MapGenStructure.generateStructuresInChunk with BlockFalling.fallInstantly. No other structure or population feature runs. World: SpringProbe's double over real Chunk storage with real World.setBlock/notifications and Block callbacks (torch, rail, mob spawner tile entities); isBlockNormalCubeDefault over loaded chunks; World.rand seeded 0; MapGenStructureData stubbed; HashMap<Long,StructureStart> iteration on the listed JVM. Inputs and areaSha1: SHA-1 of little-endian int32 id|meta<<12 per (x,z,y) per chunk, inputs right after load, areaSha1 for the 64 live chunks after all 81 populate calls. Per populate call with writes, carts or a true result: SpringProbe's ordered call and write hashes, EntityMinecartChest spawns [x,y,z,slots] in creation order, and the Random's next long. Spawners: the loaded tile-entity list's valid TileEntityMobSpawner entries. Pending: scheduled ticks left; drops: EntityItem [x,y,z,item,count,damage,pickupDelay].",
  config, records,
};
const text = JSON.stringify(reference) + "\n";
assert.ok(text.length < 2_000_000);
await writeFile(path.join(root, "../public/research/mineshaft-world-reference.json"), text);
console.log("Original live mineshaft worlds:", records.map((r) => `${r.label} origin ${r.origin} chunks ${r.chunks.length} spawners ${r.spawners.length} carts ${r.chunks.reduce((n, c) => n + c.carts.length, 0)}`).join("; "), "bytes:", text.length);
