// Records unchanged 1.7.10 MapGenVillage/StructureVillagePieces; see VillageProbe.java. Requires the pinned client JAR, a JDK and the usual probe libraries.
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
  out = path.join(research, "village-probe");
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
  path.join(root, "probes/VillageProbe.java"),
]);
const mode = process.env.VILLAGE_PROBE_MODE || "run";
const { stdout } = await exec("java", ["-Xmx2g", "-cp", cp, "VillageProbe", ...(process.env.VILLAGE_PROBE_ARGS ? process.env.VILLAGE_PROBE_ARGS.split(" ") : [mode])], { maxBuffer: 1 << 30 });
if (mode !== "run") { console.log(stdout); process.exit(0); }
if (process.env.VILLAGE_PROBE_RAW) { await writeFile(process.env.VILLAGE_PROBE_RAW, stdout); process.exit(0); }
const rows = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
const config = rows.shift(), door = rows.shift(), records = rows;
assert.equal(door.kind, "door");
assert.equal(door.cases.length, 4 * 81);
assert.equal(config.kind, "config");
assert.equal(config.materials.length, 256);
assert.equal(config.loot.length, 17);
assert.deepEqual(config.villageBiomes, [1, 2, 35]);
assert.deepEqual(config.providerLevels, [64, 4]);
assert.ok(records.length > 0 && records.every((r) => r.kind === "village"));
const counts = { starts: 0, pieces: 0, valid: 0, population: { writes: 0, entities: 0, calls: 0, chunks: 0 } };
const typesSeen = new Set(), professions = new Set(), biomes = new Set();
for (const r of records) {
  assert.match(r.randomAfter, /^-?\d+$/);
  for (const s of r.starts) {
    counts.starts++; counts.pieces += s.pieceCount; if (s.valid) counts.valid++;
    assert.match(s.piecesSha1, /^[a-f0-9]{40}$/);
    assert.ok(s.valid === (s.pieces ? s.pieces.filter((p) => p[0] !== "ViSR").length > 2 : s.valid));
    for (const p of s.pieces || []) typesSeen.add(p[0]);
  }
  for (const c of r.chunks) {
    assert.match(c.writesSha1, /^[a-f0-9]{40}$/); assert.match(c.callsSha1, /^[a-f0-9]{40}$/);
    if (c.writes) assert.equal(c.writes.length, c.writeCount);
    counts.population.writes += c.writeCount; counts.population.entities += c.entities.length; counts.population.calls += c.callCount; counts.population.chunks++;
    for (const e of c.entities) professions.add(e[4]);
  }
}
// The corpus must exercise every piece class, all villager professions, the three village biomes and invalid starts.
assert.deepEqual([...typesSeen].sort(), ["ViBH", "ViDF", "ViF", "ViL", "ViPH", "ViS", "ViSH", "ViSR", "ViST", "ViSmH", "ViStart", "ViTRH"].sort());
assert.deepEqual([...professions].sort(), [0, 1, 2, 3, 4]);
assert.ok(records.some((r) => r.starts.some((s) => !s.valid)));
assert.ok(records.some((r) => r.starts.length > 1));
assert.ok(records.some((r) => r.flatProvider) && records.some((r) => r.type === "largeBiomes") && records.some((r) => r.distance !== 32) && records.some((r) => r.size > 0));
assert.ok(records.some((r) => r.tiles.length > 0));
const {stderr:version} = await exec("java",["-XshowSettings:properties","-version"]);
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const names = ["avn","avo","avp","avq","avr","avs","avt","avu","avv","avw","avx","avy","avz","awa","awb","awc","awd","awe","awf","avk","avi","avm","ave","aqx","asv","qx","qh","ach","aqo","aqq","ajn","aji","awt","ahb","aib","yv","add","adb","ade","aow"];
const classesUsed = Object.fromEntries(await Promise.all(names.map(async (c) => [c, {
  name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer" })).stdout).digest("hex"),
}])));
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  symbols: srgText.split("\n").filter((l) => new RegExp("^CL: (" + names.join("|") + ") ").test(l)),
  jvm: String(version).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "Unchanged MapGenBase.func_151539_a seeding, MapGenStructure recursiveGenerate/generateStructuresInChunk and its HashMap<Long,StructureStart> (JVM-dependent iteration order, recorded on the listed JVM), MapGenVillage and MapGenVillage.Start with its option parser, StructureVillagePieces (weighted list, Start, Well, Path, Torch, House1, Church, House4Garden, WoodHut, Hall, Field1, Field2, Blacksmith, Library), the awd base class (desert substitution, getAverageGroundLevel, spawnVillagers with a real EntityVillager), ItemDoor.func_150924_a, WeightedRandomChestContent, StructureBoundingBox and the real WorldChunkManager. World double: explicit block access over analytic fixtures (flat, hills with water/leaves/tall grass, dunes) with a chosen WorldProvider ground level (64 normal, 4 flat); MapGenStructureData load returns null and save is ignored. Each case runs the unchanged driver from one centre chunk, then populates every chunk covering a sizeable start (once, in start-map order) with the ChunkProviderGenerate populate seed. Ordered service hash encodes little-endian int32: 0 block read, 1 isAir followed by block read, 2 setter x/y/z/id/meta/flags, 4 tile lookup, 5 entity spawn floor(x/y/z), 6 getTopSolidOrLiquidBlock x/z, 7 notifyBlocksOfNeighborChange x/y/z/id. Write hash: x/y/z/id/meta/flags per accepted setter. Piece hashes: SHA-1 of the JSON piece list text. Neighbour callbacks, World.rand reseeding by canSpawn, villager AI, NBT round trip and live integration are not modelled.",
  counts, config, door, records,
};
const text = JSON.stringify(reference) + "\n";
assert.ok(text.length < 8 * 1024 * 1024, "village-reference.json must stay under 8 MB");
await writeFile(path.join(root, "../public/research/village-reference.json"), text);
console.log("Original village records:", records.length, "counts:", JSON.stringify(counts), "bytes:", text.length);
