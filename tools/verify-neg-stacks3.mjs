// Records batch 28 negstacks3 evidence from the unchanged 1.7.10 classes (probes/NegStacks3Probe.java, HopperProbe.java): /give (EntityPlayer.func_146097_a then
// pickup delay 0 and owner), container clicks with -n and 0 stacks (Container.slotClick over player, furnace, chest, dispenser, hopper and brewing containers),
// TileEntityFurnace and TileEntityBrewingStand updateEntity, BlockDispenser / BlockDropper dispensing and hopper transfers. Writes
// public/research/neg-stacks3-reference.json, replayed by src/neg-stacks3.test.js. Mismatches of the inventory scripts are listed on stderr.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { negStackScript } from "./neg-stacks3-scripts.mjs";
import { hopperScenarios } from "./neg-stacks3-hopper.mjs";
const exec = promisify(execFile),
  root = path.dirname(fileURLToPath(import.meta.url)),
  exists = (p) => access(p).then(() => true, () => false);
const researchDirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "neg-stacks3-probe");
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
await rm(probe, { recursive: true, force: true });
await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-sourcepath", path.join(root, "probes"), "-d", probe, path.join(root, "probes/NegStacks3Probe.java"), path.join(root, "probes/HopperProbe.java")], { maxBuffer: 1 << 24 });
const run = (cls, args, input) => new Promise((resolve, reject) => {
  const child = execFile("java", ["-cp", cp, cls, ...args], { maxBuffer: 1 << 29 });
  let text = "", err = "";
  child.stdout.on("data", (d) => (text += d));
  child.stderr.on("data", (d) => (err += d));
  child.on("close", (code) => (code ? reject(new Error(err)) : resolve(text)));
  child.stdin.end(input ?? "");
});
const rows = (text) => text.split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
const mode = async (m, input) => rows(await run("NegStacks3Probe", [m], input));
const { script } = negStackScript();
const sparse = (list) => list.flatMap((v, i) => (v === null ? [] : [[i, v]]));
const inventory = (await mode("inventory", script)).map((c) => [c.case, sparse(c.inventory), c.cursor, sparse(c.armor), c.current, sparse(c.slots), c.results, c.drops, c.broken]);
const give = (await mode("give")).filter((r) => r.case === "give");
const dispense = await mode("dispense");
const furnace = await mode("furnace");
const brewing = await mode("brewing");
const hopperInput = hopperScenarios.map((s) => `scenario ${s.name} ${s.ticks}\n${s.lines.join("\n")}`).join("\n") + "\n";
const hopper = rows(await run("HopperProbe", [], hopperInput)).filter((r) => r.kind === "scenario");
const counts = { give: give.length, inventory: inventory.length, furnace: furnace.length, brewing: brewing.length, dispense: dispense.length, hopper: hopper.length };
const digest = async (c) => createHash("sha256").update((await exec("unzip", ["-p", jar, c + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { at: "CommandGive", yz: "EntityPlayer", xk: "EntityItem", apg: "TileEntityFurnace", aov: "TileEntityBrewingStand", apb: "TileEntityDispenser", apc: "TileEntityDropper", api: "TileEntityHopper", akm: "BlockDispenser", zs: "Container", aaj: "ContainerFurnace", aaz: "ContainerDispenser", aal: "ContainerHopper", zz: "ContainerBrewingStand", aad: "ContainerChest", aln: "BlockHopper", aak: "SlotFurnace" };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1: CLIENT_SHA1,
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method:
    "Unchanged classes (tools/probes/NegStacks3Probe.java; HopperProbe for hoppers). give: EntityPlayer.func_146097_a(stack, false, false) then entity delay 0 and owner = the player, as CommandGive (bytecode-read) does; " +
    "yaw/pitch in degrees, player at (10.5, 64, -3.25), seeded Entity.rand. inventory: the tools/neg-stacks3-scripts.mjs scripts (InventoryProbe format) through Container.slotClick as [case, sparse main, cursor, sparse armour, current, " +
    "sparse container slots, click results, drops, broken]; sparse entries are [index, [item id, size, damage]]. furnace: TileEntityFurnace.updateEntity on HopperProbe's world, snapshots [tick, slots, burnTime, currentItemBurnTime, cookTime, block id, metadata]; " +
    "brewing: TileEntityBrewingStand.updateEntity, snapshots [tick, slots, brewTime, block id, metadata]; slot strings are id:size:damage (x empty). dispense: DispenseProbe rows (dispense.test.js format). hopper: HopperProbe frames for the " +
    "scenarios of tools/neg-stacks3-hopper.mjs (slot count 0 is empty, -999 is a size-0 stack, any other count is the stack size).",
  counts,
  give, inventory, furnace, brewing, dispense, hopper,
  hopperScenarios,
};
await writeFile(path.join(root, "../public/research/neg-stacks3-reference.json"), JSON.stringify(reference) + "\n");
console.log(JSON.stringify(counts));
