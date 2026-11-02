// Records the unchanged 1.7.10 ChunkProviderGenerate.populate chain (lakes, dungeons, decorate, worldgen animals and the freeze/snow pass) over native terrain, caves and ravines in real Chunk storage; see PopulateChainProbe.java. Requires the pinned client JAR, a JDK and the usual probe libraries.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const exec = promisify(execFile),
  root = path.dirname(fileURLToPath(import.meta.url)),
  exists = (p) =>
    access(p).then(
      () => true,
      () => false,
    );
const researchDirs = [
  process.env.MC_RESEARCH,
  path.join(root, "research"),
  path.join(root, "../../tools/research"),
].filter(Boolean);
let research;
for (const dir of researchDirs)
  if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) {
    research = dir;
    break;
  }
if (!research)
  throw new Error(
    "Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.",
  );
const jar = path.join(research, "minecraft-1.7.10.jar"),
  out = path.join(research, "populate-chain-probe");
assert.equal(
  createHash("sha1")
    .update(await readFile(jar))
    .digest("hex"),
  "e80d9b3bf5085002218d4be59e668bac718abbc6",
);
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || "")
    .split(path.delimiter)
    .filter(Boolean))
    if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [
    path.join(os.homedir(), "Library/Application Support/minecraft/libraries"),
    path.join(os.homedir(), ".minecraft/libraries"),
    path.join(os.homedir(), ".gradle/caches"),
  ]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec(
      "find",
      [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"],
      { maxBuffer: 1 << 24 },
    );
    const hit = stdout.split("\n").filter(Boolean).sort()[0];
    if (hit) return hit;
  }
  throw new Error(
    `Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`,
  );
}
const libs = await Promise.all(
  ["guava-", "log4j-api-", "commons-lang3-", "commons-io-", "authlib-", "netty-"].map(library),
);
const classes = path.join(out, "classes");
await rm(classes, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
// EntityHorse names itself through StringTranslate, which reads en_US.lang from the classpath.
await exec("unzip", ["-q", "-o", jar, "*.class", "assets/minecraft/lang/en_US.lang", "-d", classes], {
  maxBuffer: 1 << 24,
});
const probe = path.join(out, "probe");
await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", [
  "-nowarn",
  "-cp",
  cp,
  "-d",
  probe,
  path.join(root, "probes/TerrainProbe.java"),
  path.join(root, "probes/DecorationFeatureProbe.java"),
  path.join(root, "probes/SpringProbe.java"),
  path.join(root, "probes/BiomeDecoratorProbe.java"),
  path.join(root, "probes/BiomeOverrideProbe.java"),
  path.join(root, "probes/PopulationTailProbe.java"),
  path.join(root, "probes/DungeonProbe.java"),
  path.join(root, "probes/PopulateChainProbe.java"),
]);
const { stdout, stderr } = await exec("java", ["-Xss16m", "-cp", cp, "PopulateChainProbe", ...process.argv.slice(2)], { maxBuffer: 1 << 28 });
const only = process.argv[2];
if (only) { process.stdout.write(stdout); process.stderr.write(stderr); process.exit(0); }
if (process.env.PROBE_DUMP) await writeFile(process.env.PROBE_DUMP, stdout);
// SpawnerAnimals and the dungeon spawner lookup print failures; a missing library must not pass as a skipped spawn.
// SpawnerAnimals catches and prints entity construction failures; a missing library must not pass as a skipped spawn.
assert.ok(!/Exception/.test(stderr), stderr.slice(0, 2000));
const rows = stdout.trim().split("\n").filter(l => l.startsWith("{")).map(JSON.parse);
const config = rows.shift(), regions = rows.filter(r => r.kind === "region"), records = rows.filter(r => r.kind === "record");
assert.equal(config.kind, "config");
assert.deepEqual(config.blocks, [54, 52, 9, 11, 110]);
assert.equal(regions.length, 17);
assert.equal(records.length, 34);
const tiles = records.flatMap((r) => r.tiles), entities = records.flatMap((r) => r.entities);
const chests = tiles.filter((t) => t[3] === "chest"), spawners = tiles.filter((t) => t[3] === "spawner");
console.log("chests", chests.length, "spawners", spawners.length, "entities", entities.length);
assert.ok(chests.length >= 20 && spawners.length >= 20, "dungeon tile entities");
assert.ok(chests.some((t) => t[4].some((s) => s && s[0] === 403)), "enchanted book");
for (const name of ["Skeleton", "Zombie", "Spider"]) assert.ok(spawners.some((t) => t[4] === name), `${name} spawner`);
assert.ok(tiles.every((t) => t[5] === false), "valid tile entities");
assert.ok(records.every((r) => Array.isArray(r.removed) && !r.removed.length), "tile entities removed");
assert.ok(records.some((r) => r.tiles.some((t) => t[3] === "chest")) && records.some((r) => r.tiles.some((t) => t[3] === "spawner")), "removal covers chests and spawners");
assert.ok(entities.length > 0 && records.every((r) => r.writeCount), "animals and writes");
const {stderr:version} = await exec("java",["-XshowSettings:properties","-version"]);
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const used = ["aqz", "arx", "asd", "qx", "aow", "apj", "agq", "ajx", "ajc", "ama", "aor", "ahu", "aho", "aqw", "aqs", "aib", "ahb", "apx", "aji", "ajn", "awt", "xk"];
const names = [...new Set(used)].sort();
const classesUsed = Object.fromEntries(await Promise.all(names.map(async c => [c, {
  name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], {encoding:"buffer", maxBuffer: 1 << 24})).stdout).digest("hex")
}])));
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  symbols: srgText.split("\n").filter(l => /^MD: aqz\/a \(Lapu;II\)V|^MD: apx\/(e \(III\)Laor;|a \(IIII\)Z|a \(IIILaji;I\)Z) |^MD: ahb\/(f \(IIILaji;\)V|o \(III\)Laor;|p \(III\)V) |^MD: ajx\/(e|b) \(Lahb;III\)V|^MD: aor\/(e|u) \(\)V/.test(l)),
  jvm: String(version).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "An unchanged ChunkProviderGenerate.populate (aqz.a(provider, x, z)) built with map features off, so no structures: the biome at (x+16, z+16) read before the population reseed, the water lake (not desert or desert hills, nextInt(4)), the lava lake (nextInt(8), y = nextInt(nextInt(248)+8), nextInt(10) at y >= 63), eight WorldGenDungeons attempts, BiomeGenBase.decorate, SpawnerAnimals.performWorldGenSpawning and the freeze/snow loop. The world is population-tail-reference.json's Chunk-backed World double (real World/Chunk code, real Block callbacks, emulated scheduling, no light engine) with a synthetic saved block light (floorMod(7x+3y+13z+lightBase, 14), call kind 6) and saved sky light (floorMod(3x+5y+7z+lightBase, 16), call kind 7). Each of 17 regions is a 6x6-chunk area of native ChunkProviderGenerate terrain, MapGenCaves and MapGenRavine: four of the population-tail regions shifted out by one chunk and thirteen picked around chunks whose dungeons succeed on pre-population terrain. Each region has two records on a fresh world and one provider: all sixteen inner chunks in shuffled order, then a shuffled subset of four to twelve; after either, every tile entity is removed (chests emptied slot by slot through setInventorySlotContents and setBlockToAir, spawners overwritten with stone at flag 2) and the empty listing recorded. Records give each step's biome ID, animal count and the provider Random's next long, every spawned animal, the chest (27 slots of [item, count, damage, stored enchantments]) and mob spawner (entity name) tile entities left in the chunk maps, and hash the ordered calls, writes, pending ticks and final chunk storage with drops, sounds, aux and the world Random. Not a WorldServer: no structures, light engine, entity ticking, tile-entity ticking or later block ticks.",
  config, regions, records,
};
await writeFile(path.join(root,"../public/research/populate-chain-reference.json"), JSON.stringify(reference)+"\n");
console.log("Original populate chain records:", records.length, "steps:", records.reduce((n, r) => n + r.steps.length, 0), "writes:", records.reduce((n, r) => n + r.writeCount, 0));
