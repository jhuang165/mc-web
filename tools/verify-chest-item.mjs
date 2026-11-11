// Batch 43: runs the unchanged chest item path (tools/probes/ChestItemProbe.java: RenderBlocks.renderBlockAsItem type 22 -> TileEntityRendererChestHelper ->
// TileEntityChestRenderer -> ModelChest -> ModelRenderer boxes -> Tessellator, GL calls recorded by probes/gl/GL11.java) and writes public/research/chest-item-reference.json.
// src/chest-item-model.test.js replays it. Needs a JDK, the pinned client JAR (tools/research or MC_RESEARCH) and libs-1.7.10.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "chest-item-probe");
const clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), clientSha1);
const libDir = process.env.MC_PROBE_LIBS || path.join(research, "libs-1.7.10"), lib = (name) => path.join(libDir, `${name}.jar`);
await rm(out, { recursive: true, force: true });
const classes = path.join(out, "classes"), probe = path.join(out, "probe");
for (const d of [classes, probe]) await mkdir(d, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const cp = [probe, classes, lib("log4j-api-2.0-beta9"), lib("guava-15.0"), lib("commons-lang3-3.1"), lib("commons-io-2.4"), lib("gson-2.2.4")].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, ...["LightFloatProbe", "RenderTypes2Probe", "ChestItemProbe"].map((n) => path.join(root, `probes/${n}.java`)), path.join(root, "probes/gl/GL11.java")]);
const { stdout } = await exec("java", ["-cp", cp, "ChestItemProbe"], { maxBuffer: 1 << 26 });
const data = JSON.parse(stdout.trim().split("\n").filter((l) => l.startsWith("{")).pop());
assert.equal(data.items.length, 3);
const hashClass = async (id) => createHash("sha256").update((await exec("unzip", ["-p", jar, id + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { blm: "RenderBlocks", bls: "TileEntityRendererChestHelper", bmk: "TileEntityRendererDispatcher", bmm: "TileEntityChestRenderer", bhg: "ModelChest", bix: "ModelRenderer", bmh: "Tessellator" };
await writeFile(path.join(root, "../public/research/chest-item-reference.json"), JSON.stringify({
  source: "tools/verify-chest-item.mjs: unchanged RenderBlocks.renderBlockAsItem (blm.a) for the chest family (blocks 54, 146, 130, render type 22) through TileEntityRendererChestHelper and the real ModelChest / ModelRenderer / Tessellator",
  clientSha1, classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await hashClass(c) }]))),
  vertices: "events: [\"C\", r, g, b, a], [\"T\", x, y, z], [\"R\", angle, x, y, z], [\"S\", x, y, z], [\"P\"] push, [\"O\"] pop, [\"D\", n, [8 ints per vertex = x, y, z, u, v (float bits; u and v are fractions of the 64x64 chest texture), colour, normal, brightness]]. The texture is not bound (no texture manager); the renderer picks ender, trapped, normal or christmas by its bytecode.",
  ...data,
}) + "\n");
console.log("3 chest items recorded");
