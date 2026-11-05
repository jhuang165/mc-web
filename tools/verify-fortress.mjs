// Native Java 1.7.10 nether fortress (MapGenNetherBridge / StructureNetherBridgePieces) placement, pieces and population. See FortressProbe.java and public/research/fortress.md.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "fortress-probe");
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
const probeFiles = ["TerrainProbe", "SpringProbe", "DecorationFeatureProbe", "NetherProbe", "StrongholdProbe", "FortressProbe"];
const cp = [probe, classes, jar, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, ...probeFiles.map((n) => path.join(root, `probes/${n}.java`))]);
const { stdout, stderr } = await exec("java", ["-Xmx3g", "-cp", cp, "FortressProbe"], { maxBuffer: 1 << 30 });
await writeFile(path.join(out, "raw.jsonl"), stdout);
if (/Exception|Caused by:/.test(stderr)) throw new Error(stderr);
const records = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
const of = (k) => records.filter((r) => r.kind === k);
const placements = of("placement"), starts = of("starts"), populations = of("population");
assert.equal(of("config").length, 1);
assert.ok(placements.length === 32 && starts.length === 16 && populations.length >= 8);
for (const r of populations) { assert.equal(r.steps.length, r.populated ** 2); assert.equal(r.areaSha1.length, r.size ** 2); assert.ok(r.startsBefore.length >= 1); }
const { stderr: version } = await exec("java", ["-XshowSettings:properties", "-version"]);
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const names = ["atd", "ate", "atf", "att", "ats", "atw", "atg", "ath", "ati", "atj", "atk", "atl", "atm", "atn", "ato", "atp", "atq", "atr", "atu", "atv", "aqv", "ave", "avm", "avk"];
const classesUsed = Object.fromEntries(await Promise.all(names.map(async (c) => [c, {
  name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex"),
}])));
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  jvm: String(version).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "Unchanged MapGenNetherBridge (atd), Start (ate), StructureNetherBridgePieces (atf) and every piece class. config: weight tables via reflection on atf.a/b (att class/weight/limit/allowInRow), the atd spawn list, ats.a chest loot rows and block ids. placement: atd.a(II) over chunk squares. starts: the real MapGenBase driver (ave.a(apu, World, II, aji[])) on NetherProbe's world; piece rows are [saveId, coordBaseMode, componentType, minX, minY, minZ, maxX, maxY, maxZ, extra] (End seed, corridor chest flag, throne spawner flag). population: the real ChunkProviderHell (aqv) with its own atd, 6x6 chunks generated (x outer, z inner) then 5x5 populated, hellRNG continuing; per-populate write/call SHA-1 of World traffic, area hashes (id | metadata<<12 int32 LE per x,z,y<256), chest/spawner tiles by scan, aqv.a(sx.a,x,y,z) spawn-list identity probes (1 = fortress list, 0 = biome list, -1 = the biome lookup is not available in the double). Light fixture and World.rand as in nether-reference.json.",
  records,
};
const text = JSON.stringify(reference) + "\n";
assert.ok(text.length < 8_000_000);
await writeFile(path.join(root, "../public/research/fortress-reference.json"), text);
console.log("Fortress:", placements.length, "placement,", starts.length, "start,", populations.length, "population records;", text.length, "bytes");
