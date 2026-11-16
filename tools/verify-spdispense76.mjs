// Batch 76 (tag spdispense76): runs tools/probes/SpDispense76Probe.java (the filled-bucket dispenser behaviour in front of replaceable and solid blocks, in the Overworld
// and the Nether) over DispenseProbe's World double and writes public/research/sp-dispense76-reference.json, replayed by src/spdispense76-b76.test.js. Same setup as verify-dispense.mjs.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "sp-dispense76-probe");
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
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/DispenseProbe.java"), path.join(root, "probes/SpDispense76Probe.java")]);
const { stdout } = await exec("java", ["-cp", cp, "SpDispense76Probe"], { maxBuffer: 1 << 28 });
const rows = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
assert.ok(rows.length === 15 * 4 * 2 * 2 && rows.every((r) => r.kind === "bucket"), `rows ${rows.length}`);
const hashClass = async (id) => createHash("sha256").update((await exec("unzip", ["-p", jar, id + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { abo: "ItemBucket", akm: "BlockDispenser", cm: "BehaviorDefaultDispenseItem", aqo: "WorldProvider" };
const classHashes = {};
for (const [id, name] of Object.entries(names)) classHashes[id] = { name, sha256: await hashClass(id) };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1: CLIENT_SHA1,
  method: "Unchanged BlockDispenser updateTick with the Bootstrap registry (BehaviorDispenseFilledBucket -> ItemBucket.tryPlaceContainedLiquid) over DispenseProbe's constructor-less World double; the dispenser stands at (10, 64, 10) holding one water or lava bucket, the cell in front holds one block; `nether` sets WorldProvider.isHellWorld. Records: the stack left, the world log (break, set, sound, aux) and spawned entities.",
  classes: classHashes,
  rows,
};
await writeFile(path.join(root, "../public/research/sp-dispense76-reference.json"), JSON.stringify(reference) + "\n");
console.log(`Sp dispense 76 records: ${rows.length}`);
