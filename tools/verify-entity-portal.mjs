// Native Java 1.7.10 Teleporter / WorldProviderHell / WorldProviderEnd / portal timing. See EntityPortalProbe.java and public/research/dimensions.md.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "entity-portal-probe");
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
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/EntityPortalProbe.java")]);
const { stdout, stderr } = await exec("java", ["-Xmx2g", "-cp", cp, "EntityPortalProbe"], { maxBuffer: 1 << 30 });
await writeFile(path.join(out, "raw.jsonl"), stdout);
if (/Exception|Caused by:/.test(stderr)) throw new Error(stderr);
const records = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
const count = (k) => records.filter((r) => r.kind === k).length;
assert.ok(count("trace") === 10 && count("collide") === 8 && count("transfer") === 30 && count("travel") === 30 && count("nbt") === 5, JSON.stringify(Object.fromEntries(["trace", "collide", "transfer", "travel", "nbt"].map((k) => [k, count(k)]))));
const { stderr: version } = await exec("java", ["-XshowSettings:properties", "-version"]);
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) \S+\/(\S+)$/gm)) mcp[m[1]] = m[2];
const names = ["ahp", "aqo", "aqp", "aqq", "aqr", "sa", "yz", "amp", "akt", "oi", "sg", "xk", "sq"];
const classesUsed = Object.fromEntries(await Promise.all(names.map(async (c) => [c, {
  name: mcp[c], sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex"),
}])));
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  srgSha256: createHash("sha256").update(srgText).digest("hex"), classes: classesUsed,
  jvm: String(version).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method: "Unchanged sa.C (Entity.onEntityUpdate, called non-virtually so EntityLivingBase extras do not run), amp.a / akt.a (BlockPortal / BlockEndPortal.onEntityCollidedWithBlock), sa.b(I)V (travelToDimension with a MinecraftServer double whose world array holds the three probe worlds), oi.a(sa,int,mt,mt) (transferEntityToWorld) and ahp (Teleporter) on sparse WorldServer doubles (mt subclass, no constructor): cell = explicit override, else stone up to `floor`, else air; spawn/remove/update calls are logged. The probe entity class is registered with EntityList (id 250, \"ProbeEntity\") so createEntityByName builds the copy. Entity fields are [x,y,z,vx,vy,vz,yaw,pitch]. trace: per tick [tick, insidePortalBlock, portalCounter, timeUntilPortal, inPortal, travel ops]; the trace runs Entity.onEntityUpdate and then the BlockPortal collision, as the server does (update first, movement collision after).",
  records,
};
const text = JSON.stringify(reference) + "\n";
await writeFile(path.join(root, "../public/research/entity-portal-reference.json"), text);
console.log("Entity portal:", records.length, "records;", text.length, "bytes");
