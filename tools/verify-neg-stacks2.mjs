// Records batch 27 negstacks2 evidence from the unchanged 1.7.10 classes (probes/NegStacks2Probe.java): addItemStackToInventory, EntityItem pickup, decrStackSize,
// player drops, getTotalArmorValue and ItemFirework at stackSize <= 0. Writes public/research/neg-stacks2-reference.json, replayed by src/neg-stacks2.test.js.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "neg-stacks-probe");
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
  "InterchangeSpawnProbe", "CombatProbe", "MobSpawnerProbe", "WitchProbe", "EyeOfEnderProbe", "Attributes2Probe", "NegStacksProbe", "NegStacks2Probe"];
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, ...sources.map((n) => path.join(root, `probes/${n}.java`))], { maxBuffer: 1 << 24 });
const run = async (mode) => {
  const { stdout } = await exec("java", ["-cp", cp, "NegStacks2Probe", mode], { maxBuffer: 1 << 29 });
  const lines = stdout.split("\n");
  const from = lines.indexOf("--items--") + 1;
  return lines.slice(from).filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
};
const records = [...(await run("run")), ...(await run("interact"))];
const counts = {};
for (const r of records) counts[r.case] = (counts[r.case] ?? 0) + 1;
const digest = async (c) => createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { add: "ItemStack", yx: "InventoryPlayer", yz: "EntityPlayer", xk: "EntityItem", acs: "ItemFirework", at: "CommandGive" };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1: CLIENT_SHA1,
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method:
    "Unchanged classes (tools/probes/NegStacks2Probe.java, EyeOfEnderProbe's EW world). add: InventoryPlayer.addItemStackToInventory of diamond / iron sword / damaged sword / bucket at size -2..2 into an empty inventory (0), " +
    "diamond x5 in slot 2 (1), diamond x64 in slot 2 (2), every slot dirt x64 (3), full with diamond x10 in slot 7 (4), Survival and Creative; inventory is [slot (36+ armour), item, size, damage]. " +
    "pickup: EntityItem.onCollideWithPlayer (delay 0) of a diamond stack at -2/-1/0 twice. decr: InventoryPlayer.decrStackSize(slot, n). drop: EntityPlayer.func_146097_a and InventoryPlayer.dropAllItems. " +
    "armour: getTotalArmorValue with a diamond (264) or iron chestplate (307) in armour slot 2. firework: ItemFirework.onItemUse at the top of stone. Stacks are [item id, stackSize, damage].",
  counts,
  records,
};
await writeFile(path.join(root, "../public/research/neg-stacks2-reference.json"), JSON.stringify(reference, null, 1) + "\n");
console.log(JSON.stringify(counts));
