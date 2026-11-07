// Runs the unchanged FontRenderer (bbu) through tools/probes/SignFontProbe.java for sign lines (getStringWidth and the centred x
// TileEntitySignRenderer passes to drawString, with both unicode flags) and compares src/font-renderer.js. Writes
// public/research/sign-font-reference.json (replayed by src/sign-font.test.js). Needs a JDK, the pinned client JAR and the library JARs.
// Compiled output goes to <research>/signfont/. The probe executes only the FontRenderer widths; the GL drawing (glyph quads,
// TileEntitySignRenderer, GuiEditSign.drawScreen) is bytecode-read, not executed.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { font, getStringWidth, readFontWidths } from "../src/font-renderer.js";
import { readPng } from "./png-rgba.mjs";

const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
const researchDirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "signfont"), clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), clientSha1);
async function library(prefix) {
  for (const dir of [path.join(research, "libs-1.7.10"), path.join(os.homedir(), "Library/Application Support/minecraft/libraries")]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec("find", [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"], { maxBuffer: 1 << 24 });
    const hit = stdout.split("\n").filter(Boolean).sort()[0];
    if (hit) return hit;
  }
  return null;
}
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "netty-all-", "commons-io-", "icu4j-core-mojang-"].map(library));
const classes = path.join(out, "classes"), probe = path.join(out, "probe");
await rm(out, { recursive: true, force: true });
await mkdir(classes, { recursive: true }); await mkdir(probe, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "assets/minecraft/font/glyph_sizes.bin", "assets/minecraft/textures/font/ascii.png", "-d", classes], { maxBuffer: 1 << 24 });
const cp = [probe, classes, ...libs.filter(Boolean)].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/SignFontProbe.java")]);
const { stdout } = await exec("java", ["-cp", cp, "SignFontProbe", classes], { maxBuffer: 1 << 26 });
const rows = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
const glyph = await readFile(path.join(classes, "assets/minecraft/font/glyph_sizes.bin"));
font.glyphSizes = new Int8Array(glyph.buffer, glyph.byteOffset, 65536);
const png = readPng(await readFile(path.join(classes, "assets/minecraft/textures/font/ascii.png")));
const widths = readFontWidths(png.data, png.width, png.height);
for (const r of rows) for (const [s, w, x] of r.lines) {
  assert.equal(getStringWidth(s, { unicode: r.unicode, widths, glyphSizes: font.glyphSizes }), w, JSON.stringify(s));
  assert.equal(0 - Math.trunc(w / 2) + 0, x);
}
await writeFile(path.join(root, "../public/research/sign-font-reference.json"), JSON.stringify({
  target: "Minecraft Java 1.7.10", clientSha1,
  method: "tools/probes/SignFontProbe.java runs the unchanged FontRenderer (bbu.a(String) = getStringWidth) with both unicode flags over sign lines (including the '> text <' edit markers) and records width and the centred x = -(width / 2) of TileEntitySignRenderer's drawString. Glyph drawing is bytecode-read, not executed.",
  rows,
}) + "\n");
console.log(`PASS: ${rows.length} flags x ${rows[0].lines.length} sign lines match the original FontRenderer.`);
