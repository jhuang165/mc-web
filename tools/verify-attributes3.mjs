// Records batch 27 attributes3 evidence from the unchanged 1.7.10 classes (probes/Attributes3Probe.java): attackEntityAsMob damage per living class with
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "attributes3-probe");
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
  "InterchangeSpawnProbe", "CombatProbe", "MobSpawnerProbe", "WitchProbe", "EyeOfEnderProbe", "Attributes3Probe"];
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, ...sources.map((n) => path.join(root, `probes/${n}.java`))], { maxBuffer: 1 << 24 });
const { stdout } = await exec("java", ["-cp", cp, "Attributes3Probe"], { maxBuffer: 1 << 29 });
const records = stdout.split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
const counts = {};
for (const r of records) counts[r.case] = (counts[r.case] ?? 0) + 1;
const digest = async (c) => createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { sv: "EntityLivingBase", sw: "EntityLiving", td: "EntityCreature", tg: "EntityTameable", wv: "EntityWolf", ym: "EntitySlime", wi: "EntityHorse", yq: "EntityZombie",
  yh: "EntityPigZombie", tl: "ModifiableAttributeInstance", add: "ItemStack", abh: "ItemBlock", xk: "EntityItem", api: "TileEntityHopper", yz: "EntityPlayer", ahb: "World" };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1: CLIENT_SHA1,
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method:
    "Unchanged classes (tools/probes/Attributes3Probe.java), InterchangeSpawnProbe's world double. attack: each living class that defines n(Entity) written, its Attributes " +
    "list edited (add3 = +3 op 0, mul1 = +1 op 1, total0.5 = +0.5 op 2, all = op 2 0.5 + op 1 1 + op 0 3 + op 1 0.25, base7, base7add3, speedOnly = movementSpeed modifier, " +
    "negative = -50 op 0), read back with sa.f on Entity.rand Random(5), then n(victim) with Entity.rand Random(seed) against a zombie double that records the " +
    "attackEntityFrom amount. A class that does not register attackDamage gets an extra generic.attackDamage entry (the reader must ignore it). owned: an OwnerUUID " +
    "was added. knockback: sv.a(Entity, 1.0, 0.0, 1.0) knockBack on a mob at (3.5, 64, 7.5) away from (3.5, 64, 8.5), Entity.rand Random(seed); value is the " +
    "knockbackResistance attribute. speed: isAIEnabled, getAIMoveSpeed and the movementSpeed value after editing the list.",
  counts,
  records,
};
await writeFile(path.join(root, "../public/research/attributes3-reference.json"), JSON.stringify(reference, null, 1) + "\n");
console.log(JSON.stringify(counts));
