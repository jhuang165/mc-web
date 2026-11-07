// Native Java 1.7.10 EntityPigZombie.onSpawnWithEgg (child flag, villager reset, chicken jockey). See PigmanJockeyProbe.java and public/research/natural-spawning.md.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "pigman-jockey-probe");
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
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, ...["TerrainProbe", "SpringProbe", "DecorationFeatureProbe", "PortalWartProbe", "PigmanJockeyProbe"].map((n) => path.join(root, `probes/${n}.java`))]);
const { stdout, stderr } = await exec("java", ["-Xmx2g", "-cp", cp, "PigmanJockeyProbe"], { maxBuffer: 1 << 28 });
if (/Exception|Caused by:/.test(stderr)) throw new Error(stderr);
const rec = JSON.parse(stdout.trim().split("\n").filter((l) => l.startsWith("{")).pop());
assert.equal(rec.runs.length, 4);
const total = (k) => rec.runs.reduce((s, r) => s + r[k], 0);
assert.ok(total("children") > 0 && total("chickens") > 0, "the probe must observe child pigmen and chicken jockeys");
assert.equal(total("villagers"), 0, "EntityPigZombie.onSpawnWithEgg resets the villager flag");
const bytecode = (await exec("javap", ["-c", "-p", "-cp", classes, "yh"])).stdout;
// yh.a(sy): invokespecial yq.a(sy), then j(false) = setVillager(false) (yq.cb() reads the same data-watcher byte 13), return the argument.
assert.ok(/invokespecial\s+#\d+\s+\/\/ Method yq\.a:\(Lsy;\)Lsy;\s+\d+: pop\s+\d+: aload_0\s+\d+: iconst_0\s+\d+: invokevirtual\s+#\d+\s+\/\/ Method j:\(Z\)V/.test(bytecode), "yh.a(sy) calls super then setVillager(false)");
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1: "e80d9b3bf5085002218d4be59e668bac718abbc6",
  method: "Unchanged EntityPigZombie (yh).a(sy) on the PortalWartProbe world double (real Random world rand, chunk entity lookup). 20000 spawns per difficulty; events lists every spawn that was a child, a villager or made a second entity: [index, isChild, isVillager, chickenSpawned, ridingSomething].",
  jvm: (await exec("java", ["-XshowSettings:properties", "-version"])).stderr.match(/java\.version = (\S+)/)?.[1] || "unknown",
  runs: rec.runs,
};
const text = JSON.stringify(reference) + "\n";
await writeFile(path.join(root, "../public/research/pigman-jockey-reference.json"), text);
console.log("pigman jockey:", rec.runs.map((r) => `${r.children} child / ${r.chickens} chicken`).join("; "));
