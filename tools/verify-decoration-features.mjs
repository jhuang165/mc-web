// Records unchanged 1.7.10 BiomeDecorator counts and simple decoration features; see DecorationFeatureProbe.java. Requires the pinned client JAR, a JDK and the usual probe libraries.
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
  out = path.join(research, "decoration-probe");
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
]);
const { stdout } = await exec("java", ["-cp", cp, "DecorationFeatureProbe"], { maxBuffer: 1 << 28 });
const rows = stdout.trim().split("\n").filter(l => l.startsWith("{")).map(JSON.parse);
const config = rows.shift(), records = rows;
assert.equal(config.kind,"config");
// grass, dirt, sand, gravel, water, farmland, cactus, clay, reeds, pumpkin, mycelium, lily pad, stained/hardened clay, flowers, mushrooms, tall grass, dead bush
assert.deepEqual(config.blocks,[2,3,12,13,9,60,81,82,83,86,110,111,159,172,37,38,39,40,31,32]);
assert.equal(config.decorators.length,61);
const counts = {};
for (const r of records) counts[r.feature] = (counts[r.feature] ?? 0) + 1;
assert.equal(Object.keys(counts).length,13);
assert.ok(Object.values(counts).every(n=>n===48));
for (const r of records) {
  assert.match(r.callSha1,/^[a-f0-9]{40}$/);
  for (const [, y, , , , flags] of r.writes) { assert.ok(y>=0 && y<256); assert.equal(flags,2); }
}
const placed = (f) => records.filter(r=>r.feature===f && r.writes.length>0).length;
for (const f of Object.keys(counts)) assert.ok(placed(f)>=5, `placements for ${f}: ${placed(f)}`);
assert.ok(records.some(r=>["clay","sand","gravel"].includes(r.feature) && !r.result),"rejected disc");
const {stderr:version} = await exec("java",["-XshowSettings:properties","-version"]);
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const featureClasses = ["arj","asj","aro","asp","ark","aiz","ash","asg","arh"];
const names = [...new Set([...featureClasses, ...config.decorators.flatMap(d=>[d[2],d[3]]), "arn", "aia", "ahu", "ahb", "ahl", "aji", "ajn", "awt", "aqo", "aqq", "ajr", "alc", "amc", "anz", "akh", "aoj", "ane", "ajt", "amw", "akk"])].sort();
const classesUsed = Object.fromEntries(await Promise.all(names.map(async c => [c, {
  name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], {encoding:"buffer", maxBuffer: 1 << 24})).stdout).digest("hex")
}])));
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  symbols: srgText.split("\n").filter(l => new RegExp(`^(MD|FD): (${featureClasses.join("|")}|aia)/`).test(l)),
  jvm: String(version).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "Unchanged BiomeDecorator counts read from every registered BiomeGenBase after its constructor (fields in genDecorations order: sandPerChunk2/sand disc, clayPerChunk, sandPerChunk/gravel disc, trees, big mushrooms, flowers, grass, dead bushes, lily pads, mushrooms, reeds, cacti, generateLakes as 0/1). Unchanged WorldGenClay(4), WorldGenSand(sand,7)/(gravel,6), WorldGenFlowers (yellow/red variants via func_150550_a, brown/red mushroom), WorldGenTallGrass(tallgrass,1/2), WorldGenDeadBush, WorldGenWaterlily, WorldGenReed, WorldGenPumpkin and WorldGenCactus with the real Block canBlockStay/canPlaceBlockAt rules and static World.doesBlockHaveSolidTopSurface. World is a block-access double over a synthetic fixture (mirrored in the test): 3x3 plateaus at y 62..64, per-column surface/pond/plant/leaf kinds, an all-air void at 1000<=x<2000 and a y=254 plateau at x>=2000; full-block light floorMod(5x+11y+3z,16); WorldProviderSurface allocated without constructor with hasNoSky set per record. Origins and seeds come from a fixture-selection procedure (searching for ponds and pond shores), not native decorator placement; isolated feature RNG inputs are not post-provider streams. Ordered call hash encodes little-endian int32: 0 block read (isAirBlock appears as its read), 1 setter x/y/z/id/meta/flags, 2 metadata read, 3 full-block light. Every write, the result and next Random long are retained. Block properties per registered ID: air/water/leaves material identity, Material.isSolid, isReplaceable, Block.isOpaqueCube and the metadata mask for which doesBlockHaveSolidTopSurface holds. No native Chunk storage, heightmap, lighting, block notifications/onBlockAdded, trees, big mushrooms, springs, decorator driver or biome decorate overrides.",
  config, records,
};
await writeFile(path.join(root,"../public/research/decoration-features-reference.json"), JSON.stringify(reference)+"\n");
console.log("Original decoration feature records:",records.length,counts,"placements:",Object.fromEntries(Object.keys(counts).map(f=>[f,placed(f)])));
