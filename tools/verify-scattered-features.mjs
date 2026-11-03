// Records unchanged 1.7.10 MapGenScatteredFeature, desert/jungle pyramids and swamp hut; see ScatteredFeatureProbe.java. Requires the pinned client JAR, a JDK and the usual probe libraries.
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
  out = path.join(research, "scattered-feature-probe");
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
  path.join(root, "probes/ScatteredFeatureProbe.java"),
]);
const { stdout } = await exec("java", ["-cp", cp, "ScatteredFeatureProbe"], { maxBuffer: 1 << 30 });
if (process.env.SF_RAW) await writeFile(process.env.SF_RAW, stdout);
const rows = stdout.trim().split("\n").filter(l => l.startsWith("{")).map(JSON.parse);
const config = rows.shift(), records = rows;
const counts = Object.fromEntries([...new Set(records.map(r=>r.kind))].map(k=>[k,records.filter(r=>r.kind===k).length]));
assert.equal(config.kind,"config");
assert.equal(config.materials.length,256);
assert.deepEqual(config.directionX,[0,-1,0,1]);
assert.deepEqual(config.directionZ,[1,0,-1,0]);
assert.ok(counts.startChoice===1 && counts.starts===4 && counts.populate>0 && counts.pieces>0);
for (const r of records.filter(r=>r.kind==="populate")) {
  assert.ok(r.chunks.length>0);
  for (const c of r.chunks) { assert.match(c.writesSha1,/^[a-f0-9]{40}$/); assert.match(c.callsSha1,/^[a-f0-9]{40}$/); }
}
const {stderr:version} = await exec("java",["-XshowSettings:properties","-version"]);
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const names = ["aqx","ave","atx","aty","aue","aub","auc","aud","auf","avm","avk","asv","qx","yp","ahx","aow","apb","alv","ajn","aji","awt","ade","add","adb"];
const classesUsed = Object.fromEntries(await Promise.all(names.map(async c => [c, {
  name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], {encoding:"buffer"})).stdout).digest("hex")
}])));
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  symbols: srgText.split("\n").filter(l => /^CL: (atx|aty|aue|aub|auc|aud|auf|ave|avm|avk|asv|qx) /.test(l)),
  jvm: String(version).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "Unchanged MapGenBase seeding, MapGenStructure recursiveGenerate/generateStructuresInChunk and its HashMap<Long,StructureStart> (JVM-dependent iteration order), MapGenScatteredFeature (including the temple candidate predicate and func_143030_a), StructureScatteredFeatureStart biome choice, ComponentScatteredFeaturePieces Feature/DesertPyramid/JunglePyramid/Stones/SwampHut, StructureComponent helpers, StructureBoundingBox, WeightedRandomChestContent, the level-30 enchanted book, the real tile classes TileEntityChest/TileEntityDispenser and the real EntityWitch. World double: explicit block access over synthetic fixtures (air, stone, water, hills with trees) with World.func_72825_h as native; a forced biome stands in for the biome manager in start/populate records; grid start records use the real WorldChunkManager. MapGenStructureData load returns null and save is ignored. Ordered service hash encodes little-endian int32: 0 block read, 1 isAir followed by block read, 2 setter x/y/z/id/meta/flags, 4 tile lookup, 5 entity spawn floor(x/y/z), 6 func_72825_h. Write hash: x/y/z/id/meta/flags per accepted setter. No native Chunk storage, notifications, lighting, entity ticking, NBT round trip, redstone power simulation, flower pot tile entity or live population integration.",
  config, records,
};
const text = JSON.stringify(reference)+"\n";
await writeFile(path.join(root,"../public/research/scattered-feature-reference.json"), text);
console.log("Original scattered feature records:",records.length,"kinds:",counts,"bytes:",text.length);
