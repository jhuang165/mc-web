// Records unchanged 1.7.10 enchantment registry, EnchantmentHelper and ContainerEnchantment behaviour;
// see probes/EnchantmentProbe.java. Requires the pinned client JAR, a JDK and the usual probe libraries.
// Writes public/research/enchantment-reference.json, replayed by src/enchantments.test.js.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "enchantment-probe");
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
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "authlib-", "netty-"].map(library));
// The signed JAR is not launched; its unchanged classes are copied unsigned so the probe shares the default package.
const classes = path.join(out, "classes");
await rm(classes, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const probe = path.join(out, "probe");
await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/EnchantmentProbe.java")]);
const { stdout } = await exec("java", ["-cp", cp, "EnchantmentProbe"], { maxBuffer: 1 << 28 });
const rows = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
const one = (kind) => { const r = rows.filter((x) => x.kind === kind); assert.equal(r.length, 1, kind); return r[0]; };
const all = (kind) => rows.filter((x) => x.kind === kind).map(({ kind: _, ...rest }) => (Object.keys(rest).length === 1 && rest.row ? rest.row : rest));

const registry = all("enchantment");
assert.equal(registry.length, 24);
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) (\S+)$/gm)) mcp[m[1]] = m[2].split("/").pop();
for (const e of registry) e.class = mcp[e.class] || e.class;
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1: CLIENT_SHA1,
  srgSha256: createHash("sha256").update(srgText).digest("hex"),
  jvm: String((await exec("java", ["-XshowSettings:properties", "-version"])).stderr).match(/java\.version = (\S+)/)?.[1] || "unknown",
  method:
    "Unchanged Enchantment subclasses, EnumEnchantmentType, EnchantmentHelper, EnchantmentData, WeightedRandom, ItemEnchantedBook, ItemStack and ContainerEnchantment after Block/Item registration. " +
    "Doubles: constructor-less World whose getBlock reads a 5x2x5 fixture around the table (native isAirBlock), constructor-less EntityPlayer with experience fields and capabilities only, " +
    "constructor-less EntityLivingBase exposing held item, last-active items and creature attribute. The static EnchantmentHelper Random and the container Random are reseeded by reflection. " +
    "All case inputs are printed with each record. HashMap iteration order is that of the recording JVM (Java 8+ HashMap; small Integer keys hash to themselves). " +
    "Records: registry, item applicability over every registered item, slot levels, mapEnchantmentData, buildEnchantmentList/addRandomEnchantment, table sequences, armour damage modifier, " +
    "living modifier, entity getters, unbreaking damage skips, thorns rolls and NBT helpers. Not covered: rendering, GUI, packets, sounds and entity side effects (thorns damage, bane slowness, fire aspect, knockback motion).",
  classes: Object.fromEntries(await Promise.all(
    ["aft", "afu", "afv", "agc", "aag", "aah", "aai", "acm", "abk", "add", "adb", "qv", "ro", "afm", "afn", "afo", "afp", "afq", "afr", "afs", "agd", "age", "agf", "agg", "agh", "agi", "agj", "agk", "agl", "yz", "ahb"].map(async (c) => [c, {
      name: mcp[c],
      sha256: createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex"),
    }]),
  )),
  types: one("types").names,
  bookList: one("bookList").ids,
  sources: one("sources").rows,
  registry,
  items: all("item"),
  variants: all("variant"),
  slots: all("slots"),
  maps: all("map"),
  build: all("build"),
  addRandom: all("addRandom"),
  table: all("table"),
  damage: all("damage"),
  living: all("living"),
  getters: all("getters"),
  unbreaking: all("unbreaking"),
  negate: all("negate"),
  thorns: all("thorns"),
  nbt: all("nbt"),
};
await writeFile(path.join(root, "../public/research/enchantment-reference.json"), JSON.stringify(reference) + "\n");
const counts = Object.fromEntries(Object.entries(reference).filter(([, v]) => Array.isArray(v) && typeof v[0] === "object").map(([k, v]) => [k, v.length]));
console.log("Original enchantment records:", counts, "total", Object.values(counts).reduce((a, b) => a + b, 0));
