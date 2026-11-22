// Records batch 96 console96 evidence from the unchanged 1.7.10 classes (probes/Console96Probe.java): the packets sent when a player enters a viewer's tracked set (S0C, whole S1C, S20, S04, S1D, S1B). Writes
// public/research/console96-reference.json, replayed by src/console96-b93.test.js.
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
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "console96-probe");
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
  "InterchangeSpawnProbe", "CombatProbe", "MobSpawnerProbe", "WitchProbe", "EyeOfEnderProbe", "MobPackets89Probe", "Console96Probe"];
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, ...sources.map((n) => path.join(root, `probes/${n}.java`))], { maxBuffer: 1 << 24 });
const { stdout } = await exec("java", ["-cp", cp, "Console96Probe"], { maxBuffer: 1 << 29 });
const records = stdout.split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
const digest = async (c) => createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { gb: "S0CPacketSpawnPlayer", hw: "S1CPacketEntityMetadata", il: "S20PacketEntityProperties", hz: "S04PacketEntityEquipment", in: "S1DPacketEntityEffect", hx: "S1BPacketEntityAttach" };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1: CLIENT_SHA1,
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method:
    "Unchanged classes (tools/probes/Console96Probe.java), MobPackets89Probe's world double. A real EntityPlayer (DifficultyProbe.player: EntityPlayer.entityInit watcher entries, applyEntityAttributes) with a GameProfile and an InventoryPlayer set by reflection; " +
    "`bytes` = id VarInt + payload as the encoder fa counts it (S0C: name length, held or empty hand, with and without one profile property).",
  s0c: records.filter((r) => r.case === "s0c"),
  s0cProp: records.filter((r) => r.case === "s0cProp"),
  follow: records.filter((r) => r.case === "follow"),
};
await writeFile(path.join(root, "../public/research/console96-reference.json"), JSON.stringify(reference, null, 1) + "\n");
console.log(reference.s0c.length + " s0c records, " + reference.follow.length + " follow record");
