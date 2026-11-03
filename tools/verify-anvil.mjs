// Records unchanged 1.7.10 ContainerRepair (the anvil) behaviour; see probes/AnvilProbe.java.
// Requires the pinned client JAR, a JDK and the usual probe libraries.
// Writes public/research/anvil-reference.json, replayed by src/anvil.test.js.
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
for (const dir of researchDirs)
  if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "anvil-probe");
const CLIENT_SHA1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), CLIENT_SHA1);
async function library(prefix) {
  for (const p of (process.env.MC_PROBE_LIBS || "").split(path.delimiter).filter(Boolean))
    if (path.basename(p).startsWith(prefix)) return p;
  for (const dir of [
    path.join(os.homedir(), "Library/Application Support/minecraft/libraries"),
    path.join(os.homedir(), ".minecraft/libraries"),
    path.join(os.homedir(), ".gradle/caches"),
  ]) {
    if (!(await exists(dir))) continue;
    const { stdout } = await exec("find", [dir, "-name", prefix + "*.jar", "-not", "-name", "*sources*"], { maxBuffer: 1 << 24 });
    const hit = stdout.split("\n").filter(Boolean).sort()[0];
    if (hit) return hit;
  }
  throw new Error(`Missing ${prefix}*.jar; list library JARs in MC_PROBE_LIBS.`);
}
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "commons-io-", "authlib-", "netty-"].map(library));
// The signed JAR is not launched; its unchanged classes are copied unsigned so the probe shares the default package.
const classes = path.join(out, "classes");
await rm(classes, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
// StatCollector reads /assets/minecraft/lang/en_US.lang from the classpath; the JAR does not ship it. An empty
// table makes ItemStack.getDisplayName fall back to the unlocalised key (e.g. "item.swordDiamond.name"), which is
// enough to exercise the anvil's "new name equals current name" comparison without bundling language assets.
await mkdir(path.join(classes, "assets/minecraft/lang"), { recursive: true });
await writeFile(path.join(classes, "assets/minecraft/lang/en_US.lang"), "# empty on purpose\n");
const probe = path.join(out, "probe");
await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/AnvilProbe.java")]);
const { stdout } = await exec("java", ["-cp", cp, "AnvilProbe"], { maxBuffer: 1 << 28 });
const rows = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
const one = (kind) => { const r = rows.filter((x) => x.kind === kind); assert.equal(r.length, 1, kind); return r[0]; };
const all = (kind) => rows.filter((x) => x.kind === kind).map(({ kind: _, ...rest }) => (Object.keys(rest).length === 1 && rest.row ? rest.row : rest));


const statics = one("statics");
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) (\S+)$/gm)) mcp[m[1]] = m[2].split("/").pop();
const classNames = ["zu", "zv", "zw", "add", "afv", "aft", "acm", "adb", "abb", "acg", "aeh", "abf", "dh", "dq", "aay", "rh", "yz", "yx", "ahb", "aji", "ajb", "ajn"];
const classHashes = {};
for (const c of classNames) {
  const { stdout: cls } = await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 });
  classHashes[c] = { name: mcp[c] || c, sha256: createHash("sha256").update(cls).digest("hex") };
}
const counts = Object.fromEntries(["repair", "material", "conflict", "block", "roll"].map((k) => [k, all(k).length]));
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1: CLIENT_SHA1,
  srgSha256: createHash("sha256").update(srgText).digest("hex"),
  jvm: String((await exec("java", ["-XshowSettings:properties", "-version"])).stderr).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method:
    "Unchanged ContainerRepair (zu), its output slot (zw), input inventory (zv), ItemStack, EnchantmentHelper, the enchantment registry, ItemEnchantedBook and the NBT classes, run in a JVM after Block/Item registration. " +
    "The container is built with its real constructor. Doubles: a constructor-less EntityPlayer carrying capabilities, experience fields and a seeded Entity.rand, and a World exposing one anvil cell (getBlock, getBlockMetadata, " +
    "setBlockMetadataWithNotify, setBlockToAir, playAuxSFX logged). Each repair row: put left, put right, send the name (when set), read the output slot, maximumCost and stackSizeToBeUsedInRepair, then " +
    "SlotRepairOutput.canTakeStack at a recorded experience level and, for a subset, onPickupFromSlot. Row layout: [left, right, name, creative, remote, anvilMeta, seed, level, experienceTotal, output, maximumCost, " +
    "stackSizeToBeUsedInRepair, canTake, take] with stacks [id, count, damage, ench, stored, unbreakable, RepairCost, customName] and take [input1, level, total, progress, worldEvents, anvilMeta, maximumCost, input0, nextInt]. " +
    "Localisation: the JAR carries no en_US.lang, so ItemStack.getDisplayName of an unnamed stack is its unlocalised key (names table); the replay supplies the same table. " +
    "Not covered: GUI, packets (MC|ItemName filtering), shift-click merging (transferStackInSlot), rendering and sounds beyond the playAuxSFX ids.",
  classes: classHashes,
  items: statics.items,
  materials: statics.materials,
  names: statics.names,
  counts,
  repair: all("repair"),
  material: all("material"),
  conflict: all("conflict"),
  block: all("block"),
  roll: all("roll"),
};
const outFile = path.join(root, "../public/research/anvil-reference.json");
await writeFile(outFile, JSON.stringify(reference) + "\n");
console.log("Original anvil records:", counts, "total", Object.values(counts).reduce((a, b) => a + b, 0), "bytes", (await readFile(outFile)).length);
