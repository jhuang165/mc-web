// Records the unchanged 1.7.10 Thorns armour wear with Unbreaking 0-III (batch 21 combat3, probes/ThornsWearProbe.java, which reuses
// ArmorEnchantmentProbe's doubles). Writes public/research/thorns-wear-reference.json, replayed by src/thorns-wear.test.js.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "armor-enchantment-probe");
const CLIENT_SHA1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), CLIENT_SHA1);
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
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "authlib-", "netty-"].map(library));
const classes = path.join(out, "classes");
await rm(classes, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const probe = path.join(out, "probe");
await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/ArmorEnchantmentProbe.java"), path.join(root, "probes/ThornsWearProbe.java")], { maxBuffer: 1 << 24 });
const { stdout } = await exec("java", ["-cp", cp, "ThornsWearProbe"], { maxBuffer: 1 << 28 });
const all = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
const rows = all.filter((r) => r.kind === "thornswear").map((r) => r.row), ghosts = all.filter((r) => r.kind === "ghost").map((r) => r.row);
assert.ok(rows.length >= 2500, "probe output " + rows.length);
const digest = async (c) => createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { sv: "EntityLivingBase", sa: "Entity", yz: "EntityPlayer", afv: "EnchantmentHelper", agj: "EnchantmentThorns", add: "ItemStack" };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1: CLIENT_SHA1,
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method:
    "EnchantmentHelper.func_151384_a(wearer, attacker) on the unchanged classes: Thorns I-III x Unbreaking 0-III on one piece (leather/diamond chestplate, leggings-free boots/helmet) at damage 0, max-3, max-1 and max, " +
    "for a non-player wearer with five equipment stacks (mob), a survival EntityPlayer and a Creative one, plus two-Thorns-piece cases. Each row: [wearer, thorns, unbreaking, before, seed, attackerLog, wearerLog (renderBrokenItemStack), after, next int of the wearer Random, thorns2, unbreaking2].",
  rows,
  ghostMethod: "Each ghost row: [wearer, thorns, seed1, seed2, attackerLog1, [stackSize, damage] after the first reaction (damage = max, so it breaks), wearerLog, attackerLog2 of a second reaction, [stackSize, damage] after it]",
  ghosts,
};
await writeFile(path.join(root, "../public/research/thorns-wear-reference.json"), JSON.stringify(reference) + "\n");
console.log("Thorns wear records:", rows.length, "ghost rows:", ghosts.length);
