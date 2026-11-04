// Reads Material.isReplaceable of every registered original block through tools/probes/ReplaceableProbe.java and writes
// public/research/replaceable-reference.json for src/block-placement-replace.test.js.
// Needs a JDK, the pinned client JAR (tools/research or MC_RESEARCH) and the guava / log4j-api / commons-lang3 / netty-all JARs.
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
  exists = (p) => access(p).then(() => true, () => false);
const researchDirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "replaceable-probe"), clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), clientSha1);
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || "").split(path.delimiter).filter(Boolean)) if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [path.join(os.homedir(), "Library/Application Support/minecraft/libraries"), path.join(os.homedir(), ".minecraft/libraries"), path.join(os.homedir(), ".gradle/caches")]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec("find", [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"], { maxBuffer: 1 << 24 });
    const hit = stdout.split("\n").filter(Boolean).sort()[0];
    if (hit) return hit;
  }
  throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "netty-all-"].map(library));
const classes = path.join(out, "classes"), probe = path.join(out, "probe");
await rm(out, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await mkdir(probe, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/ReplaceableProbe.java")]);
const { stdout } = await exec("java", ["-cp", cp, "ReplaceableProbe"], { maxBuffer: 1 << 26 });
const lines = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
assert.ok(lines.length >= 171, `${lines.length} registered blocks`);
const replaceable = lines.filter((l) => l.replaceable).map((l) => l.id);
await writeFile(path.join(root, "../public/research/replaceable-reference.json"), JSON.stringify({
  source: "Material.isReplaceable of every registered Block of the unchanged Minecraft Java 1.7.10 client (tools/probes/ReplaceableProbe.java)",
  clientSha1, blocks: lines.length, replaceable,
}, null, 1) + "\n");
console.log(`${lines.length} blocks; replaceable: ${replaceable.join(", ")}`);
