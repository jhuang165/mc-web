// Native Java 1.7.10 BlockPortal/Size and BlockNetherWart. See PortalWartProbe.java and public/research/nether.md.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "portal-wart-probe");
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
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, ...["TerrainProbe", "SpringProbe", "DecorationFeatureProbe", "PortalWartProbe"].map((n) => path.join(root, `probes/${n}.java`))]);
const { stdout, stderr } = await exec("java", ["-Xmx2g", "-cp", cp, "PortalWartProbe"], { maxBuffer: 1 << 30 });
await writeFile(path.join(out, "raw.jsonl"), stdout);
if (/Exception|Caused by:/.test(stderr)) throw new Error(stderr);
const records = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse).filter((r) => r.kind !== "summary");
const count = (k) => records.filter((r) => r.kind === k).length;
assert.ok(count("frame") === 260 && count("pigman") === 14 && count("wartGrowth") === 40 && count("wartDrops") === 96);
assert.ok(records.some((r) => r.kind === "frame" && r.result) && records.some((r) => r.kind === "frame" && !r.result));
const { stderr: version } = await exec("java", ["-XshowSettings:properties", "-version"]);
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const names = ["amp", "amq", "amf", "ajr", "alk", "ajn"];
const classesUsed = Object.fromEntries(await Promise.all(names.map(async (c) => [c, {
  name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex"),
}])));
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  jvm: String(version).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "Unchanged BlockPortal (amp), Size (amq) and BlockNetherWart (amf) on real Chunk storage (SpringProbe.G double: real World.setBlock/notify). Floor of netherrack to y=10. frame: amp.func_150000_e at a query cell (fire placed there when air) on an obsidian ring (corners absent) of interior w x h along x (axis 0, meta 1) or z (axis 1, meta 2), mode = defect (0 none, 1 missing frame block, 2 stone inside, 3 fire inside, 4 netherrack frame block, 5/6 portal inside with right/wrong meta, 7 water inside, 8 extra obsidian outside); before/after = every non-air cell of the surrounding box as [x,y,z,id,meta]. cascade: after a success one frame or portal block is replaced (air, or stone for the odd ones) with World.setBlock flags 3 so the real neighbour-change callbacks run. bounds/side per meta; pigman: BlockPortal.updateTick 30000 times on one column with Random(seed), difficulty 0-3, spawn tick indices; wart: updateTick growth (200 ticks), support, placement, dropBlockAsItemWithChance drops [x,y,z,item,count,damage,age] with the world Random positions.",
  records,
};
const text = JSON.stringify(reference) + "\n";
assert.ok(text.length < 6_000_000);
await writeFile(path.join(root, "../public/research/portal-wart-reference.json"), text);
console.log("Portal/wart:", records.length, "records;", text.length, "bytes");
