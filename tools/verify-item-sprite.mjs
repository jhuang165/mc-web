// Batch 44: runs the unchanged 1.7.10 sprite item draws and writes public/research/item-sprite-reference.json:
//  - tools/probes/ItemSpriteProbe.java: ItemRenderer.renderItemIn2D (bly.a, static) with the real Tessellator, for several uv rectangles and icon sizes (the hand and the dropped item
//    both call it with thickness 0.0625);
//  - tools/probes/DroppedSpriteProbe.java: RenderItem's sprite-item path (bny private a(EntityItem, IIcon, int, float, float, float, float)) for stack sizes around the copy-count
//    thresholds, fancy and fast graphics, with stand-ins for the texture manager and the entity (probes/drop/*.java).
// GL calls are recorded by probes/gl/GL11.java. src/item-sprite.test.js replays the record. Needs a JDK, the pinned client JAR (tools/research or MC_RESEARCH) and libs-1.7.10.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "item-sprite-probe");
const clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), clientSha1);
const libDir = process.env.MC_PROBE_LIBS || path.join(research, "libs-1.7.10"), lib = (name) => path.join(libDir, `${name}.jar`);
await rm(out, { recursive: true, force: true });
const classes = path.join(out, "classes"), probe = path.join(out, "probe");
for (const d of [classes, probe]) await mkdir(d, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const cp = [probe, classes, lib("log4j-api-2.0-beta9"), lib("guava-15.0"), lib("commons-lang3-3.1"), lib("commons-io-2.4"), lib("gson-2.2.4"), lib("log4j-core-2.0-beta9")].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, ...["ItemSpriteProbe", "DroppedSpriteProbe"].map((n) => path.join(root, `probes/${n}.java`)), path.join(root, "probes/drop/bqf.java"), path.join(root, "probes/drop/xk.java"), path.join(root, "probes/drop/bnn.java"), path.join(root, "probes/gl/GL11.java")]);
const run = async (main) => { const { stdout } = await exec("java", ["-cp", cp, main], { maxBuffer: 1 << 27 }); return JSON.parse(stdout.trim().split("\n").filter((l) => l.startsWith("{")).pop()); };
const sprite = await run("ItemSpriteProbe"), dropped = await run("DroppedSpriteProbe");
assert.equal(sprite.cases.length, 4);
assert.equal(dropped.cases.length, 26);
const hashClass = async (id) => createHash("sha256").update((await exec("unzip", ["-p", jar, id + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { bly: "ItemRenderer", bny: "RenderItem", bmh: "Tessellator", bnn: "RenderManager (the probe shadows it)", bno: "Render", add: "ItemStack", xk: "EntityItem (the probe shadows it)", bqf: "TextureManager (the probe shadows it)" };
await writeFile(path.join(root, "../public/research/item-sprite-reference.json"), JSON.stringify({
  source: "tools/verify-item-sprite.mjs: unchanged ItemRenderer.renderItemIn2D (bly.a) and RenderItem's sprite-item path (bny.a(xk, rf, int, float, float, float, float)) with the real Tessellator",
  clientSha1, classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await hashClass(c) }]))),
  vertices: "events: [\"C\", r, g, b, a], [\"T\", x, y, z], [\"R\", angle, x, y, z], [\"P\"] push, [\"O\"] pop, [\"D\", n, [8 ints per vertex = x, y, z, u, v (float bits), colour, normal, brightness]]. sprite.cases: args = [f1, f2, f3, f4, width, height, thickness]. dropped: partial, viewYaw, age and hover are the entity values the probe set (angle = ((age + partial) / 20 + hover) * 57.29578); the icon is the whole texture (u, v 0..1).",
  sprite, dropped,
}) + "\n");
console.log(`${sprite.cases.length} sprite cases, ${dropped.cases.length} dropped cases`);
