// Records the unchanged 1.7.10 armour and bow enchantment effects for PROG-04b (see probes/ArmorEnchantmentProbe.java):
// applyPotionDamageCalculations with the shared EnchantmentHelper Random, Fire Protection burn time, Blast Protection
// knockback, Respiration air, Thorns hits and their armour wear, ItemBow Power/Punch/Flame/Infinity and ItemStack.hasEffect.
// Writes public/research/armor-enchantment-reference.json, replayed by src/armor-enchantments.test.js.
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
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/ArmorEnchantmentProbe.java")], { maxBuffer: 1 << 24 });
const { stdout } = await exec("java", ["-cp", cp, "ArmorEnchantmentProbe"], { maxBuffer: 1 << 28 });
const rows = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map(JSON.parse);
const all = (kind) => rows.filter((x) => x.kind === kind);
const counts = Object.fromEntries(["protection", "fire", "blast", "air", "thorns", "bow", "effect"].map((k) => [k, all(k).length]));
console.log(counts);
assert.equal(all("sources").length, 1);
assert.ok(counts.protection >= 900 && counts.fire >= 100 && counts.blast >= 50 && counts.air >= 40 && counts.thorns >= 150 && counts.bow >= 380 && counts.effect >= 150, "probe output");
const srgText = await readFile(path.join(research, "joined-1.7.10.srg"), "utf8"), mcp = {};
for (const m of srgText.matchAll(/^CL: (\S+) (\S+)$/gm)) mcp[m[1]] = m[2].split("/").pop();
const digest = async (c) => createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = ["sv", "sa", "afv", "agi", "agj", "agh", "afy", "abm", "zc", "ro", "rp", "add", "adb", "yz", "yx", "agb", "agd", "age", "afp", "afq", "afr"];
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1: CLIENT_SHA1,
  classes: Object.fromEntries(await Promise.all(names.map(async (c) => [c, { name: mcp[c], sha256: await digest(c) }]))),
  method:
    "Unchanged original classes after Block/Item registration. Doubles: constructor-less EntityLivingBase (exposes getLastActiveItems, records attackEntityFrom/playSound/renderBrokenItemStack), " +
    "constructor-less EntityPlayer with capabilities and a real InventoryPlayer, a World allocated without its constructor (blocks all air, spawnEntityInWorld captures the EntityArrow). " +
    "The static EnchantmentHelper Random is reseeded per case and its next int recorded. protection: EntityLivingBase.applyPotionDamageCalculations over 26 armour sets x 22 DamageSources x two amounts plus edge amounts. " +
    "fire: Entity.setFire(seconds). blast: EnchantmentProtection.func_92092_a. air: EntityLivingBase.decreaseAirSupply for 60 calls from 300. thorns: EnchantmentHelper.func_151384_a(wearer, attacker). " +
    "bow: ItemBow.onPlayerStoppedUsing (arrow damage, knockbackStrength, fire, canBePickedUp, isCritical, arrows left, bow damage). effect: ItemStack.hasEffect. " +
    "Not run: client rendering (RenderItem glint), EntityArrow.onUpdate hit path on a living target, EntitySkeleton enchanted bows, Resistance potion.",
  sources: all("sources")[0].rows,
  protection: all("protection").map((r) => r.row),
  fire: all("fire").map((r) => r.row),
  blast: all("blast").map((r) => r.row),
  air: all("air").map((r) => ({ row: r.row, next: r.next })),
  thorns: all("thorns").map((r) => r.row),
  bow: all("bow").map((r) => r.row),
  effect: all("effect").map((r) => r.row),
};
await writeFile(path.join(root, "../public/research/armor-enchantment-reference.json"), JSON.stringify(reference) + "\n");
console.log("Original armour/bow enchantment records:", Object.values(counts).reduce((a, b) => a + b, 0));
