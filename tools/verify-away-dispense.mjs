// Batch 51 (tag b51ad): runs tools/probes/AwayDispenseProbe.java (spawn egg and Bottle o' Enchanting dispenser behaviours of the
// unchanged 1.7.10 client jar, through DispenseProbe's World double) and writes public/research/away-dispense-reference.json,
// replayed by src/away-dispense-b51.test.js. Same setup as verify-dispense.mjs.
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
for (const dir of researchDirs)
  if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const CLIENT_SHA1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "away-dispense-probe");
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), CLIENT_SHA1);
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || "").split(path.delimiter).filter(Boolean))
    if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [
    path.join(os.homedir(), "Library/Application Support/minecraft/libraries"),
    path.join(os.homedir(), ".minecraft/libraries"),
    path.join(os.homedir(), ".gradle/caches"),
  ]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec("find", [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"], { maxBuffer: 1 << 24 });
    const hit = stdout.split("\n").filter(Boolean).sort()[0];
    if (hit) return hit;
  }
  throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "authlib-", "netty-", "gson-", "commons-io-"].map(library));
const classes = path.join(out, "classes");
await rm(classes, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const probe = path.join(out, "probe");
await mkdir(probe, { recursive: true });
// The client jar ships no en_US.lang (it lives in the asset index); StringTranslate (dd) needs the resource to initialise, and horses and
// the spawn egg name read it. A one-line stub supplies it: no translated text is recorded.
const res = path.join(out, "res");
await mkdir(path.join(res, "assets/minecraft/lang"), { recursive: true });
await writeFile(path.join(res, "assets/minecraft/lang/en_US.lang"), "item.monsterPlacer.name=Spawn\n");
const cp = [probe, classes, res, ...libs].join(path.delimiter);
const stubs = { "org/lwjgl/LWJGLException": "package org.lwjgl; public class LWJGLException extends Exception {}",
  "org/lwjgl/opengl/DisplayMode": "package org.lwjgl.opengl; public class DisplayMode { public DisplayMode(int w, int h) {} }",
  "org/lwjgl/opengl/OpenGLException": "package org.lwjgl.opengl; public class OpenGLException extends RuntimeException {}" };
for (const [name, source] of Object.entries(stubs)) {
  const file = path.join(out, "stub", name + ".java");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, source + "\n");
  await exec("javac", ["-nowarn", "-d", probe, file]);
}
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/DispenseProbe.java"), path.join(root, "probes/AwayDispenseProbe.java")]);
const { stdout } = await exec("java", ["-cp", cp, "AwayDispenseProbe"], { maxBuffer: 1 << 28 });
const rows = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
// playLivingSound after the spawn depends on the mob's own unseeded Entity.rand (pitch, and whether a bat speaks at all), so the
// entitySound lines are dropped from the records; the mob spawn itself is what the dispenser decides.
for (const r of rows) if (r.log) r.log = r.log.filter((l) => !l.startsWith("entitySound"));
// A dispensed bottle's heading draws from its own unseeded Entity.rand; the `heading` rows reseed it, so the dispense rows keep position only.
for (const r of rows) if (r.kind === "dispense") for (const e of r.spawned) if (e.class === "zn") for (const k of ["mx", "my", "mz", "yaw", "pitch"]) delete e[k];
const count = (k) => rows.filter((r) => r.kind === k).length;
assert.ok(count("dispense") > 80 && count("heading") === 18, `rows ${rows.length}`);
const hashClass = async (id) => createHash("sha256").update((await exec("unzip", ["-p", jar, id + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { kx: "BehaviorDispenseSpawnEgg", ku: "BehaviorDispenseExpBottle", kk: "BehaviorProjectileDispense", aee: "ItemMonsterPlacer", akm: "BlockDispenser" };
const classHashes = {};
for (const [id, name] of Object.entries(names)) classHashes[id] = { name, sha256: await hashClass(id) };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1: CLIENT_SHA1,
  method: "Unchanged BlockDispenser updateTick with the Bootstrap registry over DispenseProbe's constructor-less World double; the dispenser stands at (10, 64, 10) holding one stack. `dispense` rows record the spawned entities (class, position, yaw, head yaw, custom name), the stack left in the slot, the aux effects and the next world Random value. `heading` rows reseed Entity.rand and re-run setThrowableHeading as BehaviorProjectileDispense.dispenseStack does, with the behaviour's own velocity b() and inaccuracy a().",
  classes: classHashes,
  rows,
};
await writeFile(path.join(root, "../public/research/away-dispense-reference.json"), JSON.stringify(reference) + "\n");
console.log(`Away dispense records: ${rows.length}`);
