// Runs the unchanged FontRenderer (bbu) and Locale (brs) classes of the 1.7.10 client JAR through tools/probes/LanguageProbe.java
// and compares every character width (both unicode flags), sample string widths, the lang parser, the en_US fallback order and
// the unicode threshold with src/font-renderer.js and src/lang.js. Writes public/research/languages-reference.json (read by
// src/languages.test.js). Installed languages (npm run lang:fetch) are checked too and their unicode flags recorded. Needs a JDK,
// the pinned client JAR and the guava / log4j-api / commons-lang3 / commons-io / netty-all JARs.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { font, getCharWidth, getStringWidth, readFontWidths } from "../src/font-renderer.js";
import { DEFAULT_CHAR_WIDTHS } from "../src/font-widths.js";
import { parseLang, mergeLocale, formatLang } from "../src/lang.js";
import { readPng } from "./png-rgba.mjs";

const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
const researchDirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "language-probe"), clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), clientSha1);
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || "").split(path.delimiter).filter(Boolean)) if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [path.join(research, "libs-1.7.10"), path.join(os.homedir(), "Library/Application Support/minecraft/libraries"), path.join(os.homedir(), ".minecraft/libraries"), path.join(os.homedir(), ".gradle/caches")]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec("find", [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"], { maxBuffer: 1 << 24 });
    const hit = stdout.split("\n").filter(Boolean).sort()[0];
    if (hit) return hit;
  }
  throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "netty-all-", "commons-io-", "icu4j-core-mojang-"].map((p) => library(p).catch(() => null)));
const classes = path.join(out, "classes"), probe = path.join(out, "probe");
await rm(out, { recursive: true, force: true });
await mkdir(classes, { recursive: true }); await mkdir(probe, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "assets/minecraft/lang/en_US.lang", "assets/minecraft/font/glyph_sizes.bin", "assets/minecraft/textures/font/ascii.png", "-d", classes], { maxBuffer: 1 << 24 });
const cp = [probe, classes, ...libs.filter(Boolean)].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/LanguageProbe.java")]);
const langDir = path.join(root, "../public/lang/1.7.10"), haveLangs = await exists(path.join(langDir, "manifest.json"));
const { stdout } = await exec("java", ["-cp", cp, "LanguageProbe", classes, ...(haveLangs ? [langDir] : [])], { maxBuffer: 1 << 29 });
const rows = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));

// ---- Fonts ----
const glyphBytes = await readFile(path.join(classes, "assets/minecraft/font/glyph_sizes.bin"));
assert.equal(glyphBytes.length, 65536);
assert.deepEqual(glyphBytes, await readFile(path.join(root, "../public/media/1.7.10/font/glyph_sizes.bin")));
font.glyphSizes = new Int8Array(glyphBytes.buffer, glyphBytes.byteOffset, 65536);
const png = readPng(await readFile(path.join(classes, "assets/minecraft/textures/font/ascii.png")));
const widths = readFontWidths(png.data, png.width, png.height);
assert.deepEqual(widths, DEFAULT_CHAR_WIDTHS, "font-widths.js is stale (regenerate)");
const fontRows = rows.filter((r) => r.font), fontRef = [];
for (const r of fontRows) {
  const state = { unicode: r.unicode, widths, glyphSizes: font.glyphSizes };
  for (let c = 0; c < 65536; c++) assert.equal(getCharWidth(c, state), r.all[c], `char ${c} unicode=${r.unicode}`);
  for (const [s, w] of r.samples) assert.equal(getStringWidth(s, state), w, JSON.stringify(s));
  fontRef.push({ unicode: r.unicode, widthsSha256: r.widthsSha256, first256: r.first256, samples: r.samples });
}
// ---- Locale ----
const cases = rows.filter((r) => r.locale), localeRef = [];
const fixtureOf = {};
for (const c of cases) {
  const expected = Object.fromEntries(c.entries);
  localeRef.push({ name: c.locale, codes: c.codes, unicode: c.unicode, entries: c.entries });
  fixtureOf[c.locale] = c;
}
const real = rows.filter((r) => r.real).map((r) => ({ code: r.real, unicode: r.unicode, keys: r.keys }));
if (haveLangs) {
  const { EN_US } = await import("../src/lang-en-us.js");
  for (const r of real) {
    const { table, unicode } = mergeLocale([EN_US, await readFile(path.join(langDir, r.code + ".lang"), "utf8")]);
    assert.equal(unicode, r.unicode, r.code);
    assert.equal(Object.keys(table).length, r.keys, r.code + " key count");
  }
}
console.log(`font: ${fontRows.length} flags x 65536 widths, ${fontRows[0].samples.length} strings; locale: ${cases.length} cases; real languages: ${real.length}`);
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1,
  method: "tools/probes/LanguageProbe.java runs the unchanged FontRenderer (bbu: getCharWidth a(char), getStringWidth a(String)) and Locale (brs: loadLocaleDataFiles, parser, checkUnicode) against test doubles for Minecraft (bao), GameSettings (bbj), TextureManager (bqf) and the resource manager (bqy). Every char width 0-65535 for both unicode flags and the sample strings equal font-renderer.js; fixtures of the parser, the fallback order and the unicode threshold are recorded as the original's merged tables.",
  glyphSizesSha1: createHash("sha1").update(glyphBytes).digest("hex"),
  font: fontRef, locale: localeRef, real,
};
// The locale fixtures are replayed here against lang.js with the same sources the probe used.
const FX = {
  fx_base: "# comment\n\nplain=Hello\nnovalue\nk=v=w\nnum=%d items\nfmt=%2$.1f of %1$d\nfmts=%s and %1$s\nempty=\n=emptykey\n #notcomment=1\ncrlf=line\r\nuni=あい\nperc=100%% done\n",
  fx_over: "a=Hello\nb=World\n", fx_ovr: "a=Override\nc=Extra\n",
};
for (const [r, ratio] of [["ratio-0pct", [100, 0]], ["ratio-9pct", [91, 9]], ["ratio-exact10pct", [90, 10]], ["ratio-11pct", [89, 11]], ["ratio-1pct", [99, 1]]]) FX[r] = "k=" + "x".repeat(ratio[0]) + "あ".repeat(ratio[1]) + "\n";
for (const c of cases) {
  const { table, unicode } = mergeLocale(c.codes.map((code) => FX[code]));
  assert.equal(unicode, c.unicode, c.locale);
  assert.deepEqual(Object.entries(table).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)), c.entries, c.locale);
}
await writeFile(path.join(root, "../public/research/languages-reference.json"), JSON.stringify(reference) + "\n");
console.log("PASS: font widths and the Locale rules match the original bytecode.");
