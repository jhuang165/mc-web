// Records the unchanged 1.7.10 populate tail (BiomeGenBase.decorate, SpawnerAnimals.performWorldGenSpawning and the freeze/snow pass) over native terrain, caves and ravines in real Chunk storage; see PopulationTailProbe.java. Requires the pinned client JAR, a JDK and the usual probe libraries.
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
  out = path.join(research, "population-tail-probe");
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
]);
const { stdout, stderr } = await exec("java", ["-Xss16m", "-cp", cp, "PopulationTailProbe", ...process.argv.slice(2)], { maxBuffer: 1 << 28 });
const only = process.argv[2];
if (only) { process.stdout.write(stdout); process.stderr.write(stderr); process.exit(0); }
if (process.env.PROBE_DUMP) await writeFile(process.env.PROBE_DUMP, stdout);
// SpawnerAnimals catches and prints entity construction failures; a missing library must not pass as a skipped spawn.
assert.ok(!/Exception/.test(stderr), stderr.slice(0, 2000));
const rows = stdout.trim().split("\n").filter(l => l.startsWith("{")).map(JSON.parse);
const config = rows.shift(), regions = rows.filter(r => r.kind === "region"), records = rows.filter(r => r.kind === "record");
assert.equal(config.kind, "config");
assert.deepEqual(config.blocks, [79, 78, 9, 8, 174, 7]);
assert.equal(regions.length, 12);
assert.equal(records.length, 144);
const entities = records.flatMap((r) => r.entities), kinds = {};
for (const e of entities) kinds[e[0]] = (kinds[e[0]] || 0) + 1;
console.log("entities", kinds);
for (const name of ["Pig", "Sheep", "Chicken", "Cow", "EntityHorse", "Wolf"]) assert.ok(kinds[name], `${name} spawns`);
assert.ok(entities.some((e) => e[0] === "Sheep" && e[6] !== 0), "coloured sheep");
for (const mode of ["snow", "tail"]) assert.ok(records.some((r) => r.mode === mode && r.writeCount), `${mode} writes`);
assert.ok(records.filter((r) => r.mode === "spawn").every((r) => !r.writeCount), "spawning only reads");
const {stderr:version} = await exec("java",["-XshowSettings:properties","-version"]);
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const used = ["ahu", "aho", "ahx", "qv", "qw", "sx", "aqz", "aqw", "aqs", "aib", "ahb", "apx", "aji", "ajn", "ann", "awt", "wg", "wh", "wi", "wm", "wo", "wp", "wv", "xk"];
const names = [...new Set(used)].sort();
const classesUsed = Object.fromEntries(await Promise.all(names.map(async c => [c, {
  name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], {encoding:"buffer", maxBuffer: 1 << 24})).stdout).digest("hex")
}])));
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  symbols: srgText.split("\n").filter(l => /^MD: aho\/a \(Lahb;Lahu;IIIILjava\/util\/Random;\)V|^MD: aho\/a \(Lsx;Lahb;III\)Z|^MD: ahb\/(h \(II\)I|r \(III\)Z|d \(IIIZ\)Z|e \(IIIZ\)Z|i \(II\)I) |^MD: apx\/d \(II\)I|^MD: ann\/c \(Lahb;III\)Z|^MD: wp\/a \(Ljava\/util\/Random;\)I/.test(l)),
  jvm: String(version).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "The end of an unchanged ChunkProviderGenerate.populate (aqz.a): BiomeGenBase.decorate, SpawnerAnimals.performWorldGenSpawning (aho.a(World, BiomeGenBase, x+8, z+8, 16, 16, Random)) and populate's inline freeze/snow loop (getPrecipitationHeight, isBlockFreezable then ice, func_147478_e then snow layer, flag 2). The world is the Chunk-backed World double of biome-overrides-reference.json over the same ten 4x4-chunk regions of native ChunkProviderGenerate terrain, MapGenCaves and MapGenRavine, with a synthetic saved block light (floorMod(7x+3y+13z+lightBase, 14), call kind 6) and spawnEntityInWorld capturing animals. Each region has 12 records on a fresh world: six spawn records (one to four inner chunks, the natural biome or the next slot of a shuffled cycle of every overworld slot, performWorldGenSpawning 20 times per chunk on one chained Random), two snow records (the loop over all four inner chunks in shuffled order) and four tail records (one to four inner chunks with the population Random, the natural biome at x+16, z+16: decorate, spawning, then the snow loop). Records list each spawned animal (class, position, yaw and pitch float bits, sheep fleece) and hash the ordered calls, successful writes, pending ticks and final chunk storage with drops, sounds, aux and the Random longs. The entities' own Random (onSpawnWithEgg follow-range bonus, horse type and variant) is per-entity and nondeterministic, so it is not recorded. Not a WorldServer: no lakes, dungeons or earlier population stages, light engine, entity ticking or later block ticks.",
  config, regions, records,
};
await writeFile(path.join(root,"../public/research/population-tail-reference.json"), JSON.stringify(reference)+"\n");
console.log("Original population tail records:", records.length, "entities:", entities.length, "writes:", records.reduce((n, r) => n + r.writeCount, 0));
