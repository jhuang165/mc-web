// Probes the unchanged 1.7.10 BlockDispenser, BlockPistonBase, BlockPistonExtension, TileEntityDispenser
// and ContainerDispenser; see probes/DispenserPistonProbe.java. Requires the pinned client JAR, a JDK and the
// usual probe libraries. Writes public/research/dispenser-piston-reference.json, replayed by
// src/dispenser-piston.test.js and src/dispenser-container.test.js.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "dispenser-piston-probe");
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
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "authlib-", "netty-", "gson-"].map(library));
// The signed JAR is not launched; its unchanged classes are copied unsigned so the probe shares the default package.
const classes = path.join(out, "classes");
await rm(classes, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const probe = path.join(out, "probe");
await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
// RenderBlocks names two LWJGL exception types in exception tables; LWJGL is not launched, so signature-only stubs satisfy the verifier.
const stubs = { "org/lwjgl/LWJGLException": "package org.lwjgl; public class LWJGLException extends Exception {}",
  "org/lwjgl/opengl/DisplayMode": "package org.lwjgl.opengl; public class DisplayMode { public DisplayMode(int w, int h) {} }",
  "org/lwjgl/opengl/OpenGLException": "package org.lwjgl.opengl; public class OpenGLException extends RuntimeException {}" };
for (const [name, source] of Object.entries(stubs)) {
  const file = path.join(out, "stub", name + ".java");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, source + "\n");
  await exec("javac", ["-nowarn", "-d", probe, file]);
}
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/DispenserPistonProbe.java")]);
const { stdout } = await exec("java", ["-cp", cp, "DispenserPistonProbe"], { maxBuffer: 1 << 28 });
const rows = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
const one = (kind) => { const r = rows.filter((x) => x.kind === kind); assert.equal(r.length, 1, kind); return r[0]; };
const blocks = rows.filter((r) => r.kind === "block"), orientation = one("orientation"), placement = one("placement"), activation = one("activation"),
  spill = one("spill"), headBase = one("headBase"), nbtWrite = one("nbtWrite"), nbtRead = one("nbtRead"), layout = one("layout"), reach = one("reach"),
  pistonIcons = one("pistonIcons"), render = one("render"), helpers = one("helpers"), containers = rows.filter((r) => r.kind === "container"), shifts = rows.filter((r) => r.kind === "shift");
assert.deepEqual(blocks.map((b) => b.id), [23, 29, 33, 34]);
assert.equal(layout.slotCount, 45);
assert.equal(orientation.count, orientation.rows.length);
// EntityPlayerMP keeps yOffset 0 and the client player 1.62 with posY at the eye; the position tests are boundary-safe except at
// float rounding of the 0.18 / -1.82 height cut, which is why both results are kept in each row.
for (const r of orientation.rows) assert.ok([r[5], r[6]].every((v) => v >= 0 && v <= 5));
assert.equal(render.cases.length, 48);
assert.equal(containers.length, 150);
assert.equal(shifts.length, 135);
const srg = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8");
const hashClass = async (id) => createHash("sha256").update((await exec("unzip", ["-p", jar, id + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { akm: "BlockDispenser", app: "BlockPistonBase", apq: "BlockPistonExtension", apb: "TileEntityDispenser", aaz: "ContainerDispenser", aji: "Block", zs: "Container", aay: "Slot" };
const classHashes = {};
for (const [id, name] of Object.entries(names)) classHashes[id] = { name, sha256: await hashClass(id) };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1: CLIENT_SHA1,
  srgSha256: createHash("sha256").update(srg).digest("hex"),
  method: "Unchanged BlockDispenser (23), BlockPistonBase (33 normal / 29 sticky) and BlockPistonExtension (34) registry objects driven through a constructor-less World double (block, metadata and tile maps; recorded setBlockMetadata, setBlockToAir and spawned EntityItems) and a constructor-less EntityPlayer: bounds, collision and selection boxes, icon names, drops, onBlockPlacedBy / determineOrientation, onBlockActivated, breakBlock spills, head/base interplay, TileEntityDispenser NBT, the unchanged RenderBlocks.renderPistonBase / renderPistonExtension quads read from the Tessellator buffer, and the unchanged ContainerDispenser through Container.slotClick (click, shift-click, hotbar key, drop, drag, collect, creative clone). Dispensing, extension and retraction need redstone power and are not exercised.",
  classes: classHashes,
  blocks,
  helpers,
  pistonIcons,
  orientation,
  placement,
  activation,
  spill,
  headBase,
  nbtWrite,
  nbtRead,
  layout,
  reach,
  render,
  shifts,
  containers,
};
const file = path.join(root, "../public/research/dispenser-piston-reference.json");
await writeFile(file, JSON.stringify(reference) + "\n");
console.log(`Original dispenser/piston records: ${blocks.length} blocks, ${orientation.count} orientation, ${placement.rows.length} placement, ${render.cases.length} render cases, ${containers.length} container cases, ${shifts.length} shift routes, ${(await readFile(file)).length} bytes`);
