// Records unchanged 1.7.10 WorldGenLakes; see LakeProbe.java. Requires the pinned client JAR, a JDK and the usual probe libraries.
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
  out = path.join(research, "lake-probe");
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
  path.join(root, "probes/PopulationProbe.java"),
  path.join(root, "probes/LakeProbe.java"),
]);
const { stdout } = await exec("java", ["-cp", cp, "LakeProbe"], { maxBuffer: 1 << 28 });
const rows = stdout.trim().split("\n").filter(l => l.startsWith("{")).map(JSON.parse);
const {materials, materialClasses} = rows.shift(), records = rows;
assert.equal(records.length, 516);
assert.equal(records.filter(r => r.result).length, 234);
assert.equal(records.filter(r => r.fixture === "natural").length, 12);
assert.equal(materials.length, 256);
for (const r of records) {
  assert.match(r.callSha1, /^[a-f0-9]{40}$/);
  assert.ok(r.callCount >= 0 && Number.isInteger(r.callCount));
  assert.ok(r.result || r.writes.length === 0);
  for (const [x,y,z,id,meta,flags] of r.writes) {
    assert.ok(x >= -30000000 && x < 30000000 && z >= -30000000 && z < 30000000 && y >= 0 && y < 256);
    assert.ok([0,1,2,8,9,10,11,79,110].includes(id));
    assert.equal(meta,0); assert.equal(flags,2);
  }
}
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const terrainReference = JSON.parse(await readFile(path.join(root,"../public/research/carver-reference.json"),"utf8"));
const names = [...new Set([...Object.keys(terrainReference.classes), ...materialClasses, "arx", "arn", "ahb", "aji", "ajn", "awt", "ahn", "ahu"])];
const classesUsed = Object.fromEntries(await Promise.all(names.map(async c => [c, {
  name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], {encoding:"buffer"})).stdout).digest("hex")
}])));
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  symbols: srgText.split("\n").filter(l => /^(MD|FD): (arx|ahb|awt|ahu)\//.test(l)),
  method: "Unchanged WorldGenLakes.generate with original block/material registry. World double supplies bounded block access, isAirBlock, explicit skylight/biome-top/freeze fixtures, synthetic block arrangements and 12 cases across 48 native terrain/surface/cave/ravine chunks and records ordered writes (including same-block calls). Ordered calls are hashed as little-endian int32: type 0 block read, 1 setter with id/meta/flags, 2 sky light, 3 biome, 4 freeze; each followed by coordinates (and setter payload). Material predicates execute unchanged. Freeze/light/biome services are fixtures, not native climate/light acceptance. Natural lake RNG starts at isolated seed 1234; not claimed to be post-provider gates. No native Chunk storage, notifications, full populate, dungeons or live-world integration.",
  materials, records,
};
await writeFile(path.join(root,"../public/research/lake-reference.json"), JSON.stringify(reference)+"\n");
console.log("Original lake records:",records.length,"accepted:",records.filter(r=>r.result).length);
