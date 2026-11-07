// Records what a zero-size armour stack (left in the slot when Thorns wear breaks a piece) does on a real EntityPlayer: armour value, Protection roll,
// NBT write/read and InventoryPlayer.damageArmor (batch 22 villagers4, probes/ZeroArmourStackProbe.java). Writes public/research/zero-armour-stack-reference.json, replayed by src/zero-armour-stack.test.js.
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
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "authlib-1.5", "netty-all-", "gson-", "commons-io-", "commons-codec-", "jopt-simple-"].map(library));
const classes = path.join(out, "classes");
await rm(classes, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const probe = path.join(out, "probe");
await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, ...["MobMoveProbe","ArmorEnchantmentProbe","ThornsWearProbe","ZeroArmourStackProbe"].map((n) => path.join(root, `probes/${n}.java`))], { maxBuffer: 1 << 24 });
const { stdout } = await exec("java", ["-cp", cp, "ZeroArmourStackProbe"], { maxBuffer: 1 << 28 });
const all = stdout.trim().split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
const by = (c) => all.filter((r) => r.case === c).map((r) => r.row);
const records = { armorValue: by("armorValue"), protection: by("protection"), nbt: by("nbt"), damageArmor: by("damageArmor") };
assert.equal(all.length, 4 + 12 + 2 + 12);
const digest = async (c) => createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { yz: "EntityPlayer", yx: "InventoryPlayer", add: "ItemStack", afv: "EnchantmentHelper" };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1: CLIENT_SHA1,
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method:
    "An iron chestplate (Thorns III or Protection IV) at stack size 0 in a real EntityPlayer double's armour slot, as ItemStack.damageItem leaves a Thorns-broken piece. " +
    "armorValue: [stackSize, a second piece (iron boots) worn, getTotalArmorValue]. protection: [stackSize, seed of EnchantmentHelper's static Random, EnchantmentHelper.func_77508_a over the armour vs DamageSource.generic]. " +
    "nbt: [0 armour slot 2 / 1 main slot 5, tag count, the list's string form, [stackSize, damage] after readFromNBT into a fresh inventory (null if dropped), item id]. " +
    "damageArmor: [amount, mode (0 zero-size chestplate, 1 normal, 2 one durability left), [size, damage] of the four armour slots before, after InventoryPlayer.damageArmor(amount), renderBrokenItemStack log].",
  records,
};
await writeFile(path.join(root, "../public/research/zero-armour-stack-reference.json"), JSON.stringify(reference) + "\n");
console.log("Zero armour stack records:", all.length);
