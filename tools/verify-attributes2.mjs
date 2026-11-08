// Records batch 25 attributes2 evidence from the unchanged 1.7.10 classes (probes/Attributes2Probe.java): max health of the classes that set their
// own (wolf, slime, magma cube, horse) under saved modifiers, wolf taming, isAIEnabled / getAIMoveSpeed per class, a zombie read without an
// Attributes list, a ridden horse with a speed modifier, Count 0 and -1 item reads, item use with stackSize 0 and the break sound pitch.
// Writes public/research/attributes2-reference.json, replayed by src/attributes2.test.js.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "attributes2-probe");
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
  "InterchangeSpawnProbe", "CombatProbe", "MobSpawnerProbe", "WitchProbe", "EyeOfEnderProbe", "Attributes2Probe"];
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, ...sources.map((n) => path.join(root, `probes/${n}.java`))], { maxBuffer: 1 << 24 });
const run = async (mode) => {
  const { stdout } = await exec("java", ["-cp", cp, "Attributes2Probe", mode], { maxBuffer: 1 << 29 });
  const lines = stdout.split("\n");
  const from = mode === "items" ? lines.indexOf("--items--") + 1 : 0;
  return lines.slice(from).filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
};
const records = [...(await run("mobs")), ...(await run("horse")), ...(await run("items"))];
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
    "Unchanged classes (tools/probes/Attributes2Probe.java). maxHealth: InterchangeSpawnProbe's world; a mob written, its maxHealth entry edited (variants: " +
    "plain, add4 = +4 op 0, mul0.5 = op 1, total0.5 = op 2, all = op 2 0.5 + op 1 0.5 + op 0 4 + op 1 0.25 with HealF 1000, base30add4, lowHealF 3, highHealF 1000, " +
    "noList = no Attributes, negative = op 2 -2 with HealF 5), read back with sa.f on Entity.rand Random(5): getMaxHealth and getHealth. Wolves are wild or have an " +
    "OwnerUUID; slimes and magma cubes carry Size; horses Type. tame: EntityWolf.setTamed(true) then setHealth(20) on a wolf with a live modifier. aiEnabled: " +
    "isAIEnabled, getAIMoveSpeed and movementSpeed of each fresh living class. noAttributes: zombie and pigman read without an Attributes list on Entity.rand " +
    "seed + 40. horseRide: HorseProbe's mounted horse (seed 1, forward 0.98) with a movementSpeed modifier; each tick e(0, 0.98) and ac(); bp and aQ after each " +
    "tick; prior is the bp before the first tick. items: EyeOfEnderProbe's EW world. itemRead: loadItemStackFromNBT, EntityItem read/tick/pickup and hopper " +
    "read of stone or diamond at the given Count. use: tryPlaceItemIntoWorld on the top face (side 1, 0.5/1/0.5) of the block at (0,63,0) (or the sapling at " +
    "(0,64,0)), stackSize 1 then 0, Survival and Creative. rightClick: useItemRightClick with the stack in the hotbar slot (food level 10), then onFoodEaten " +
    "for eaten items; a stub ray trace hits (0,63,0) side 1 for buckets and bottles. breakPitch: renderBrokenItemStack on a zombie, world Random(seed). " +
    "Stacks are [item id, stackSize, damage].",
  counts,
  records,
};
await writeFile(path.join(root, "../public/research/attributes2-reference.json"), JSON.stringify(reference, null, 1) + "\n");
console.log(JSON.stringify(counts));
