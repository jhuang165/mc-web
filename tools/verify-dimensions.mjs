// Native Java 1.7.10 Teleporter / WorldProviderHell / WorldProviderEnd / portal timing. See DimensionProbe.java and public/research/dimensions.md.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "dimension-probe");
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
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/DimensionProbe.java")]);
const { stdout, stderr } = await exec("java", ["-Xmx2g", "-cp", cp, "DimensionProbe"], { maxBuffer: 1 << 30 });
await writeFile(path.join(out, "raw.jsonl"), stdout);
if (/Exception|Caused by:/.test(stderr)) throw new Error(stderr);
const records = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
const count = (k) => records.filter((r) => r.kind === k).length;
assert.ok(count("provider") === 3 && count("timing") === 2 && count("setInPortal") === 60 && count("teleport") === 36 && count("direction") === 1);
const { stderr: version } = await exec("java", ["-XshowSettings:properties", "-version"]);
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const names = ["ahp", "aqo", "aqp", "aqq", "aqr", "sa", "yz", "p"];
const classesUsed = Object.fromEntries(await Promise.all(names.map(async (c) => [c, {
  name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex"),
}])));
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  jvm: String(version).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "Unchanged Teleporter (ahp) on a sparse WorldServer double (mt subclass, no constructor): cell = explicit override, else stone below `floor` (lava inside boxes), else air; setBlock/notify calls are logged. Entity doubles (sa subclass / yz via Unsafe). teleport: first = placeInPortal(entity at spawn) with a fresh Teleporter, second = a second entity through the same Teleporter (cache path). Providers aqp/aqq/aqr are allocated without constructors; b() and the protected light table method a() are invoked. Entity fields are [x,y,z,vx,vy,vz,yaw,pitch].",
  records,
};
const text = JSON.stringify(reference) + "\n";
await writeFile(path.join(root, "../public/research/dimensions-reference.json"), text);
console.log("Dimensions:", records.length, "records;", text.length, "bytes");
