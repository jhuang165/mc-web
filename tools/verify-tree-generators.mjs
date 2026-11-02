// Records unchanged 1.7.10 worldgen tree generators, big mushrooms and biome tree pickers; see TreeGeneratorProbe.java. Requires the pinned client JAR, a JDK and the usual probe libraries.
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
  out = path.join(research, "tree-generator-probe");
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
  path.join(root, "probes/TreeGeneratorProbe.java"),
]);
const { stdout } = await exec("java", ["-cp", cp, "TreeGeneratorProbe"], { maxBuffer: 1 << 28 });
const rows = stdout.trim().split("\n").filter(l => l.startsWith("{")).map(JSON.parse);
const config = rows.shift(), records = rows.filter(r => r.kind === "tree"), pickers = rows.filter(r => r.kind === "picker");
assert.equal(config.kind, "config");
// grass, dirt, farmland, mycelium, water, flowing water, log, log2, leaves, leaves2, sapling, vine, cocoa, brown mushroom block, tall grass
assert.deepEqual(config.blocks, [2, 3, 60, 110, 9, 8, 17, 162, 18, 161, 6, 106, 127, 99, 31]);
assert.equal(config.biomes.length, 61);
assert.equal(pickers.length, 61 * 4);
assert.equal(records.length, 28 * 24);
const counts = {}, placed = {};
for (const r of records) {
  const c = r.generator[0];
  counts[c] = (counts[c] ?? 0) + r.results.length;
  placed[c] = (placed[c] ?? 0) + r.results.filter(([ok]) => ok).length;
  assert.match(r.callSha1, /^[a-f0-9]{40}$/);
}
for (const c of Object.keys(counts)) {
  assert.ok(placed[c] >= 8, `placements for ${c}: ${placed[c]}`);
  // WorldGenShrub always reports success.
  if (c !== "arp") assert.ok(counts[c] - placed[c] >= 4, `rejections for ${c}: ${counts[c] - placed[c]}`);
}
const {stderr:version} = await exec("java",["-XshowSettings:properties","-version"]);
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const featureClasses = ["arn","arc","asq","ard","are","aso","asf","asn","asb","arz","asa","arp","ask","asi","aru","asp"];
const names = [...new Set([...featureClasses, ...config.biomes.map(b => b[2]), "ahu", "ahb", "aji", "ajn", "awt", "p", "qh"])].sort();
const classesUsed = Object.fromEntries(await Promise.all(names.map(async c => [c, {
  name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], {encoding:"buffer", maxBuffer: 1 << 24})).stdout).digest("hex")
}])));
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  symbols: srgText.split("\n").filter(l => new RegExp(`^(MD|FD): (${featureClasses.join("|")})/`).test(l)),
  jvm: String(version).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "Unchanged WorldGenTrees (oak, jungle with vines/cocoa, fixed-meta variants), WorldGenBigTree (with and without setScale(1,1,1)), WorldGenForest (birch, tall birch), WorldGenSwamp, WorldGenTaiga1, WorldGenTaiga2, WorldGenMegaJungle, WorldGenMegaPineTree (spruce and pine), WorldGenShrub, WorldGenSavannaTree, WorldGenCanopyTree and WorldGenBigMushroom (random, brown and red), each constructed with notify false and, where a constructor allows, true. Each record runs one fresh generator over one to three origins with one World double and one Random, as a biome's shared instance would be reused; after a successful generate the record optionally calls func_150524_b (MegaPineTree podzol) as BiomeDecorator does. World is a block-access double over a synthetic fixture (mirrored in the test): 5x5 steps at y 62..63 over dirt/stone with per-column surfaces (grass, dirt, farmland, mycelium, sand, stone) and sparse obstacles (log, log2, leaves, leaves2, vine, sapling, stone, tall grass); a swamp floor under water to y 61 at 1000<=x<2000; a y=250 grass plateau at x>=2000. Origins and seeds come from a fixture-selection procedure, not native decorator placement. Ordered call hash encodes little-endian int32: 0 block read (isAirBlock appears as its read), 1 setter x/y/z/id/meta/flags; writes are hashed as x/y/z/id/meta/flags with per-id/meta counts, per-origin result and write count, and the next Random long. Picker records call each registered biome's func_150567_a six times and func_150569_a three times on one Random, recording the returned generator's constructor arguments and whether it is a field of a registered biome (by slot) or a static field. No native Chunk storage, notifications, sapling growth, decorator driver or biome decorate overrides.",
  config, records, pickers,
};
await writeFile(path.join(root,"../public/research/tree-generators-reference.json"), JSON.stringify(reference)+"\n");
console.log("Original tree generator records:", records.length, "generates:", counts, "placed:", placed, "pickers:", pickers.length);
