// Records the unchanged 1.7.10 biome decorate overrides and their generators over native terrain, caves and ravines in real Chunk storage; see BiomeOverrideProbe.java. Requires the pinned client JAR, a JDK and the usual probe libraries.
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
  out = path.join(research, "biome-override-probe");
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
  ["guava-", "log4j-api-", "commons-lang3-", "authlib-", "netty-"].map(library),
);
const classes = path.join(out, "classes");
await rm(classes, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], {
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
]);
const { stdout, stderr } = await exec("java", ["-Xss16m", "-cp", cp, "BiomeOverrideProbe", ...process.argv.slice(2)], { maxBuffer: 1 << 28 });
const only = process.argv[2];
if (only) { process.stdout.write(stdout); process.stderr.write(stderr); process.exit(0); }
const rows = stdout.trim().split("\n").filter(l => l.startsWith("{")).map(JSON.parse);
const config = rows.shift(), regions = rows.filter(r => r.kind === "region"), features = rows.filter(r => r.kind === "feature"), records = rows.filter(r => r.kind === "decorate");
assert.equal(config.kind, "config");
assert.deepEqual(config.blocks, [175, 103, 106, 174, 129, 97, 48, 24, 44, 80, 79, 12, 8]);
assert.equal(regions.length, 10);
assert.equal(features.length, 130);
assert.equal(records.length, 80);
const slots = new Set(records.flatMap((r) => r.decorations.map((d) => d[2])));
assert.deepEqual([...slots].sort((a, b) => a - b), [...config.slots].sort((a, b) => a - b));
for (const kind of ["well", "spike", "path", "blob", "melon", "dp0", "dp1", "dp2", "dp3", "dp4", "dp5"])
  assert.ok(features.some((f) => f.feature === kind && f.results.includes(true) && f.writeCount), `${kind} places`);
// Broken double plants drop (sunflower, lilac, rose bush, peony) and clear their other half.
assert.ok(features.some((f) => f.feature === "dpbreak" && f.drops.length), "dpbreak drops");
const {stderr:version} = await exec("java",["-XshowSettings:properties","-version"]);
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const used = ["ahu", "aia", "aic", "aid", "aif", "aig", "aih", "aij", "aik", "ail", "ain", "aip", "ais", "ait", "aiw", "arm", "arl", "asc", "asr", "arw", "arv", "arf", "ase", "aru", "ako", "ajr", "aoh", "aly", "aqz", "aqw", "aqs", "aib", "ahb", "apx", "aji", "ajn", "xk", "mt"];
const names = [...new Set([...used, ...config.biomes.map((b) => b[1])])].sort();
const classesUsed = Object.fromEntries(await Promise.all(names.map(async c => [c, {
  name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], {encoding:"buffer", maxBuffer: 1 << 24})).stdout).digest("hex")
}])));
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  symbols: srgText.split("\n").filter(l => /^(MD|FD): (arm|arl|asc|asr|arw|arv|arf|ako)\//.test(l) || /^MD: (ahu|aic|aid|aif|aih|aij|aik|ail|ain|aip|ais|ait|aiw)\/a \(Lahb;Ljava\/util\/Random;II\)V/.test(l)),
  jvm: String(version).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "Unchanged BiomeGenBase.decorate (ahu.a(World, Random, int, int)) for every registry slot except the Nether (8) and End (9), so each biome class's override runs: desert wells (aic), extreme hills emerald ore and monster-egg veins (aid), forest double plants and the roofed-forest tree/big-mushroom grid (aif), mutated biomes on their base biome's decorator (ain/aig) or the base biome's decorate (aih), ice spikes and ice paths (aij), jungle melons and vines (aik), plains flower/grass counts, double grass and sunflowers (aip), savanna double grass (ais), taiga boulders and large ferns (aiw), then the base BiomeDecorator. The world is the Chunk-backed World double of springs/biome-decorator-reference.json over 4x4-chunk regions of native ChunkProviderGenerate terrain, MapGenCaves and MapGenRavine, ten regions whose inner 2x2 chunks share one natural biome (ice spikes, desert, mega taiga, jungle, sunflower plains, flower forest, roofed forest, extreme hills, savanna, mutated roofed forest). Each region has 13 feature records (WorldGenDesertWells at height+1; IceSpike, IcePath(4), BlockBlob(mossy cobblestone, 0), Melon, Vines and DoublePlant types 0-5 at the height map, six chained origins on one world and Random; then DoublePlant cycling types 0-5, where after each origin every bottom half in the surrounding 17x9x17 box in turn has its soil, its top or itself set to air with notification) and 8 decorate records (one to four inner chunks, each the natural biome or the next slot of a shuffled cycle, with the population Random). Biome objects persist across records in order (plains decorator counts, shared trees). Records hash the ordered calls, successful writes, pending ticks and final chunk storage and list drops, sounds and aux effects, with the Random longs. Not a WorldServer: no population stages outside decorate, light engine, entities or later ticks.",
  config, regions, features, records,
};
await writeFile(path.join(root,"../public/research/biome-overrides-reference.json"), JSON.stringify(reference)+"\n");
console.log("Original override records:", features.length, "features,", records.length, "decorate, decorations:", records.reduce((n, r) => n + r.decorations.length, 0), "slots:", slots.size);
