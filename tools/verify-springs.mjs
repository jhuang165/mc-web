// Records unchanged 1.7.10 WorldGenLiquids springs with their immediate liquid ticks over native Chunk storage; see SpringProbe.java. Requires the pinned client JAR, a JDK and the usual probe libraries.
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
  out = path.join(research, "spring-probe");
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
]);
const { stdout } = await exec("java", ["-cp", cp, "SpringProbe", ...process.argv.slice(2)], { maxBuffer: 1 << 28 });
const rows = stdout.trim().split("\n").filter(l => l.startsWith("{")).map(JSON.parse);
const config = rows.shift(), records = rows.filter(r => r.kind === "springs");
assert.equal(config.kind, "config");
assert.deepEqual(config.liquids, [8, 10]);
assert.equal(records.length, 140);
const only = process.argv[2];
if (!only) {
  const placed = records.reduce((n, r) => n + r.results.filter(Boolean).length, 0), rejected = records.reduce((n, r) => n + r.results.filter((x) => !x).length, 0);
  assert.ok(placed >= 200 && rejected >= 50, `placed ${placed} rejected ${rejected}`);
  assert.ok(records.some((r) => r.sounds.length) && records.some((r) => r.drops.length) && records.some((r) => r.aux.length));
  const {stderr:version} = await exec("java",["-XshowSettings:properties","-version"]);
  const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
  for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
  const used = ["asm", "ahb", "apx", "apz", "aji", "ajn", "awt", "akr", "ant", "alw", "akx", "ajr", "amc", "aoj", "akh", "anz", "alc", "ane", "ajt", "aoh", "ajz", "alt", "alx", "amw", "ali", "xk", "mt"];
  const names = [...new Set([...used, ...config.blocks.map((b) => b[9])])].sort();
  const classesUsed = Object.fromEntries(await Promise.all(names.map(async c => [c, {
    name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], {encoding:"buffer", maxBuffer: 1 << 24})).stdout).digest("hex")
  }])));
  const reference = {
    target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
    srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
    symbols: srgText.split("\n").filter(l => /^(MD|FD): (asm|akr|alw|ant)\//.test(l)),
    jvm: String(version).match(/java\.version = (\S+)/)?.[1] || "unknown",
    method: "Unchanged WorldGenLiquids (asm) for flowing water and flowing lava, called as BiomeDecorator does, over a World double backed by real Chunk (apx) storage built with Chunk(World, Block[], byte[], x, z) and generateSkylightMap. Real World.setBlock, setBlockMetadataWithNotify, notifyBlocksOfNeighborChange, isAirBlock, setBlockToAir, func_147480_a and checkChunksExist run, as do the real Block callbacks (BlockDynamicLiquid, BlockStaticLiquid, BlockFalling with fallInstantly (instant falls), BlockBush family, reeds, cactus, vine, cocoa, leaves/log breakBlock, item drops through the doTileDrops game rule). The double supplies chunks, a block-light fixture (5x+11y+3z+base mod 16), and WorldServer.scheduleBlockUpdateWithPriority semantics: in immediate mode (set by WorldGenLiquids) every block except fire (func_149698_L) runs updateTick at once with the world Random, so liquids cascade and sand/gravel fall instantly, fire queues with delay 1, otherwise entries are queued once per (x, y, z, block). Light propagation and render marks are no-ops. The synthetic fixture (mirrored in the test) is six stone cave layers of corridors and rooms with stone/grass/dirt/sand/gravel/water/lava floors, plants, reeds, cactus, lilies, mushrooms, vines, cocoa on jungle-log pillars, sand/gravel ceilings, shafts and water/lava pools under a grass surface, chunks -3..2. Records hash the ordered calls (0 getBlock, 1 setBlock x/y/z/id/meta/flags, 2 getBlockMetadata, 3 block light, 4 setMetadata x/y/z/meta/flags, 5 schedule x/y/z/id/delay/priority), successful writes (setMetadata as id -1), final chunk storage (id|meta<<12 per x/z/y, then height map), and list pending ticks, dropped items (position, item, count, damage, pickup delay), sounds and aux effects, with the next decorator and world Random longs. Not a WorldServer: no light engine, entities or later tick processing.",
    config, records,
  };
  await writeFile(path.join(root,"../public/research/springs-reference.json"), JSON.stringify(reference)+"\n");
  console.log("Original spring records:", records.length, "placed:", placed, "rejected:", rejected);
}
