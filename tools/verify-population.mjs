// Records unchanged 1.7.10 population seeding, ore veins and decorator ore passes; see PopulationProbe.java. Requires the pinned client JAR, a JDK and the usual probe libraries.
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
  out = path.join(research, "population-probe");
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
]);
const terrain = JSON.parse(await readFile(path.join(root, "../public/research/carver-reference.json"), "utf8"));
const { stdout } = await exec("java", ["-cp", cp, "PopulationProbe"], { maxBuffer: 1 << 28 });
const records = stdout
  .trim()
  .split("\n")
  .filter((l) => l.startsWith("{"))
  .map(JSON.parse);
assert.deepEqual(
  Object.fromEntries(["populationSeed", "vein", "ores"].map(kind => [kind, records.filter(r => r.kind === kind).length])),
  { populationSeed: 24, vein: 468, ores: 42 },
);
assert.equal(records.length, 534);
// The SRG is required so the evidence always carries mapped class/member identities.
const srg = path.join(research, "joined-1.7.10.srg"),
  srgText = await readFile(srg, "utf8"),
  mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
// Full population order is bytecode evidence, separate from the seed-only execution.
const { stdout: providerBytecode } = await exec("javap", ["-classpath", jar, "-c", "-p", "aqz"]);
const populate = providerBytecode.split("  public void a(apu, int, int);")[1]?.split("  public boolean a(boolean, qk);")[0];
assert.ok(populate, "Missing native populate bytecode");
const populationCallSites = [...populate.matchAll(/^\s*(\d+): invokevirtual\s+#[^\n]+?\/\/ Method ((?:asw|avn|aug|atx|arx|asd|ahu)\..*)$/gm)]
  .map(m => ({ offset: Number(m[1]), method: m[2] }));
// Use the complete invocation list for world freeze/snow and static spawning too.
const populationInvocations = [...populate.matchAll(/^\s*(\d+): (invoke\w+)\s+#[^\n]+?\/\/ Method (.+)$/gm)]
  .map(m => ({ offset: Number(m[1]), opcode: m[2], method: m[3] }));
assert.equal(populationCallSites.length, 8); // four structures, two lakes, dungeon, biome decoration
const used = new Set([...Object.keys(terrain.classes), "ase", "arn", "aia", "asw", "avn", "aug", "atx", "arx", "asd", "aho"]);
const { stderr: version } = await exec("java", [
  "-XshowSettings:properties",
  "-version",
]);
const digest = async (name) =>
  createHash("sha256")
    .update(
      (
        await exec("unzip", ["-p", jar, name + ".class"], {
          encoding: "buffer",
          maxBuffer: 1 << 24,
        })
      ).stdout,
    )
    .digest("hex");
const symbols = srgText
  .split("\n")
  .filter((line) => /^(MD|FD): (ase|arn|aia|aqz|qh)\//.test(line));
const names = {};
for (const c of [...used].sort()) names[c] = mcp[c] || null;
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  srgSha256: createHash("sha256").update(srgText).digest("hex"),
  symbols,
  populationInvocations,
  classes: Object.fromEntries(
    await Promise.all(
      Object.keys(names).map(async (c) => [
        c,
        { name: names[c], sha256: await digest(c) },
      ]),
    ),
  ),
  method: "Unchanged WorldGenMinable.generate and BiomeDecorator.generateOres with native constructor configuration and helpers. World double supplies original-ID block reads and writes (metadata and flags recorded), Y 0..255 and +/-30M bounds; solid and mixed fixtures plus native terrain/surface/cave/ravine chunks. Every candidate read coordinate is hashed as three little-endian int32s, every write is recorded in order. Wrappers record native ore attempts without drawing Random. The full populate invocation order is separately inspected with javap, including conditional structures/lakes, dungeons, biome decoration, spawning and ice/snow; invocation listings are not execution of those branches. Population seed records execute ChunkProviderGenerate.populate only through its second Random.setSeed, then stop before any features. No full population, native World/Chunk notifications or integrated runtime acceptance. Natural ore-pass Random is deliberately seeded to 1234, not claimed to be the post-lake/dungeon stream. JVM " + (String(version).match(/java\.version = (\S+)/)?.[1] || "unknown") + ".",
  records,
};
await writeFile(
  path.join(root, "../public/research/population-reference.json"),
  JSON.stringify(reference) + "\n",
);
console.log(
  "Original population/ore records:",
  records.length,
  Object.fromEntries(
    [...new Set(records.map((r) => r.kind))].map((k) => [
      k,
      records.filter((r) => r.kind === k).length,
    ]),
  ),
);
