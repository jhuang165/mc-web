// Runs the unchanged TextureUtil.anaglyphColor (bqi.a(int[])) of the 1.7.10 client over every GUI-side texture of the original jar
// (gui/, items/, misc/, entity/steve + chests, blocks/dirt) read as TextureUtil.func_110986_a does (ImageIO.read + getRGB), and writes
// public/research/anaglyph-gui-reference.json: per texture the SHA-1 of the raw and converted ARGB arrays. src/anaglyph-gui.test.js
// decodes the shipped PNGs and checks the port's conversion hash for hash. Needs a JDK, the pinned client JAR (tools/research or
// MC_RESEARCH) and its libs-1.7.10 folder (or MC_PROBE_LIBS): guava, log4j-api, commons-lang3, commons-io, gson, lwjgl.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "anaglyph3-probe");
const clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), clientSha1);
const libDir = process.env.MC_PROBE_LIBS || path.join(research, "libs-1.7.10");
const lib = (name) => path.join(libDir, `${name}.jar`);
await rm(out, { recursive: true, force: true });
const classes = path.join(out, "classes"), lwjgl = path.join(out, "lwjgl"), probe = path.join(out, "probe");
for (const d of [classes, lwjgl, probe]) await mkdir(d, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
await exec("unzip", ["-q", "-o", lib("lwjgl-2.9.2-nightly-20140822"), "*.class", "-d", lwjgl], { maxBuffer: 1 << 24 });
await rm(path.join(lwjgl, "org/lwjgl/opengl/GL11.class"), { force: true });
await exec("javac", ["-nowarn", "-d", lwjgl, path.join(root, "probes/stubs/org/lwjgl/opengl/GL11.java")]);
const cp = [probe, classes, lwjgl, lib("log4j-api-2.0-beta9"), lib("guava-15.0"), lib("commons-lang3-3.1"), lib("commons-io-2.4"), lib("gson-2.2.4")].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/Anaglyph3Probe.java")]);
const { stdout: list } = await exec("unzip", ["-Z1", jar], { maxBuffer: 1 << 24 });
const names = list.split("\n").filter((n) => /^assets\/minecraft\/textures\/(gui\/.*|items\/.*|misc\/.*|entity\/(steve|chest\/.*)|blocks\/dirt)\.png$/.test(n)).map((n) => n.slice("assets/minecraft/textures/".length)).sort();
const { stdout } = await exec("java", [`-Djar=${jar}`, "-cp", cp, "Anaglyph3Probe", ...names], { maxBuffer: 1 << 26 });
const textures = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
assert.equal(textures.length, names.length);
await writeFile(path.join(root, "../public/research/anaglyph-gui-reference.json"), JSON.stringify({
  source: "tools/verify-anaglyph-gui.mjs: unchanged bqi.a(int[]) (TextureUtil.anaglyphColor) run over jar textures read with ImageIO.getRGB",
  clientSha1, textures: textures.map(({ name, w, h, type, translucent, raw, conv, first }) => ({ name, w, h, type, translucent, raw, conv, first })),
}, null, 1) + "\n");
console.log(`${textures.length} textures, ${textures.filter((t) => t.translucent).length} with translucent pixels`);
