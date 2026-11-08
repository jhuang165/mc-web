// Records batch 29 leads3 evidence from the unchanged 1.7.10 classes: a leashed mob's death and a lead across a dimension change (probes/Leads3Probe.java),
// ContainerHorseInventory clicks with size <= 0 stacks (Leads3Probe horse mode) and hoppers with negative stacks for every facing and double chests
// (HopperProbe, tools/leads3-hopper.mjs). Writes public/research/leads3-reference.json, replayed by src/leads3.test.js.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { leads3HopperScenarios } from "./leads3-hopper.mjs";
import { replayHopperScenario } from "../src/hopper-replay.js";
import { replayHorseNeg } from "../src/horse-neg-replay.js";
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
  "InterchangeSpawnProbe", "CombatProbe", "MobSpawnerProbe", "WitchProbe", "EyeOfEnderProbe", "Attributes2Probe", "NegStacksProbe", "WolfProbe", "OcelotProbe", "Leads2Probe", "Leads3Probe"];
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, ...sources.map((n) => path.join(root, `probes/${n}.java`))], { maxBuffer: 1 << 24 });
const run = async (mode) => {
  const { stdout } = await exec("java", ["-cp", cp, "Leads3Probe", mode], { maxBuffer: 1 << 29 });
  const lines = stdout.split("\n");
  const from = lines.indexOf("--items--") + 1;
  return lines.slice(from).filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
};
await exec("javac", ["-nowarn", "-cp", cp, "-sourcepath", path.join(root, "probes"), "-d", probe, path.join(root, "probes/RedstoneProbe.java"), path.join(root, "probes/HopperProbe.java")], { maxBuffer: 1 << 24 });
const hopperInput = leads3HopperScenarios.map((s) => `scenario ${s.name} ${s.ticks}\n${s.lines.join("\n")}`).join("\n") + "\n";
const hopperRows = await new Promise((resolve, reject) => {
  const child = spawn("java", ["-cp", cp, "HopperProbe"], { stdio: ["pipe", "pipe", "pipe"] });
  let text = "", err = "";
  child.stdout.on("data", (d) => (text += d));
  child.stderr.on("data", (d) => (err += d));
  child.on("close", (code) => (code ? reject(new Error(err)) : resolve(text.split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l)).filter((r) => r.kind === "scenario"))));
  child.stdin.end(hopperInput);
});
assert.equal(hopperRows.length, leads3HopperScenarios.length);
const hopper = hopperRows.map((n, i) => ({ name: n.name, frames: n.frames }));
const records = [...(await run("lead")), ...(await run("horse"))];
// Every record must replay through the port before it is written.
const bad = [];
for (const r of records) if (r.case === "horseNeg") {
  const got = replayHorseNeg(r);
  if (JSON.stringify(got) !== JSON.stringify({ result: r.result, cursor: r.cursor, horse: r.horse, player: r.player, saddled: r.saddled, armor: r.armor, drops: r.drops })) bad.push(`horseNeg ${r.type} ${r.kind} ${r.count} ${r.action}`);
}
for (const [i, n] of hopper.entries()) {
  const s = leads3HopperScenarios[i], mine = replayHopperScenario(s);
  for (let t = 0; t < s.ticks; t++) if (JSON.stringify(mine.frames[t]) !== JSON.stringify(n.frames[t])) { bad.push(`hopper ${s.name} tick ${t + 1}`); break; }
}
if (bad.length) throw new Error(`${bad.length} records differ from the port:\n${bad.slice(0, 20).join("\n")}`);
const counts = { hopper: hopper.length };
for (const r of records) counts[r.case] = (counts[r.case] ?? 0) + 1;
const digest = async (c) => createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { aam: "ContainerHorseInventory", api: "TileEntityHopper", aln: "BlockHopper", sw: "EntityLiving", td: "EntityCreature", su: "EntityLeashKnot", adf: "ItemLead", wi: "EntityHorse", vg: "EntityAIRunAroundLikeCrazy", wv: "EntityWolf", wn: "EntityOcelot", wp: "EntitySheep", yz: "EntityPlayer", acj: "ItemDye" };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1: CLIENT_SHA1,
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method: "Unchanged classes (tools/probes/Leads3Probe.java on the Leads2Probe world double plus a WorldInfo with GameRules and a light table; HopperProbe for hoppers). leadDeath: EntityLiving.onDeath/setDead with a lead and the 20-tick death animation; leadDimension: Entity.travelToDimension's copy (writeToNBT, readFromNBT, first updateLeashedState); horseNeg: ContainerHorseInventory.slotClick with size -2..2 stacks; hopper: frames of tools/leads3-hopper.mjs. See public/research/leads3.md.",
  counts,
  records,
  hopper,
};
await writeFile(path.join(root, "../public/research/leads3-reference.json"), JSON.stringify(reference, null, 1) + "\n");
console.log(JSON.stringify(counts));
