// Native WorldServer.createSpawnPosition replay (tools/probes/SpawnProbe.java) -> public/research/spawn-reference.json, replayed by
// src/world-spawn.test.js. Needs the pinned client JAR, a JDK and the usual probe libraries (MC_RESEARCH, MC_PROBE_LIBS).
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
const researchDirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "spawn-probe");
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), "e80d9b3bf5085002218d4be59e668bac718abbc6");
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || "").split(path.delimiter).filter(Boolean)) if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [path.join(research, "libs-1.7.10"), path.join(os.homedir(), "Library/Application Support/minecraft/libraries"), path.join(os.homedir(), ".minecraft/libraries"), path.join(os.homedir(), ".gradle/caches")]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec("find", [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"], { maxBuffer: 1 << 24 });
    const hit = stdout.split("\n").filter(Boolean).sort()[0];
    if (hit) return hit;
  }
  return null;
}
const libs = (await Promise.all(["guava-", "log4j-api-", "log4j-core-", "commons-lang3-", "commons-io-", "gson-", "authlib-", "netty-"].map(library))).filter(Boolean);
const classes = path.join(out, "classes");
await rm(classes, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const probe = path.join(out, "probe");
await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/SpawnProbe.java")]);
const flat = JSON.parse(await readFile(path.join(root, "../public/research/flat-world-reference.json"), "utf8"));
const presets = flat.records.find((r) => r.kind === "presets").list.map((p) => p.string);
assert.equal(presets.length, 8);
const { stdout } = await exec("java", ["-cp", cp, "SpawnProbe", ...presets], { maxBuffer: 1 << 28 });
const records = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
assert.equal(records.length, 36 + 16 + 32);
const { stderr: version } = await exec("java", ["-XshowSettings:properties", "-version"]);
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  jvm: String(version).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "Unchanged WorldServer.createSpawnPosition (mt.b) with its real findBiomePosition, 1000-step walk, WorldProvider.canCoordinateBeSpawn and World.getTopBlock, on chunks from the unchanged ChunkProviderGenerate/Flat (no population); spawn = WorldInfo.setSpawnPosition arguments. topSolid = unchanged World.getTopSolidOrLiquidBlock around the spawn.",
  records,
};
await writeFile(path.join(root, "../public/research/spawn-reference.json"), JSON.stringify(reference) + "\n");
console.log("Spawn records:", records.length);
