// Records what zero-size stacks do in the unchanged 1.7.10 classes (batch 24 zerostacks, probes/ZeroStacksProbe.java): container clicks,
// main-inventory paths, mob equipment (Thorns break, NBT, dropEquipment, experience) and the anvil helmet hit. Writes
// public/research/zero-stacks-reference.json, replayed by src/zero-stacks.test.js; the inventory scripts (probes/zero-stack-scenarios.txt)
// are also replayed here through tools/inventory-replay.mjs and mismatches are listed.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { replay } from "./inventory-replay.mjs";
const exec = promisify(execFile),
  root = path.dirname(fileURLToPath(import.meta.url)),
  exists = (p) => access(p).then(() => true, () => false);
const researchDirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "zero-stacks-probe");
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
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, ...["MobMoveProbe", "ChickenProbe", "DifficultyProbe", "SuffocationProbe", "PlayerDamageProbe", "ArmorEnchantmentProbe", "ZeroStacksProbe"].map((n) => path.join(root, `probes/${n}.java`))], { maxBuffer: 1 << 24 });
const run = (args, input) => new Promise((resolve, reject) => {
  const child = execFile("java", ["-cp", cp, "ZeroStacksProbe", ...args], { maxBuffer: 1 << 28 });
  let text = "", err = "";
  child.stdout.on("data", (d) => (text += d));
  child.stderr.on("data", (d) => (err += d));
  child.on("close", (code) => (code ? reject(new Error(err)) : resolve(text)));
  child.stdin.end(input ?? "");
});
const script = await readFile(path.join(root, "probes/zero-stack-scenarios.txt"), "utf8");
const cases = (await run(["inventory"], script)).trim().split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
const actual = replay(script);
assert.equal(actual.length, cases.length);
let mismatches = 0;
for (let i = 0; i < cases.length; i++) {
  try { assert.deepEqual(actual[i], cases[i]); } catch { mismatches++; console.error(`MISMATCH ${cases[i].case}\n original ${JSON.stringify(cases[i])}\n js       ${JSON.stringify(actual[i])}`); }
}
const all = (await run(["all"])).trim().split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
const by = (c) => all.filter((r) => r.case === c).map((r) => r.row);
const records = { mobThorns: by("mobThorns"), mobNbt: by("mobNbt"), mobDrop: by("mobDrop"), mobXp: by("mobXp"), anvil: by("anvil") };
const digest = async (c) => createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { yz: "EntityPlayer", yx: "InventoryPlayer", zs: "Container", aap: "ContainerPlayer", aay: "Slot", add: "ItemStack", afv: "EnchantmentHelper", sv: "EntityLivingBase", sw: "EntityLiving", yq: "EntityZombie", sa: "Entity" };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1: CLIENT_SHA1,
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method:
    "Unchanged classes on the PlayerDamageProbe world double (tools/probes/ZeroStacksProbe.java). inventory: tools/probes/zero-stack-scenarios.txt in the InventoryProbe " +
    "format, with the native EntityPlayer drop methods (only joinEntityItemWithWorld records the EntityItem's stack); rows as inventory-reference.json cases. " +
    "mobThorns: [thorns, unbreaking, seed, equipment before, attacker log, equipment after, events, particle count, next zombie Random int, getTotalArmorValue, seed2, " +
    "second attacker log, equipment after the second reaction, its events, next int] on a real EntityZombie with an iron chestplate at damage 240. mobNbt: [variant, " +
    "Equipment list as written, equipment after EntityList.createEntityFromNBT, armour value, Equipment written again]. mobDrop: [chestplate stackSize, drop chance, " +
    "recentlyHit, looting, seed, spawned EntityItem stacks, next Random int] of EntityLiving.dropEquipment. mobXp: [chestplate stackSize (-1 none), seed, " +
    "getExperiencePoints, next int]. anvil: [player|zombie, leather helmet damage, amount, iron chestplate worn, accepted, health before, health after, helmet slot " +
    "after, still the same object, getTotalArmorValue after, events, particle count] of attackEntityFrom(DamageSource.anvil). Stacks are [Minecraft id, count, damage].",
  script,
  cases,
  records,
};
await writeFile(path.join(root, "../public/research/zero-stacks-reference.json"), JSON.stringify(reference) + "\n");
console.log(`Zero stacks: ${cases.length} inventory cases (${mismatches} port mismatches), ${Object.entries(records).map(([k, v]) => k + " " + v.length).join(", ")}.`);
