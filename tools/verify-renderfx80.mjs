// Batch 80 renderfx80: runs tools/probes/RenderFx80Probe.java (unchanged TileEntityEndPortalRenderer bmt, RenderBlocks stem planes, RenderWitherSkull bpd
// with ModelSkeletonHead bib) against the headless GL11 / Sys stubs in tools/probes/renderfx80-stubs and writes public/research/renderfx80-reference.json.
// src/renderfx80-b80.test.js replays it. Needs a JDK, the pinned client JAR (tools/research or MC_RESEARCH) and libs-1.7.10.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "renderfx80-probe");
const clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), clientSha1);
const libDir = process.env.MC_PROBE_LIBS || path.join(research, "libs-1.7.10"), lib = (name) => path.join(libDir, `${name}.jar`);
await rm(out, { recursive: true, force: true });
const classes = path.join(out, "classes"), probe = path.join(out, "probe"), stub = path.join(out, "stub");
for (const d of [classes, probe, stub]) await mkdir(d, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const stubs = path.join(root, "probes/renderfx80-stubs/org/lwjgl");
await exec("javac", ["-nowarn", "-d", stub, path.join(stubs, "Sys.java"), path.join(stubs, "LWJGLException.java"), path.join(stubs, "opengl/GL11.java"), path.join(stubs, "opengl/OpenGLException.java"), path.join(stubs, "opengl/DisplayMode.java")]);
// The stubs come first and no LWJGL jar is on the path, so the game classes reach only the stubs.
const cp = [stub, probe, classes, lib("log4j-api-2.0-beta9"), lib("guava-15.0"), lib("commons-lang3-3.1"), lib("commons-io-2.4"), lib("gson-2.2.4")].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/RenderFx80Probe.java")]);
const { stdout, stderr } = await exec("java", ["-cp", cp, "RenderFx80Probe"], { maxBuffer: 1 << 28 });
if (process.env.PROBE_STDERR) console.error(stderr);
const records = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
const counts = {};
for (const r of records) counts[r.case] = (counts[r.case] ?? 0) + 1;
assert.deepEqual(counts, { stemBig: 128, stemSmall: 32, portal: 5, skull: 6, skullLists: 1, icons: 1 });
const hashClass = async (id) => createHash("sha256").update((await exec("unzip", ["-p", jar, id + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { bmt: "TileEntityEndPortalRenderer", bmh: "Tessellator", blm: "RenderBlocks", anu: "BlockStem", bpd: "RenderWitherSkull", bib: "ModelSkeletonHead", bix: "ModelRenderer", bis: "ModelBox", bao: "Minecraft" };
await writeFile(path.join(root, "../public/research/renderfx80-reference.json"), JSON.stringify({
  source: "tools/verify-renderfx80.mjs: unchanged bmt / blm stem methods / bpd + bib run against headless GL11 and Sys stubs (float matrix stacks, texgen and draw logging) with the real Tessellator",
  clientSha1, classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await hashClass(c) }]))),
  layout: "verts: [x, y, z, u, v, colour int (little-endian ABGR), normal int]; matrices: 16 column-major floats; GL enums as ints (texgen S/T/R/Q 8192-8195, TEXTURE_GEN_MODE 9472, OBJECT_PLANE 9473, EYE_PLANE 9474, OBJECT_LINEAR 9217, EYE_LINEAR 9216)",
  counts, records,
}) + "\n");
console.log(JSON.stringify(counts));
