// Records unchanged 1.7.10 WorldGenDungeons; see DungeonProbe.java. Requires the pinned client JAR, a JDK and the usual probe libraries.
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
  out = path.join(research, "dungeon-probe");
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
]);
const { stdout } = await exec("java", ["-cp", cp, "DungeonProbe"], { maxBuffer: 1 << 28 });
const rows = stdout.trim().split("\n").filter(l => l.startsWith("{")).map(JSON.parse);
const config = rows.shift(), records = rows;
assert.equal(config.kind,"config");
assert.equal(config.enchantability,1);
assert.equal(config.loot.length,15);
assert.equal(config.enchantments.length,24);
assert.equal(config.materials.length,256);
assert.deepEqual(Object.fromEntries(["candidates","book","dungeon"].map(k=>[k,records.filter(r=>r.kind===k).length])),{candidates:60,book:256,dungeon:316});
const natural = records.filter(r=>r.fixture==="natural");
assert.equal(natural.length,12); assert.equal(natural.filter(r=>r.result).length,6);
for (const r of records.filter(r=>r.kind==="dungeon")) {
  assert.match(r.callSha1,/^[a-f0-9]{40}$/);
  assert.ok(r.result || r.writes.length===0);
  for (const [x,y,z,id,meta,flags] of r.writes) {
    assert.ok(x>= -30000000 && x<30000000 && z>= -30000000 && z<30000000 && y>=0 && y<256);
    assert.ok([0,4,48,52,54].includes(id)); assert.equal(meta,0); assert.ok(flags===2 || flags===3);
  }
}
const {stderr:version} = await exec("java",["-XshowSettings:properties","-version"]);
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const terrainReference = JSON.parse(await readFile(path.join(root,"../public/research/carver-reference.json"),"utf8"));
const names = [...new Set([...Object.keys(terrainReference.classes), ...config.serviceClasses, "asd", "arn", "ahb", "aji", "ajn", "awt", "aow", "aor", "apj", "agq", "acm", "afv", "aft", "afu", "agc", "qx", "qv", "qw", "adb", "ade", "add", "dh", "dq", "qh"])];
const classesUsed = Object.fromEntries(await Promise.all(names.map(async c => [c, {
  name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], {encoding:"buffer"})).stdout).digest("hex")
}])));
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  symbols: srgText.split("\n").filter(l => /^(MD|FD): (asd|afv|acm|qx|aft|aow|apj)\//.test(l)),
  jvm: String(version).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "Unchanged WorldGenDungeons, WeightedRandomChestContent, enchanted-book level30 helper and EnchantmentHelper. Explicit World block-access double with synthetic and 12 selected natural cases (six accepted/six rejected) across 48 native terrain/surface/cave/ravine chunk inputs; original full chunk input hashes retained. Candidate scanning is a fixture-selection procedure, not native spawn/population placement. Isolated feature RNG inputs are not post-provider streams. native material solidity, air/remove/tile lookup services. Native chest inventory (notification suppressed) and spawner logic. Ordered service hash encodes little-endian int32: 0 block read, 1 isAir followed by block read, 2 setter x/y/z/id/meta/flags, 3 setBlockToAir followed by flag3 setter, 4 tile lookup. Every write, final tile contents, ordered chest slot writes and next Random long retained. Config captures native loot weights, enchantment level ranges and compatibility. No native Chunk mutations, neighbor/lighting notifications, loot acceptance in live containers, spawner ticking or runtime population integration.",
  config, records,
};
await writeFile(path.join(root,"../public/research/dungeon-reference.json"), JSON.stringify(reference)+"\n");
console.log("Original dungeon records:",records.length, "kinds:",Object.fromEntries([...new Set(records.map(r=>r.kind))].map(k=>[k,records.filter(r=>r.kind===k).length])));
