// Compiles and runs tools/probes/FontStyleProbe.java (the unchanged FontRenderer bbu with recording GL stand-ins and the ICU4J
// Bidi/ArabicShaping of the 1.7.10 client libraries). Shared by gen-bidi-data.mjs and verify-font-style.mjs.
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
export const researchDirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "fontstyle");
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), "e80d9b3bf5085002218d4be59e668bac718abbc6");
async function library(prefix) {
  for (const dir of [path.join(research, "libs-1.7.10"), path.join(os.homedir(), "Library/Application Support/minecraft/libraries")]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec("find", [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"], { maxBuffer: 1 << 24 });
    const hit = stdout.split("\n").filter(Boolean).sort()[0];
    if (hit) return hit;
  }
  return null;
}
let prepared;
async function prepare() {
  const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "netty-all-", "commons-io-", "icu4j-core-mojang-"].map(library));
  const classes = path.join(out, "classes"), probe = path.join(out, "probe");
  await rm(out, { recursive: true, force: true });
  await mkdir(classes, { recursive: true }); await mkdir(probe, { recursive: true });
  await exec("unzip", ["-q", "-o", jar, "*.class", "assets/minecraft/font/glyph_sizes.bin", "assets/minecraft/textures/font/ascii.png", "-d", classes], { maxBuffer: 1 << 24 });
  const cp = [probe, classes, ...libs.filter(Boolean)].join(path.delimiter);
  const src = path.join(root, "probes");
  await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(src, "FontStyleProbe.java"), path.join(src, "fontstyle-stubs/bmh.java"), path.join(src, "fontstyle-stubs/org/lwjgl/opengl/GL11.java")]);
  return { cp, classes };
}
export const extracted = async () => (prepared ??= prepare());
/** Runs a probe mode; `input` (string) goes to stdin. Resolves with stdout. */
export async function runProbe(mode, input = "") {
  const { cp, classes } = await extracted();
  return new Promise((resolve, reject) => {
    const p = spawn("java", ["-cp", cp, "FontStyleProbe", mode, classes], { stdio: ["pipe", "pipe", "inherit"] });
    let buf = "";
    p.stdout.setEncoding("utf8");
    p.stdout.on("data", (d) => { buf += d; });
    p.on("close", (code) => (code === 0 ? resolve(buf) : reject(new Error(`probe ${mode} exited ${code}`))));
    p.stdin.end(input);
  });
}
export const classesDir = async () => (await extracted()).classes;
