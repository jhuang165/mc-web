// Records the unchanged 1.7.10 BiomeDecorator driver (decorateChunk/genDecorations) over native terrain, caves and ravines in real Chunk storage; see BiomeDecoratorProbe.java. Requires the pinned client JAR, a JDK and the usual probe libraries.
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
  out = path.join(research, "biome-decorator-probe");
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
]);
const { stdout, stderr } = await exec("java", ["-Xss16m", "-cp", cp, "BiomeDecoratorProbe", ...process.argv.slice(2)], { maxBuffer: 1 << 28 });
const only = process.argv[2];
if (only) { process.stdout.write(stdout); process.stderr.write(stderr); process.exit(0); }
const rows = stdout.trim().split("\n").filter(l => l.startsWith("{")).map(JSON.parse);
const config = rows.shift(), regions = rows.filter(r => r.kind === "region"), records = rows.filter(r => r.kind === "decorate");
assert.equal(config.kind, "config");
assert.equal(regions.length, 5);
assert.equal(records.length, 70);
const slots = new Set(records.flatMap((r) => r.decorations.map((d) => d[2])));
assert.deepEqual([...slots].sort((a, b) => a - b), [...config.slots].sort((a, b) => a - b));
assert.ok(records.some((r) => r.drops.length) && records.some((r) => r.sounds.length) && records.some((r) => r.pendingCount));
const {stderr:version} = await exec("java",["-XshowSettings:properties","-version"]);
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const used = ["aia", "ahu", "aip", "aif", "aiv", "ain", "alc", "awl", "awo", "ase", "arj", "asj", "aro", "aru", "ash", "arh", "aiz", "ark", "asg", "asm", "arn", "arc", "aqz", "aqw", "aqs", "aib", "ahb", "apx", "aji", "ajn", "xk", "mt"];
const names = [...new Set([...used, ...config.biomes.flatMap((b) => [b[1], b[2]])])].sort();
const classesUsed = Object.fromEntries(await Promise.all(names.map(async c => [c, {
  name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], {encoding:"buffer", maxBuffer: 1 << 24})).stdout).digest("hex")
}])));
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  symbols: srgText.split("\n").filter(l => /^(MD|FD): (aia|aip|aiv)\//.test(l) || /^MD: (ahu|aif)\/a \(Ljava\/util\/Random;III\)/.test(l)),
  jvm: String(version).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "Unchanged BiomeDecorator.decorateChunk (aia.a(World, Random, BiomeGenBase, int, int)) and genDecorations for every registry slot whose decorator object is the base BiomeDecorator (the Nether slot 8 is skipped; the End slot 9 has its own decorator), called directly on that biome's decorator with the ChunkProviderGenerate population Random (populationSeed). Biome decorate overrides (emeralds, double plants, desert wells, mutated delegation) are not run. The world is SpringProbe's World double over real Chunk (apx) storage: each region is 4x4 chunks of native ChunkProviderGenerate terrain and biome blocks, MapGenCaves and MapGenRavine (no structures), and 14 records per region decorate 1-4 of the inner 2x2 chunks in a recorded order and slot, on a fresh world with its own world Random and block-light base. getBiomeGenForCoords comes from the real WorldChunkManager. Real World.setBlock, metadata, neighbour notification, Block callbacks, item drops and the springs' immediate ticks run as in springs-reference.json. Records give the input chunk hashes, the decorations ([chunkX, chunkZ, slot, population seed, next decorator long]), and hashes of the ordered calls (0 getBlock, 1 setBlock, 2 getBlockMetadata, 3 block light, 4 setMetadata, 5 schedule), successful writes, the pending-tick list (sha1 of comma-joined [x,y,z,id,delay,priority]) and final chunk storage, with drops, sounds, aux effects and the next world Random long. Not a WorldServer: no population stages outside the decorator, light engine, entities or later tick processing.",
  config, regions, records,
};
await writeFile(path.join(root,"../public/research/biome-decorator-reference.json"), JSON.stringify(reference)+"\n");
console.log("Original decorator records:", records.length, "decorations:", records.reduce((n, r) => n + r.decorations.length, 0), "slots:", slots.size);
