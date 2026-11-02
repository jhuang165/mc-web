// Records unchanged 1.7.10 ChunkProviderGenerate.populate up to biome decoration; see PopulationStageProbe.java. Requires the pinned client JAR, a JDK and the usual probe libraries.
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
  out = path.join(research, "population-stage-probe");
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
  path.join(root, "probes/DungeonProbe.java"),
  path.join(root, "probes/PopulationStageProbe.java"),
]);
const { stdout } = await exec("java", ["-cp", cp, "PopulationStageProbe"], { maxBuffer: 1 << 28 });
const rows = stdout.trim().split("\n").filter(l => l.startsWith("{")).map(JSON.parse);
const config = rows.shift(), records = rows;
assert.equal(config.kind,"config");
assert.deepEqual([config.water,config.lava,config.desert,config.desertHills],[9,11,[2,2],[17,17]]);
assert.ok(records.every(r=>r.kind==="stage" && r.inputs.length===4));
const modes = Object.fromEntries(["none","stubs","village"].map(m=>[m,records.filter(r=>r.mode===m).length]));
assert.equal(modes.stubs,9); assert.equal(modes.village,9);
const has = (f) => records.some(f), ids = (r,id) => r.writeIds.find(([i])=>i===id)?.[1] ?? 0;
assert.ok(records.reduce((n,r)=>n+r.tiles.filter(t=>t[1]==="spawner").length,0)>=3,"accepted dungeons");
assert.ok(has(r=>ids(r,9)>0) && has(r=>ids(r,11)>0),"accepted water and lava lakes");
assert.ok(has(r=>r.draws[0]?.[0]===4 && r.draws[0][1]===0 && ids(r,9)===0),"rejected water lake");
assert.ok(has(r=>r.biome[0]===2) && has(r=>r.biome[0]===17),"desert gates");
for (const r of records) {
  assert.match(r.callSha1,/^[a-f0-9]{40}$/);
  const desert = r.biome[0]===2 || r.biome[0]===17, village = r.mode==="village";
  assert.equal(r.draws[0][0], desert || village ? (village ? 16 : 8) : 4, JSON.stringify(r.chunk));
  assert.deepEqual(r.structureCalls, r.mode==="none" ? [] : ["mineshaft","village","stronghold","scattered"].map(n=>`${n} ${r.chunk[0]} ${r.chunk[1]}`));
}
const {stderr:version} = await exec("java",["-XshowSettings:properties","-version"]);
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const terrainReference = JSON.parse(await readFile(path.join(root,"../public/research/carver-reference.json"),"utf8"));
const names = [...new Set([...Object.keys(terrainReference.classes), ...config.stopClasses, "aqz", "arx", "asd", "aia", "ahb", "aji", "ajn", "akx", "aow", "aor", "apj", "asw", "avn", "aug", "atx", "ave", "afv", "aft", "qx", "ade", "add"])].sort();
const classesUsed = Object.fromEntries(await Promise.all(names.map(async c => [c, {
  name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], {encoding:"buffer", maxBuffer: 1 << 24})).stdout).digest("hex")
}])));
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  symbols: srgText.split("\n").filter(l => /^(MD|FD): aqz\//.test(l)),
  jvm: String(version).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "Unchanged ChunkProviderGenerate.populate executed from its first line; the provider Random is a subclass that stops at the first draw (and World calls stop likewise) whose stack holds any BiomeGenBase or BiomeDecorator class, i.e. at biome.decorate, after the water/lava lake gates and eight dungeon attempts. World is a double over native terrain/surface/cave/ravine chunks (four per record, input hashes retained) with real WorldChunkManager biomes and explicit fixtures: sky light floorMod(31x+7y+17z,5)==0 ? 0 : 15, isBlockFreezable floorMod(7x+13z,11)==0. Map-feature modes: none (mapFeaturesEnabled false), stubs (enabled; mineshaft/village/stronghold/scattered stand-ins log their call and draw nothing), village (village reports a generated structure). Ordered call hash encodes little-endian int32: 0 block read, 1 setter x/y/z/id/meta/flags, 2 sky light, 3 biome lookup, 4 freeze test, 5 tile lookup; isAir and setBlockToAir appear as their block read and flag-3 setter. Retains the provider's own nextInt [bound,value] draws, write count/hash/ID histogram, final chest and spawner tiles and the next Random long at the decorator's input. Records are chunks -1..2 per seed, three stub/village chunks, the nearest desert and desert-hills chunks, and searched chunks for at least three accepted dungeons in total, accepted lava lake and the y>=63 lava draw. Real structure generation, decoration, animals, snow/ice, native Chunk storage/lighting/notifications and runtime placement are not executed.",
  config, records,
};
await writeFile(path.join(root,"../public/research/population-stage-reference.json"), JSON.stringify(reference)+"\n");
console.log("Original population-stage records:",records.length,modes);
