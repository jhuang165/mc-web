// Batch 45: runs the unchanged third-person held item transforms and writes public/research/held-pose-reference.json (see tools/probes/HeldPoseProbe.java):
// RenderPlayer.renderSpecials (bop.a), RenderBiped.renderEquippedItems (bnw.a), RenderWitch.renderEquippedItems (bpb.a) ending in the real ItemRenderer.renderItem (bly.a).
// GL is recorded by probes/gl/GL11.java; the stand-ins for Minecraft, RenderManager, the texture manager, texture helper, OpenGlHelper and authlib's GameProfile are in probes/held/.
// src/held-pose.test.js replays the record. Needs a JDK, the pinned client JAR (tools/research or MC_RESEARCH) and libs-1.7.10.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "held-pose-probe");
const clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), clientSha1);
const libDir = process.env.MC_PROBE_LIBS || path.join(research, "libs-1.7.10"), lib = (name) => path.join(libDir, `${name}.jar`);
await rm(out, { recursive: true, force: true });
const classes = path.join(out, "classes"), probe = path.join(out, "probe");
for (const d of [classes, probe]) await mkdir(d, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const cp = [probe, classes, lib("log4j-api-2.0-beta9"), lib("guava-15.0"), lib("commons-lang3-3.1"), lib("commons-io-2.4"), lib("gson-2.2.4"), lib("log4j-core-2.0-beta9")].join(path.delimiter);
const held = (f) => path.join(root, "probes/held", f);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/HeldPoseProbe.java"), held("bqf.java"), held("bnn.java"), held("bao.java"), held("bqi.java"), held("buu.java"), held("com/mojang/authlib/GameProfile.java"), path.join(root, "probes/gl/GL11.java")]);
const { stdout } = await exec("java", ["-cp", cp, "HeldPoseProbe"], { maxBuffer: 1 << 27 });
const data = JSON.parse(stdout.trim().split("\n").filter((l) => l.startsWith("{")).pop());
assert.equal(data.cases.length, 100);
const hashClass = async (id) => createHash("sha256").update((await exec("unzip", ["-p", jar, id + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { bop: "RenderPlayer", bnw: "RenderBiped", bpb: "RenderWitch", bly: "ItemRenderer", bix: "ModelRenderer", bhm: "ModelBiped", bim: "ModelWitch", add: "ItemStack", adb: "Item", bnn: "RenderManager (the probe shadows it)", bao: "Minecraft (the probe shadows it)", bqi: "texture helper (the probe shadows it)", buu: "OpenGlHelper (the probe shadows it)" };
await writeFile(path.join(root, "../public/research/held-pose-reference.json"), JSON.stringify({
  source: "tools/verify-held-pose.mjs: unchanged RenderPlayer.renderSpecials (bop.a(blg, float)), RenderBiped.renderEquippedItems (bnw.a(sw, float)) and RenderWitch.renderEquippedItems (bpb.a(yp, float)), ending in the real ItemRenderer.renderItem (bly.a(sv, add, int))",
  clientSha1, classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await hashClass(c) }]))),
  events: "[\"T\", x, y, z] glTranslatef, [\"R\", angle, x, y, z] glRotatef, [\"S\", x, y, z] glScalef, [\"P\"] push, [\"O\"] pop, [\"C\", r, g, b, a] colour, [\"B\", id] RenderBlocks.renderBlockAsItem of that block id (a marker: the executed block draw is item-render-reference.json), [\"D\", n] a Tessellator draw of n vertices (the sprite quads of renderItemIn2D). Every case starts with the model part's postRender (the arm at its rest angles, or the witch's nose) as plain T and R events; a child mob's model adds the 0.5 scale first.",
  cases: "who: player | biped | babyBiped | witch; id: the original item id; use: EntityPlayer.getItemInUseCount (a sword in use shows the blocking pose); cast: the player's fishing hook is out (renderSpecials swaps the held stack for a stick).",
  flags: "original item id -> [isFull3D, shouldRotateAroundOrigin, requiresMultipleRenderPasses]; only ids with a non-zero flag are kept in the test.",
  ...data,
}) + "\n");
console.log("Held pose cases:", data.cases.length, "items:", Object.keys(data.flags).length);
