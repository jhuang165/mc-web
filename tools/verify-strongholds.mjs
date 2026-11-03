// Records unchanged 1.7.10 MapGenStronghold/StructureStrongholdPieces and the structure framework; see StrongholdProbe.java. Requires the pinned client JAR, a JDK and the usual probe libraries.
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
  out = path.join(research, "stronghold-probe");
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
  path.join(root, "probes/StrongholdProbe.java"),
]);
const { stdout } = await exec("java", ["-cp", cp, "StrongholdProbe"], { maxBuffer: 1 << 30 });
const rows = stdout.trim().split("\n").filter(l => l.startsWith("{")).map(JSON.parse);
const config = rows.shift(), records = rows;
const counts = Object.fromEntries([...new Set(records.map(r=>r.kind))].map(k=>[k,records.filter(r=>r.kind===k).length]));
assert.equal(config.kind,"config");
assert.equal(config.weights.length,11);
assert.deepEqual(config.loot.chestCorridor.length,18);
assert.deepEqual(config.loot.library.length,4);
assert.deepEqual(config.loot.roomCrossing.length,7);
assert.deepEqual(config.strongholdSettings,{distance:32,spread:3,count:3});
assert.deepEqual(counts,{doors:1,stones:2,positions:16,starts:16,populate:13});
console.error("record kinds",counts);
for (const r of records.filter(r=>r.kind==="populate")) {
  assert.ok(r.chunks.length>0);
  for (const c of r.chunks) { assert.match(c.writesSha1,/^[a-f0-9]{40}$/); assert.match(c.callsSha1,/^[a-f0-9]{40}$/); }
}
for (const r of records.filter(r=>r.kind==="starts")) assert.ok(r.starts.length>0 && r.starts.every(s=>s.pieceCount>0) && r.attempts.length===r.starts.length);
const {stderr:version} = await exec("java",["-XshowSettings:properties","-version"]);
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const names = ["aug","auh","aui","aur","auj","auk","auw","avc","avd","aul","aum","aun","auo","aup","auq","aus","aut","auu","auv","auy","auz","ava","avb","aqx","ave","avm","avk","avl","asv","avi","qx","apj","aow","aji","ajn","awt","aib","agu","agt","ade","afv","adb"];
const classesUsed = Object.fromEntries(await Promise.all(names.map(async c => [c, {
  name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], {encoding:"buffer"})).stdout).digest("hex")
}])));
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  symbols: srgText.split("\n").filter(l => /^CL: (aug|auh|aui|aur|auw|avc|avd|aum|aun|auo|aup|auq|aus|aut|auu|auv|auy|auz|ava|avb|aqx|ave|avm|avk|avl|asv|qx) /.test(l)),
  jvm: String(version).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "Unchanged MapGenBase.func_151539_a seeding, MapGenStructure recursiveGenerate/generateStructuresInChunk and its HashMap<Long,StructureStart> (JVM-dependent iteration order, recorded on the listed JVM), MapGenStronghold (native position search, getStructureStart regenerate-until-portal-room loop), MapGenStronghold.Start, StructureStrongholdPieces (PieceWeight table/limits, getNextComponent, Stones selector, door helpers) and every stronghold piece with WeightedRandomChestContent and the level-30 enchanted book. The probe re-runs the regenerate loop independently from the recursiveGenerate seeding to count attempts and record the Random state after the start. World double: explicit block access over synthetic fixtures (stone, pockets, water, air) or native terrain/surface/cave/ravine chunks (input hashes retained); MapGenStructureData load returns null and save is ignored. Population Random is ChunkProviderGenerate's populate seed, used directly (structures are its first consumer). Ordered service hash encodes little-endian int32: 0 block read, 1 isAir followed by block read, 2 setter x/y/z/id/meta/flags, 4 tile lookup. Write hash: x/y/z/id/meta/flags per accepted setter. Piece hashes: SHA-1 of the JSON piece list text. Pass A uses the unchanged generateStructuresInChunk; pass B unrolls it per addComponentParts call (start index, piece index in the current list, kept flag, write count, 12 hex of the call write SHA-1) and the probe asserts both passes agree. No native Chunk storage, notifications, lighting, NBT round trip or live population integration.",
  config, records,
};
const text = JSON.stringify(reference)+"\n";
await writeFile(path.join(root,"../public/research/stronghold-reference.json"), text);
console.log("Original stronghold records:",records.length,"kinds:",counts,"bytes:",text.length);
