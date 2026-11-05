// Native Java 1.7.10 ChunkProviderHell terrain/surface/caves and population. See NetherProbe.java and public/research/nether.md.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "nether-probe");
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), "e80d9b3bf5085002218d4be59e668bac718abbc6");
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
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "authlib-", "netty-", "commons-io-"].map(library));
const classes = path.join(out, "classes");
await rm(classes, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const probe = path.join(out, "probe");
await mkdir(probe, { recursive: true });
const cp = [probe, classes, jar, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, ...["TerrainProbe", "SpringProbe", "DecorationFeatureProbe", "NetherProbe"].map((n) => path.join(root, `probes/${n}.java`))]);
const { stdout, stderr } = await exec("java", ["-Xmx2g", "-cp", cp, "NetherProbe"], { maxBuffer: 1 << 30 });
await writeFile(path.join(out, "raw.jsonl"), stdout);
if (/Exception|Caused by:/.test(stderr)) throw new Error(stderr);
const records = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
const chunks = records.filter((r) => r.kind === "chunk"), populations = records.filter((r) => r.kind === "population");
assert.ok(chunks.length >= 60 && populations.length >= 6);
for (const r of populations) { assert.equal(r.inputs.length, 16); assert.equal(r.steps.length, 9); assert.equal(r.areaSha1.length, 16); assert.equal(r.fortressStarts, 0); }
const { stderr: version } = await exec("java", ["-XshowSettings:properties", "-version"]);
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const names = ["aqv", "aqy", "aqp", "arq", "ars", "arr", "ary", "aro", "ase", "alb", "amp", "amq", "atd", "awk", "ajn"];
const classesUsed = Object.fromEntries(await Promise.all(names.map(async (c) => [c, {
  name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex"),
}])));
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  jvm: String(version).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "Unchanged ChunkProviderHell (aqv) with the nether bridge (atd) replaced by a no-op (provideChunk never writes fortress blocks; populate does). Chunk records: seed x chunk; terrainSha1 after aqv.a(II[Block), surfaceSha1 after aqv.b, sha1 after MapGenCavesHell and equal to the real provideChunk output; hashes are SHA-1 over int16 LE ids at index (x*16+z)*128+y (air 0), counts per id, nextLong of hellRNG after provideChunk. Population records: 4x4 chunks generated (x outer z inner) then a 3x3 corner populated x outer z inner with hellRNG continuing (populate does not reseed); lazy unpopulated halo from a second provider; World.rand seed 0; light fixture full/block 0, saved sky 15, no propagation; origins verified fortress-free by the real atd start search (radius 8 covers the area). areaSha1 packs id | metadata<<12 as int32 LE per x,z,y<256. writes/calls hash World.setBlock/getBlock traffic (int32 LE).",
  records,
};
const text = JSON.stringify(reference) + "\n";
assert.ok(text.length < 6_000_000);
await writeFile(path.join(root, "../public/research/nether-reference.json"), text);
console.log("Nether:", chunks.length, "chunk records;", populations.length, "population records;", text.length, "bytes");
