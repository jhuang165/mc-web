// Batch 42: runs the unchanged RenderBlocks.renderBlockAsItem (blm.a(aji, meta, float)) for every block whose render type RenderBlocks.renderItemIn3d accepts, with the
// real Tessellator and a recording stand-in for LWJGL's GL11 (probes/gl/GL11.java). Writes public/research/item-render-reference.json: per (block id, metadata that differs
// from metadata 0) the ordered events: glTranslatef ["T", x, y, z], glRotatef ["R", angle, x, y, z], glColor4f ["C", r, g, b, a] and each Tessellator draw
// ["D", vertex count, [x, y, z, u, v (float bits), colour, normal, brightness per vertex]]. src/item-render.test.js compares the port's item boxes with it.
// Needs a JDK, the pinned client JAR (tools/research or MC_RESEARCH) and libs-1.7.10.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "item-render-probe");
const clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), clientSha1);
const libDir = process.env.MC_PROBE_LIBS || path.join(research, "libs-1.7.10"), lib = (name) => path.join(libDir, `${name}.jar`);
await rm(out, { recursive: true, force: true });
const classes = path.join(out, "classes"), probe = path.join(out, "probe");
for (const d of [classes, probe]) await mkdir(d, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const cp = [probe, classes, lib("log4j-api-2.0-beta9"), lib("guava-15.0"), lib("commons-lang3-3.1"), lib("commons-io-2.4"), lib("gson-2.2.4")].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/LightFloatProbe.java"), path.join(root, "probes/RenderTypes2Probe.java"), path.join(root, "probes/ItemRenderProbe.java"), path.join(root, "probes/gl/GL11.java")]);
const seed = 42;
const { stdout } = await exec("java", ["-cp", cp, "ItemRenderProbe", path.join(root, "../public/media/1.7.10/colormap/grass.png"), path.join(root, "../public/media/1.7.10/colormap/foliage.png"), String(seed)], { maxBuffer: 1 << 28 });
const data = JSON.parse(stdout.trim().split("\n").filter((l) => l.startsWith("{")).pop());
assert.ok(data.items.length >= 100 && data.failed.length <= 48);
const hashClass = async (id) => createHash("sha256").update((await exec("unzip", ["-p", jar, id + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { blm: "RenderBlocks", bmh: "Tessellator", aji: "Block", ahb: "World", ahl: "IBlockAccess", awt: "BlockLiquid" };
await writeFile(path.join(root, "../public/research/item-render-reference.json"), JSON.stringify({
  source: "tools/verify-render-types-pos.mjs: unchanged RenderBlocks.renderBlockByRenderType (blm.b) for render types other than 0 at other world positions, with the real Tessellator; World light (ahb.c(IIII)) over a cell map",
  clientSha1, seed, classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await hashClass(c) }]))),
  vertices: "8 ints each = x, y, z, u, v (float bits), colour int, normal int, brightness int; icons: names by index, u = 2*index + fraction; failed: items that threw (chests need a TileEntity renderer)",
  ...data,
}) + "\n");
console.log(`${data.items.length} items, failed ${data.failed.length}`);
