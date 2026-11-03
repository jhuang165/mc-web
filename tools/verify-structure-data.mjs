// Native 1.7.10 data/*.dat written after providing chunk rectangles, compared with src/structure-data.js (gunzipped bytes). See probes/StructureDataExportProbe.java.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import assert from "node:assert/strict";
import { structureDataFiles } from "../src/structure-data.js";
import { decodeNbt } from "../src/nbt.js";

const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url));
const exists = (p) => access(p).then(() => true, () => false);
const dirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of dirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), clientSha1 = createHash("sha1").update(await readFile(jar)).digest("hex");
assert.equal(clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || "").split(path.delimiter).filter(Boolean)) if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [path.join(os.homedir(), "Library/Application Support/minecraft/libraries"), path.join(os.homedir(), ".minecraft/libraries"), path.join(os.homedir(), ".gradle/caches")]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec("find", [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"], { maxBuffer: 1 << 24 });
    const hit = stdout.split("\n").filter(Boolean).sort()[0]; if (hit) return hit;
  }
  throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "authlib-", "netty-", "commons-io-"].map(library));
const out = path.join(research, "structure-data-probe"), classes = path.join(out, "classes"), probe = path.join(out, "probe");
await rm(classes, { recursive: true, force: true }); await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 }); await mkdir(probe, { recursive: true });
const cp = [probe, classes, jar, ...libs].join(path.delimiter);
const probes = ["TerrainProbe", "DecorationFeatureProbe", "SpringProbe", "BiomeDecoratorProbe", "MineshaftProbe", "MineshaftWorldProbe", "DungeonProbe", "BiomeOverrideProbe", "PopulationTailProbe", "PopulationWorldProbe", "StructurePopulationWorldProbe", "StructureNbtProbe", "StructureDataExportProbe"];
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, ...probes.map((n) => path.join(root, `probes/${n}.java`))]);
// seed, x0, x1, z0, z1 (native chunk coordinates). Ranges found with the JS searchers: seed 17 holds a village, a
// stronghold, a desert temple and two mineshafts; the others add village+temple+mineshaft and mineshaft+temple.
const WORLDS = [[17, -7, 13, -58, -50], [17, 45, 55, -17, -7], [0, 0, 6, 44, 50], [0, -56, -50, -19, -13]];
const NAMES = ["Mineshaft", "Village", "Stronghold", "Temple"], sha = (b) => createHash("sha256").update(b).digest("hex");
const records = [], summary = { starts: {}, files: 0 };
for (const w of WORLDS) {
  const r = await exec("java", ["-Xmx2g", "-cp", cp, "StructureDataExportProbe"], { maxBuffer: 1 << 28, env: { ...process.env, STRUCTURE_DATA_SCENARIOS: w.join(":") } });
  if (/Exception|Caused by:/.test(r.stderr)) throw new Error(r.stderr);
  const rec = JSON.parse(r.stdout.trim().split("\n").filter((l) => l.startsWith("{")).pop());
  const [seed, x0, x1, z0, z1] = w, chunks = [];
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) chunks.push([x, z]);
  const { files } = await structureDataFiles({ record: { biome: "java" }, seed: String(seed), chunks, generationVersion: 14 });
  const entry = { seed: String(seed), range: [x0, x1, z0, z1], files: {} };
  for (const name of NAMES) {
    const nativeRaw = gunzipSync(Buffer.from(rec.gzip[name], "base64")), jsBytes = files.get(`data/${name}.dat`);
    assert.ok(jsBytes, `JS wrote data/${name}.dat for ${w}`);
    const jsRaw = gunzipSync(Buffer.from(jsBytes));
    assert.ok(Buffer.compare(nativeRaw, jsRaw) === 0, `data/${name}.dat gunzips identically (seed ${seed} ${w})`);
    assert.ok(Buffer.compare(nativeRaw, Buffer.from(rec.raw[name], "base64")) === 0);
    const features = decodeNbt(nativeRaw).tag.value.get("data").value.get("Features").value, ids = {};
    for (const [, t] of features) { const id = t.value.get("id").value; ids[id] = (ids[id] ?? 0) + 1; summary.starts[id] = (summary.starts[id] ?? 0) + 1; }
    entry.files[name] = { rawBase64: nativeRaw.toString("base64"), rawSha256: sha(nativeRaw), gzipBytesNative: Buffer.from(rec.gzip[name], "base64").length,
      gzipBytesJs: jsBytes.length, keys: rec.keys[name], ids };
    summary.files++;
  }
  records.push(entry);
}
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), jvm = await exec("java", ["-XshowSettings:properties", "-version"]);
const doc = { target: "Minecraft Java 1.7.10", clientSha1, srgSha256: sha(srgText), jvm: String(jvm.stderr).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "Unchanged ChunkProviderGenerate.provideChunk (search of all four MapGenStructure maps) over a rectangle of chunks, x outer z inner; private MapGenStructureData read and gzip-written as MapStorage.saveData does. JS structureDataFiles output must gunzip to identical bytes.",
  summary, records };
const text = JSON.stringify(doc) + "\n";
await writeFile(path.join(root, "../public/research/structure-data-reference.json"), text);
console.log("Native structure data:", records.length, "worlds,", summary.files, "files,", JSON.stringify(summary.starts), text.length, "bytes");
