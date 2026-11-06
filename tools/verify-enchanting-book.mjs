// Probes the unchanged 1.7.10 TileEntityEnchantmentTable, ModelBook, EnchantmentNameParts and the GuiEnchantment book step; see
// probes/EnchantingBookProbe.java. Requires the pinned client JAR, a JDK and the usual probe
// libraries. Writes public/research/enchanting-book-reference.json, replayed by
// src/enchanting-book.test.js.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "enchanting-book-probe");
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
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "authlib-", "netty-", "gson-", "commons-io-", "commons-codec-", "jopt-simple-"].map(library));
// The signed JAR is not launched; its unchanged classes are copied unsigned so the probe shares the default package.
const classes = path.join(out, "classes");
await rm(classes, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const probe = path.join(out, "probe");
await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
// GuiEnchantment's superclasses name LWJGL types in their static initialisers; LWJGL is not launched, so signature-only stubs satisfy the verifier.
const stubs = { "org/lwjgl/LWJGLException": "package org.lwjgl; public class LWJGLException extends Exception {}",
  "org/lwjgl/opengl/DisplayMode": "package org.lwjgl.opengl; public class DisplayMode { public DisplayMode(int w, int h) {} }",
  "org/lwjgl/opengl/OpenGLException": "package org.lwjgl.opengl; public class OpenGLException extends RuntimeException {}" };
for (const [name, source] of Object.entries(stubs)) {
  const file = path.join(out, "stub", name + ".java");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, source + "\n");
  await exec("javac", ["-nowarn", "-d", probe, file]);
}
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/EnchantingBookProbe.java")]);
const { stdout } = await exec("java", ["-cp", cp, "EnchantingBookProbe"], { maxBuffer: 1 << 28 });
const rows = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
const one = (kind) => { const r = rows.filter((x) => x.kind === kind); assert.equal(r.length, 1, kind); return r[0]; };
const model = one("model"), poses = rows.filter((r) => r.kind === "pose"), tiles = rows.filter((r) => r.kind === "tile"),
  names = rows.filter((r) => r.kind === "names"), words = one("words"), gui = rows.filter((r) => r.kind === "gui");
assert.equal(poses.length, 60);
assert.equal(tiles.length, 12);
assert.equal(names.length, 40);
assert.equal(gui.length, 6);
assert.equal(words.words.length, 55);
const srg = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8");
const hashClass = async (id) => createHash("sha256").update((await exec("unzip", ["-p", jar, id + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const classNames = { apd: "TileEntityEnchantmentTable", bhf: "ModelBook", bfp: "EnchantmentNameParts", bfq: "GuiEnchantment", bmn: "RenderEnchantmentTable", bix: "ModelRenderer", bis: "ModelBox" };
const classHashes = {};
for (const [id, name] of Object.entries(classNames)) classHashes[id] = { name, sha256: await hashClass(id) };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1: CLIENT_SHA1,
  srgSha256: createHash("sha256").update(srg).digest("hex"),
  method: "Unchanged TileEntityEnchantmentTable.updateEntity with its static Random replaced by a seeded one and a World double that keeps the real playerEntities list and World.getClosestPlayer; unchanged ModelBook geometry and setRotationAngles; unchanged EnchantmentNameParts; the unchanged GuiEnchantment book step on an allocated GUI. The renderer transforms (RenderEnchantmentTable, GuiEnchantment.drawGuiContainerBackgroundLayer) call OpenGL and are transcribed from bytecode, not probed. Scripted inputs are printed with each record.",
  classes: classHashes,
  model,
  poses,
  tiles,
  names,
  words: words.words,
  gui,
};
const file = path.join(root, "../public/research/enchanting-book-reference.json");
await writeFile(file, JSON.stringify(reference) + "\n");
console.log(`Original enchanting book records: model, ${poses.length} poses, ${tiles.length} tile scenarios, ${names.length} name seeds, ${gui.length} GUI scenarios, ${(await readFile(file)).length} bytes`);
