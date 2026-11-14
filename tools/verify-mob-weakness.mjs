// Batch 71 mobfixes71: Weakness and Strength on an attacking mob (probes/MobWeaknessProbe.java). Writes public/research/mob-weakness-reference.json, replayed by src/mob-weakness-b71.test.js.
// Based on verify-attributes3.mjs (batch 27) which records attributes3 evidence from the unchanged 1.7.10 classes (probes/Attributes3Probe.java): attackEntityAsMob damage per living class with
// attackDamage modifiers of operation 0/1/2 and base overrides, knockBack under knockbackResistance edits, movementSpeed values and getAIMoveSpeed
// under modifiers. Writes public/research/attributes3-reference.json, replayed by src/attributes3.test.js.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "mobweakness-probe");
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
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "authlib-", "commons-io-", "gson-", "netty-"].map(library));
const classes = path.join(out, "classes");
if (!(await exists(path.join(classes, "assets/minecraft/lang/en_US.lang")))) {
  await mkdir(classes, { recursive: true });
  await exec("unzip", ["-q", "-o", jar, "*.class", "assets/minecraft/lang/en_US.lang", "-d", classes], { maxBuffer: 1 << 24 });
}
const probe = path.join(out, "probe");
await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
const sources = ["MobMoveProbe", "ChickenProbe", "DifficultyProbe", "EquipmentProbe", "ModelProbe", "HorseProbe", "HorseGearProbe", "LeashProbe", "InterchangeLinkProbe",
  "InterchangeSpawnProbe", "CombatProbe", "MobSpawnerProbe", "WitchProbe", "EyeOfEnderProbe", "Attributes3Probe", "MobWeaknessProbe"];
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, ...sources.map((n) => path.join(root, `probes/${n}.java`))], { maxBuffer: 1 << 24 });
const { stdout } = await exec("java", ["-cp", cp, "MobWeaknessProbe"], { maxBuffer: 1 << 29 });
const records = stdout.split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
const counts = {};
for (const r of records) counts[r.case] = (counts[r.case] ?? 0) + 1;
const digest = async (c) => createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { rs: "PotionAttackDamage", rv: "Potion", sv: "EntityLivingBase", yq: "EntityZombie" };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1: CLIENT_SHA1,
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method: "Unchanged classes (tools/probes/MobWeaknessProbe.java). Weakness (id 18) and Strength (id 5) added with addPotionEffect (600 ticks) to a mob read back from its own NBT, then attackEntityAsMob(zombie double): the amount the victim's attackEntityFrom received. weakness/strength 0 = none, n = amplifier n-1.",
  counts,
  records,
};
await writeFile(path.join(root, "../public/research/mob-weakness-reference.json"), JSON.stringify(reference, null, 1) + "\n");
console.log(JSON.stringify(counts));
