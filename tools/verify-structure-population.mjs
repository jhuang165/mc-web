// Regenerates provider-order evidence from unchanged Minecraft Java 1.7.10 classes.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url));
const exists = (p) => access(p).then(() => true, () => false);
const dirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of dirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), sha1 = createHash("sha1").update(await readFile(jar)).digest("hex");
assert.equal(sha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || "").split(path.delimiter).filter(Boolean)) if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [path.join(os.homedir(), "Library/Application Support/minecraft/libraries"), path.join(os.homedir(), ".minecraft/libraries"), path.join(os.homedir(), ".gradle/caches")]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec("find", [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"], { maxBuffer: 1 << 24 });
    const hit = stdout.split("\n").filter(Boolean).sort()[0]; if (hit) return hit;
  }
  throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "authlib-", "netty-"].map(library));
const out = path.join(research, "structure-population-probe"), classes = path.join(out, "classes"), probe = path.join(out, "probe");
await rm(classes, { recursive: true, force: true }); await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 }); await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/TerrainProbe.java"), path.join(root, "probes/DecorationFeatureProbe.java"), path.join(root, "probes/SpringProbe.java"), path.join(root, "probes/StructurePopulationProbe.java")]);
const { stdout, stderr } = await exec("java", ["-Xmx1g", "-cp", cp, "StructurePopulationProbe"], { maxBuffer: 1 << 24 });
if (/Exception|Error/.test(stderr)) throw new Error(stderr);
const records = stdout.trim().split("\n").filter((line) => line.startsWith("{")).map(JSON.parse);
assert.equal(records.length, 5);
assert.ok(records.every((r) => r.kind === "search" && Object.keys(r.structures).length === 4));
const srg = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), names = {};
for (const m of srg.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) names[m[1]] = m[2];
const classesHash = Object.fromEntries(await Promise.all(["aqz", "asw", "avn", "aug", "atx", "ave", "ahb"].map(async (name) => [name, {
  name: names[name], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, name + ".class"], { encoding: "buffer" })).stdout).digest("hex"),
}])));
await writeFile(path.join(root, "../public/research/structure-population-reference.json"), JSON.stringify({
  target: "Minecraft Java 1.7.10", clientSha1: sha1, jvm: (await exec("java", ["-version"])).stderr.trim(), classes: classesHash,
  method: "Unchanged native ChunkProviderGenerate.provideChunk with map features enabled; real terrain/caves/ravines and four native MapGenStructure start searches. Records native structure-map iteration order and World.rand after search. Population map-feature call order and lake suppression are separately exercised by the unmodified provider stage and replayed in JS.",
  records,
}, null, 2) + "\n");
console.log("Native structure population search:", records.length, "provider records");
