// Batch 64: runs the unchanged ItemRenderer.renderItemInFirstPerson (bly.a(float)) for several held items, swings, use counts and views and writes
// public/research/first-person-reference.json (see tools/probes/FirstPersonProbe.java). GL is recorded by probes/gl/GL11.java; the stand-ins for Minecraft, RenderManager and RenderHelper
// are in probes/fp/, the texture manager, texture helper and OpenGlHelper in probes/held/. src/babyrender-b64.test.js replays the record. Needs a JDK, the pinned client JAR
// (tools/research or MC_RESEARCH) and libs-1.7.10.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
let research;
for (const dir of [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean)) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "first-person-probe");
const clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), clientSha1);
const libDir = process.env.MC_PROBE_LIBS || path.join(research, "libs-1.7.10"), lib = (name) => path.join(libDir, `${name}.jar`);
await rm(out, { recursive: true, force: true });
const classes = path.join(out, "classes"), probe = path.join(out, "probe");
for (const d of [classes, probe]) await mkdir(d, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const cp = [probe, classes, lib("log4j-api-2.0-beta9"), lib("guava-15.0"), lib("commons-lang3-3.1"), lib("commons-io-2.4"), lib("gson-2.2.4"), lib("log4j-core-2.0-beta9")].join(path.delimiter);
const held = (f) => path.join(root, "probes/held", f), fp = (f) => path.join(root, "probes/fp", f);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/FirstPersonProbe.java"), fp("bao.java"), fp("bnn.java"), fp("bam.java"), held("bqf.java"), held("bqi.java"), held("buu.java"), held("com/mojang/authlib/GameProfile.java"), path.join(root, "probes/gl/GL11.java")]);
const { stdout } = await exec("java", ["-Djava.awt.headless=true", "-cp", cp, "FirstPersonProbe"], { maxBuffer: 1 << 27 });
const data = JSON.parse(stdout.trim().split("\n").filter((l) => l.startsWith("{")).pop());
assert.equal(data.cases.length, 42);
const hashClass = async (id) => createHash("sha256").update((await exec("unzip", ["-p", jar, id + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { bly: "ItemRenderer", add: "ItemStack", adb: "Item", bnn: "RenderManager (the probe shadows it)", bao: "Minecraft (the probe shadows it)", bam: "RenderHelper (the probe shadows it)", bqi: "texture helper (the probe shadows it)", buu: "OpenGlHelper (the probe shadows it)" };
await writeFile(path.join(root, "../public/research/first-person-reference.json"), JSON.stringify({
  source: "tools/verify-first-person.mjs: unchanged ItemRenderer.renderItemInFirstPerson (bly.a(float)) of the 1.7.10 client with the recording GL11 stand-in",
  clientSha1, classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await hashClass(c) }]))),
  events: "[\"T\", x, y, z] glTranslatef, [\"R\", angle, x, y, z] glRotatef, [\"S\", x, y, z] glScalef, [\"P\"] push, [\"O\"] pop, [\"C\", r, g, b, a] colour, [\"B\", id] RenderBlocks.renderBlockAsItem of that block id, [\"D\", n] a Tessellator draw of n vertices. The camera's own hand bob (EntityRenderer.hurtCameraEffect / setupViewBobbing) is applied before bly.a and is not part of the record.",
  cases: "id, damage; use: EntityPlayer.getItemInUseCount; swing: getSwingProgress(partial); equip / prevEquip: equippedProgress / prevEquippedProgress; partial; view: rotationPitch, prevRotationPitch, rotationYaw, prevRotationYaw, then the arm lag fields (EntityPlayerSP.renderArmPitch, prevRenderArmPitch, renderArmYaw, prevRenderArmYaw) in the order the probe set them; the exact field mapping is in FirstPersonProbe.java.",
  ...data,
}) + "\n");
console.log("First person cases:", data.cases.length);
