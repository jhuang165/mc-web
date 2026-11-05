// Drives the unchanged original BlockChest (ajx, chest 54 and trapped chest 146), BlockEnderChest (akv, 130),
// TileEntityChest (aow), TileEntityEnderChest (ape) and InventoryEnderChest (aav) through tools/probes/ChestsProbe.java
// (RedstoneProbe World/Chunk fixture) and writes public/research/chests-reference.json for src/chests.test.js.
// Needs a JDK, the pinned client JAR (tools/research or MC_RESEARCH) and the guava / log4j-api / commons-lang3 / netty-all JARs.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const exec = promisify(execFile),
  root = path.dirname(fileURLToPath(import.meta.url)),
  exists = (p) => access(p).then(() => true, () => false);
const researchDirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "redstone-probe"), clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), clientSha1);
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || "").split(path.delimiter).filter(Boolean)) if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [path.join(os.homedir(), "Library/Application Support/minecraft/libraries"), path.join(os.homedir(), ".minecraft/libraries"), path.join(os.homedir(), ".gradle/caches")]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec("find", [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"], { maxBuffer: 1 << 24 });
    const hit = stdout.split("\n").filter(Boolean).sort()[0];
    if (hit) return hit;
  }
  throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "authlib-", "netty-all-"].map(library));
const classes = path.join(out, "classes");
if (!(await exists(path.join(classes, "ahb.class")))) {
  await mkdir(classes, { recursive: true });
  await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
}
const probe = path.join(out, "chests-probe");
await rm(probe, { recursive: true, force: true });
await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/RedstoneProbe.java"), path.join(root, "probes/HopperProbe.java"), path.join(root, "probes/ChestsProbe.java")], { maxBuffer: 1 << 24 });
const { stdout, stderr } = await exec("java", ["-cp", cp, "ChestsProbe"], { maxBuffer: 1 << 28 });
if (stderr.trim()) console.error(stderr.trim().split("\n").slice(0, 5).join("\n"));
const lines = stdout.trim().split("\n").map((l) => JSON.parse(l)), facts = lines.shift();
assert.equal(facts.kind, "facts");
const counts = {};
for (const l of lines) counts[l.kind] = (counts[l.kind] || 0) + 1;
const digest = async (name) => createHash("sha256").update((await exec("unzip", ["-p", jar, name + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { ajx: "BlockChest", akv: "BlockEnderChest", aow: "TileEntityChest", ape: "TileEntityEnderChest", aav: "InventoryEnderChest", aji: "Block", ahb: "World" };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1,
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method:
    "Unchanged BlockChest (ajx), BlockEnderChest (akv), TileEntityChest (aow), TileEntityEnderChest (ape) and InventoryEnderChest (aav) run in the RedstoneProbe World/Chunk fixture. Records: facts (hardness, resistance, light, opacity, drops, silk, bounds), pair (random placements/covers: metadata, pairing, opened inventory), power (viewer counts 0..17), ender (opening refusal per cover), enderNbt (inventory round trips), lid (tile updateEntity steps and sounds), display (portal particle arguments).",
  facts,
  counts,
  records: lines,
};
await writeFile(path.join(root, "../public/research/chests-reference.json"), JSON.stringify(reference) + "\n");
console.log(`PASS: ${lines.length} records`, JSON.stringify(counts));
