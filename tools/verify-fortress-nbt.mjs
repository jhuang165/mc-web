// Records unchanged 1.7.10 Nether fortress persistence (data/Fortress.dat: MapGenNetherBridge's MapGenStructureData, the
// Fortress start and the fifteen Ne* pieces through MapGenStructureIO) and checks the JavaScript port against it.
// Requires the pinned client JAR, a JDK and the usual probe libraries; see tools/probes/FortressNbtProbe.java.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import assert from "node:assert/strict";
import { decodeNbt } from "../src/nbt.js";
import { MapGenNetherBridge } from "../src/fortress.js";
import { NetherArea } from "../src/nether-generator.js";
import { randomLong } from "../src/structure-framework.js";
import { encodeStructureData, encodeStructureDataDat, decodeStructureData, decodeStructureDataDat, structureMapOf } from "../src/structure-nbt.js";

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
const out = path.join(research, "fortress-nbt-probe"), classes = path.join(out, "classes"), probe = path.join(out, "probe"), datDir = path.join(out, "js-dat");
await rm(classes, { recursive: true, force: true }); await mkdir(classes, { recursive: true });
await rm(datDir, { recursive: true, force: true }); await mkdir(datDir, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 }); await mkdir(probe, { recursive: true });
const cp = [probe, classes, jar, ...libs].join(path.delimiter);
const probes = ["TerrainProbe", "SpringProbe", "DecorationFeatureProbe", "NetherProbe", "StrongholdProbe", "FortressProbe", "FortressNbtProbe"];
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, ...probes.map((n) => path.join(root, `probes/${n}.java`))]);
const POPULATIONS = 8; // indices into FortressNbtProbe.popHit; one JVM each (native class statics leak between worlds)
const run = async (args, env = {}) => {
  const r = await exec("java", ["-Xmx3g", "-cp", cp, "FortressNbtProbe", ...args], { maxBuffer: 1 << 28, env: { ...process.env, ...env } });
  if (/Exception|Caused by:/.test(r.stderr)) throw new Error(r.stderr);
  return r.stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
};
const bytesOf = (b64) => new Uint8Array(Buffer.from(b64, "base64")), b64 = (b) => Buffer.from(b).toString("base64");

// 1. Native driver records: created data after the real MapGenBase driver.
const driver = await run([]);
assert.equal(driver.length, 16);
for (const rec of driver) {
  const gen = new MapGenNetherBridge(BigInt(rec.worldSeed));
  for (const [x, z] of rec.centers) gen.generate(x, z);
  assert.equal(b64(encodeStructureData(gen)), rec.data, `driver ${rec.label}: JS Fortress data equals native bytes`);
  assert.deepEqual(gen.structureMap.values().map((s) => [s.chunkX, s.chunkZ]), rec.mapOrder);
}

// 2. Native populations; the JS port must write the same created and populated bytes.
const populations = [];
for (let i = 0; i < POPULATIONS; i++) populations.push((await run([], { FORTRESS_NBT_POP: String(i) }))[0]);
function jsPopulation(rec, preload = null) {
  const area = new NetherArea({ seed: rec.seed, chunkX: rec.origin[0], chunkZ: rec.origin[1], size: rec.size, populated: rec.populated });
  if (preload) area.provider.bridge.structureMap = structureMapOf(preload);
  let created = null;
  area.run({ beforePopulate() { created ??= b64(encodeStructureData(area.provider.bridge)); } });
  return { created, populated: b64(encodeStructureData(area.provider.bridge)), hell: randomLong(area.provider.hellRNG).toString(), world: randomLong(area.world.rand).toString() };
}
const jsOf = new Map();
for (const rec of populations) {
  const js = jsPopulation(rec); jsOf.set(rec.label, js);
  assert.equal(js.created, rec.created, `${rec.label} created`);
  assert.equal(js.populated, rec.populatedData, `${rec.label} populated`);
  assert.equal(js.hell, rec.hellNextLong); assert.equal(js.world, rec.worldNextLong);
  const dat = await encodeStructureDataDat(decodeStructureData(bytesOf(js.created)).starts);
  await writeFile(path.join(datDir, `${rec.label}.Fortress.dat`), dat);
  assert.deepEqual(gunzipSync(Buffer.from(dat)), Buffer.from(bytesOf(rec.created)), "JS gzip root equals the native created root");
  const viaNative = decodeStructureData(gunzipSync(Buffer.from(await encodeStructureDataDat(decodeStructureData(bytesOf(rec.created)).starts))));
  assert.equal(viaNative.starts.length, rec.createdKeys.length);
  assert.equal(viaNative.skipped.length, 0);
  assert.deepEqual(await decodeStructureDataDat(Buffer.from(rec.populatedGzip, "base64")).then((d) => d.skipped), []);
}

