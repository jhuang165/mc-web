// Batch 40: runs the unchanged 1.7.10 RenderBlocks (blm.b) over slab, stair, farmland, soul sand and plant neighbourhoods built to reach Block.getMixedBrightnessForBlock
// (aji.c(ahl, x, y, z): a BlockSlab whose brightness is 0 reads the cell below) with the real Tessellator (bmh), three ambient-occlusion settings, and writes
// public/research/slab-light-reference.json (cells: original ids, metadata, raw sky and block light; vertices: position, colour int, brightness int).
// src/slab-light.test.js replays them through the mesher. Needs a JDK, the pinned client JAR (tools/research or MC_RESEARCH) and libs-1.7.10.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "slab-light-probe");
const clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), clientSha1);
const libDir = process.env.MC_PROBE_LIBS || path.join(research, "libs-1.7.10"), lib = (name) => path.join(libDir, `${name}.jar`);
await rm(out, { recursive: true, force: true });
const classes = path.join(out, "classes"), probe = path.join(out, "probe");
for (const d of [classes, probe]) await mkdir(d, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const cp = [probe, classes, lib("log4j-api-2.0-beta9"), lib("guava-15.0"), lib("commons-lang3-3.1"), lib("commons-io-2.4"), lib("gson-2.2.4")].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/SlabLightProbe.java")]);
const seed = 40;
const { stdout } = await exec("java", ["-cp", cp, "SlabLightProbe", path.join(root, "../public/media/1.7.10/colormap/grass.png"), path.join(root, "../public/media/1.7.10/colormap/foliage.png"), String(seed)], { maxBuffer: 1 << 28 });
const data = JSON.parse(stdout.trim().split("\n").filter((l) => l.startsWith("{")).pop());
assert.ok(data.fixtures.length >= 300);
const hashClass = async (id) => createHash("sha256").update((await exec("unzip", ["-p", jar, id + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { blm: "RenderBlocks", bmh: "Tessellator", aji: "Block", ahb: "World", ahl: "IBlockAccess" };
await writeFile(path.join(root, "../public/research/slab-light-reference.json"), JSON.stringify({
  source: "tools/verify-slab-light.mjs: unchanged RenderBlocks.renderBlockByRenderType (blm.b) on slab, stair, farmland and neighbour-brightness blocks with the real Tessellator; World light (ahb.c(IIII)) over a cell map",
  clientSha1, seed, classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await hashClass(c) }]))),
  cells: "5x5x5 around the block, index ((dx+2)*5+(dy+2))*5+(dz+2); light = sky*16+block (raw); vertices: x,y,z (1/64 block from the block origin), colour int (Tessellator layout, little-endian ABGR), brightness int",
  ...data,
}) + "\n");
console.log(`${data.fixtures.length} fixtures, ${data.fixtures.reduce((n, f) => n + f.ao.reduce((m, a) => m + a.length / 5, 0), 0)} vertices`);
