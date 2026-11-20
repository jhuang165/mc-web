// b88 tiles88: runs tools/probes/Tiles88Probe.java (BlockDaylightDetector.func_149957_e with WorldServer.tick's clock order on the unchanged
// 1.7.10 classes), checks src/daylight-sensor-time.js + src/redstone.js against every record and writes public/research/tiles88-reference.json
// for src/tiles88-b88.test.js. Needs a JDK, the pinned client JAR (tools/research or MC_RESEARCH) and the guava / log4j-api / commons-lang3 /
// netty-all library JARs (MC_PROBE_LIBS or a launcher/gradle cache), as tools/verify-redstone.mjs.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { replaySensorRecord } from "../src/daylight-sensor-time.js";

const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
const research = process.env.MC_RESEARCH || path.join(root, "research"), jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "tiles88-probe");
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
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "netty-all-"].map(library));
const classes = path.join(out, "classes"), probe = path.join(out, "probe");
await rm(out, { recursive: true, force: true });
await mkdir(classes, { recursive: true }); await mkdir(probe, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/Tiles88Probe.java")]);
// Every 250 ticks over a day, the day/night edges tick by tick, and a day past 24000 and a large total.
const times = [...Array.from({ length: 97 }, (_, i) => i * 250), ...Array.from({ length: 41 }, (_, i) => 12980 + i), ...Array.from({ length: 41 }, (_, i) => 22980 + i), 24000, 47999, 123456789];
const { stdout } = await exec("java", ["-cp", cp, "Tiles88Probe", ...times.map(String)], { maxBuffer: 1 << 26 });
const records = JSON.parse(stdout.slice(stdout.indexOf("[")));
for (const r of records) assert.deepEqual(replaySensorRecord(r), r, `t=${r[0]} rain=${r[1]} thunder=${r[2]}`);
await writeFile(path.join(root, "../public/research/tiles88-reference.json"), JSON.stringify({
  source: "tools/probes/Tiles88Probe.java on the unchanged 1.7.10 client classes (tools/verify-tiles88.mjs)",
  method: "Per world time t and weather (rain, weighted thunder): World.calculateSkylightSubtracted(1.0F) at t, then the world time t + 1 and BlockDaylightDetector.func_149957_e with getSavedLightValue(SKY) fixed at 15, 12, 7 and 4. Real World (allocated), WorldInfo, WorldProvider, MathHelper and BlockDaylightDetector; getBlockMetadata and setBlockMetadataWithNotify replaced by one recorded cell.",
  fields: ["worldTime", "rain", "thunder", "skylightSubtracted", "angleRadiansFloatBits", "signalSky15", "signalSky12", "signalSky7", "signalSky4"],
  records,
}, null, 0).replace(/\],\[/g, "],\n[") + "\n");
console.log(`tiles88: ${records.length} records agree`);