// 3. The unchanged native loader reads the JS .dat files (MapStorage path), re-serialises them and repopulates.
const reloaded = [];
for (let i = 0; i < POPULATIONS; i++) reloaded.push((await run(["dat", datDir], { FORTRESS_NBT_POP: String(i) }))[0]);
const replayKey = (r) => JSON.stringify([r.steps, r.areaSha1, r.hellNextLong, r.worldNextLong, r.mapOrder, r.populatedIds, r.populatedData]);
const reference = [];
for (const rec of populations) {
  const dat = reloaded.find((r) => r.label === rec.label);
  assert.ok(dat, rec.label);
  assert.equal(dat.created, rec.created, `${rec.label}: native re-serialises the JS .dat to the native created bytes`);
  assert.equal(replayKey(dat), replayKey(rec), `${rec.label}: native population from the JS .dat equals the native baseline`);
  const js = jsPopulation(rec, decodeStructureData(bytesOf(rec.created)));
  assert.equal(js.created, rec.created); assert.equal(js.populated, rec.populatedData, `${rec.label} JS populated from reloaded starts`);
  const { populatedGzip, ...entry } = rec;
  reference.push({ ...entry, nativeReadBackMatches: true, jsDatReplayMatches: true, populatedGzipSha256: createHash("sha256").update(populatedGzip).digest("hex") });
}

const pieceCounts = {}, startCounts = {};
const walk = (b64Data) => {
  for (const [, tag] of decodeNbt(bytesOf(b64Data)).tag.value.get("data").value.get("Features").value) {
    const id = tag.value.get("id").value; startCounts[id] = (startCounts[id] ?? 0) + 1;
    for (const child of tag.value.get("Children").value.items) { const p = child.get("id").value; pieceCounts[p] = (pieceCounts[p] ?? 0) + 1; }
  }
};
for (const rec of driver) walk(rec.data);
for (const rec of reference) walk(rec.created);
const flagCounts = { chestTrue: 0, chestFalse: 0, mobTrue: 0, mobFalse: 0, seeds: new Set() };
for (const rec of [...driver.map((d) => d.data), ...reference.flatMap((r) => [r.created, r.populatedData])]) {
  for (const [, tag] of decodeNbt(bytesOf(rec)).tag.value.get("data").value.get("Features").value) for (const c of tag.value.get("Children").value.items) {
    const id = c.get("id").value;
    if (id === "NeSCLT" || id === "NeSCRT") flagCounts[c.get("Chest").value ? "chestTrue" : "chestFalse"]++;
    if (id === "NeMT") flagCounts[c.get("Mob").value ? "mobTrue" : "mobFalse"]++;
    if (id === "NeBEF") flagCounts.seeds.add(c.get("Seed").value);
  }
}
flagCounts.seeds = flagCounts.seeds.size;
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const names = ["atd", "ate", "atf", "ats", "atg", "ath", "ati", "atj", "atk", "atl", "atm", "atn", "ato", "atp", "atq", "atr", "atu", "atv", "atw", "ave", "avj", "avk", "avm", "avl", "du", "dh", "aqv"];
const classesUsed = Object.fromEntries(await Promise.all(names.map(async (c) => [c, { name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex") }])));
const jvm = await exec("java", ["-XshowSettings:properties", "-version"]);
const doc = {
  target: "Minecraft Java 1.7.10", clientSha1, srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  jvm: String(jvm.stderr).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "Unchanged MapGenNetherBridge (atd) with its private MapGenStructureData (avj), MapGenNetherBridge.Start (ate) and every fortress piece through MapGenStructureIO. driver: the real MapGenBase driver over the FortressProbe centers for 16 seeds, the data serialised through avj.b inside MapStorage's {data} wrapper, raw big-endian NBT base64 in native HashMap key order. population: real ChunkProviderHell populations around native fortress starts (FortressProbe populations), the data captured after the start search (created) and after population (flags and removed pieces), with the ordered call/write hashes, area hashes and RNG streams. A second JVM per world loads the JavaScript port's own gzip .dat through CompressedStreamTools and avj.a(root.m(data)) (MapStorage loader path), then func_143027_a / MapGenStructureIO.func_143035_a rebuild the starts and the same population is replayed: replay hashes and the repopulated data equal the baseline (nativeReadBackMatches, jsDatReplayMatches). Piece fields were also read from the bytecode: NeBEF writes Seed (int), NeSCLT and NeSCRT write Chest (boolean), NeMT writes Mob (boolean), the other eleven ids write nothing beyond id/BB/O/GD.",
  startCounts, pieceCounts, flagCounts, driver, records: reference,
};
const text = JSON.stringify(doc) + "\n";
assert.ok(text.length < 6_000_000);
await writeFile(path.join(root, "../public/research/fortress-nbt-reference.json"), text);
console.log("Fortress NBT:", driver.length, "driver worlds,", reference.length, "populations,", Object.values(startCounts).reduce((a, b) => a + b, 0), "starts,", Object.values(pieceCounts).reduce((a, b) => a + b, 0), "pieces,", Object.keys(pieceCounts).length, "piece ids,", JSON.stringify(flagCounts), text.length, "bytes");
