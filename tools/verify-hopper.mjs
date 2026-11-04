// Drives the unchanged original BlockHopper (154) and TileEntityHopper through tools/probes/HopperProbe.java (the
// RedstoneProbe World/Chunk fixture) over chests, double chests, furnaces, droppers, dispensers, hoppers, scripted
// EntityItems, redstone power and comparators; replays every scenario through the browser port (src/hopper-replay.js)
// and requires identical per-tick slot, cooldown, metadata, entity and comparator output; writes
// public/research/hopper-reference.json for src/hopper.test.js. Needs a JDK, the pinned client JAR (tools/research or
// MC_RESEARCH) and the guava / log4j-api / commons-lang3 / netty-all library JARs.
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { replayHopperScenario } from "../src/hopper-replay.js";

const exec = promisify(execFile),
  root = path.dirname(fileURLToPath(import.meta.url)),
  exists = (p) => access(p).then(() => true, () => false);

// Original ids. Facing (hopper metadata): 0 down, 2 north (-z), 3 south (+z), 4 west (-x), 5 east (+x); +8 disabled.
const CHEST = 54, FURNACE = 61, DISPENSER = 23, DROPPER = 158, HOPPER = 154, STONE = 1, RSBLOCK = 152, COMPARATOR = 149;
const IRON = 265, COAL = 263, STICK = 280, SWORD = 276, PEARL = 368, BUCKET = 325, DIAMOND = 264, SNOW = 332;
const SCENARIOS = [];
function scenario(name, { ticks = 40, set = [], slots = [], entities = [], events = [], note = "" }) {
  SCENARIOS.push({ name, note, ticks, set, slots, entities, events });
}
const fill = (x, y, z, items) => items.map(([item, count, damage = 0], slot) => [x, y, z, slot, item, count, damage]);

scenario("push-down-chest", { note: "hopper facing down into a chest: one item per 8 ticks, first slot first, then the comparator-visible fill", ticks: 40,
  set: [[1, 3, 1, HOPPER, 0], [1, 2, 1, CHEST, 2]], slots: fill(1, 3, 1, [[IRON, 3], [COAL, 2], [STICK, 1]]) });
scenario("suck-from-chest-above", { note: "hopper below a chest pulls one item per 8 ticks and, facing down onto air, keeps them", ticks: 50,
  set: [[1, 2, 1, HOPPER, 0], [1, 3, 1, CHEST, 2]], slots: fill(1, 3, 1, [[IRON, 5], [COAL, 3], [STICK, 2], [SWORD, 1, 3], [PEARL, 4]]) });
scenario("chain-chest-hopper-hopper-chest", { note: "chest, hopper, side hopper, chest: cooldown handoff between hoppers", ticks: 70,
  set: [[1, 4, 1, CHEST, 2], [1, 3, 1, HOPPER, 0], [1, 2, 1, HOPPER, 5], [2, 2, 1, HOPPER, 0], [2, 1, 1, CHEST, 2]],
  slots: fill(1, 4, 1, [[IRON, 4], [COAL, 4]]) });
scenario("horizontal-into-chest", { note: "hopper facing east into a chest and facing north into a dropper", ticks: 40,
  set: [[1, 1, 1, HOPPER, 5], [2, 1, 1, CHEST, 2], [5, 1, 5, HOPPER, 2], [5, 1, 4, DROPPER, 3]], slots: [...fill(1, 1, 1, [[IRON, 2], [COAL, 1]]), ...fill(5, 1, 5, [[STICK, 3]])] });
scenario("furnace-below-input", { note: "hopper above a furnace feeds the input slot (any item, side top), fuel is not accepted from above", ticks: 40,
  set: [[1, 3, 1, HOPPER, 0], [1, 2, 1, FURNACE, 2]], slots: [...fill(1, 3, 1, [[COAL, 3], [IRON, 3]]), ...fill(1, 2, 1, [[IRON, 62]])] });
scenario("furnace-side-fuel", { note: "hopper beside a furnace feeds only the fuel slot (side slots {1}); non-fuel is refused", ticks: 40,
  set: [[1, 1, 1, HOPPER, 5], [2, 1, 1, FURNACE, 4]], slots: fill(1, 1, 1, [[IRON, 2], [STICK, 2], [COAL, 2]]) });
scenario("furnace-side-fuel-merge", { note: "side feeding merges into an existing fuel stack and stops when it is full", ticks: 40,
  set: [[1, 1, 1, HOPPER, 5], [2, 1, 1, FURNACE, 4]], slots: [...fill(1, 1, 1, [[COAL, 3]]), ...fill(2, 1, 1, [[0, 0], [COAL, 63]])] });
scenario("furnace-above-output", { note: "furnace above a hopper: output slot first, then the fuel slot only for an empty bucket", ticks: 50,
  set: [[1, 2, 1, HOPPER, 0], [1, 3, 1, FURNACE, 2]], slots: fill(1, 3, 1, [[IRON, 1], [BUCKET, 1], [IRON, 3, 0]]) });
scenario("furnace-above-fuel-kept", { note: "an empty output leaves coal in the fuel slot untouched, a bucket there is taken", ticks: 30,
  set: [[1, 2, 1, HOPPER, 0], [1, 3, 1, FURNACE, 2]], slots: fill(1, 3, 1, [[0, 0], [COAL, 5]]) });
scenario("furnace-bucket-fuel", { note: "empty bucket in the fuel slot is extractable from the bottom", ticks: 20,
  set: [[1, 2, 1, HOPPER, 0], [1, 3, 1, FURNACE, 2]], slots: fill(1, 3, 1, [[0, 0], [BUCKET, 2]]) });
scenario("pickup-items", { note: "item entities in the 1x1x1 box above (y+1 to y+2): inside, overlapping the edge, too low, too high, beside", ticks: 60,
  set: [[1, 2, 1, HOPPER, 0]], entities: [[1.5, 3.2, 1.5, IRON, 3, 0], [1.5, 3.5, 1.5, COAL, 2, 0], [1.5, 2.4, 1.5, STICK, 5, 0], [1.5, 4.5, 1.5, STICK, 5, 0], [2.4, 3.2, 1.5, DIAMOND, 1, 0], [0.9, 3.2, 1.5, SWORD, 1, 0]] });
scenario("pickup-merge-and-full", { note: "entity stacks merge into partial slots up to the stack size, the remainder stays an entity; a full hopper takes nothing", ticks: 40,
  set: [[1, 2, 1, HOPPER, 0]], slots: fill(1, 2, 1, [[IRON, 60], [COAL, 64], [STICK, 64], [PEARL, 15], [SWORD, 1, 5]]), entities: [[1.5, 3.2, 1.5, IRON, 10, 0], [1.5, 3.2, 1.5, PEARL, 4, 0], [1.5, 3.2, 1.5, SWORD, 1, 5]] });
scenario("pickup-late-spawn", { note: "an item entity that appears later is taken after the cooldown; the empty chest above blocks pickup", ticks: 60,
  set: [[1, 2, 1, HOPPER, 0], [4, 2, 4, HOPPER, 0], [4, 3, 4, CHEST, 2]], events: [[10, "entity", 1.5, 3.2, 1.5, IRON, 2, 0], [20, "entity", 4.5, 4.2, 4.5, IRON, 2, 0], [20, "entity", 4.5, 3.9, 4.5, COAL, 1, 0]] });
scenario("power-disable", { note: "a redstone block beside the hopper disables it (metadata +8), removing it enables it again; powered placement", ticks: 60,
  set: [[1, 3, 1, HOPPER, 0], [1, 2, 1, CHEST, 2]], slots: fill(1, 3, 1, [[IRON, 10]]),
  events: [[12, "place", 2, 3, 1, RSBLOCK, 0], [30, "air", 2, 3, 1], [40, "place", 5, 3, 5, RSBLOCK, 0], [42, "place", 5, 2, 5, HOPPER, 0], [43, "slot", 5, 2, 5, 0, COAL, 4, 0]] });
scenario("double-chest-target", { note: "hopper pushes into a double chest (west half first), fills slot 0 of the left chest", ticks: 40,
  set: [[1, 3, 1, HOPPER, 0], [1, 2, 1, CHEST, 2], [2, 2, 1, CHEST, 2]], slots: fill(1, 3, 1, [[IRON, 4]]) });
scenario("double-chest-source", { note: "hopper under the east half of a double chest pulls from slot 0 of the west half first", ticks: 40,
  set: [[2, 2, 1, HOPPER, 0], [1, 3, 1, CHEST, 2], [2, 3, 1, CHEST, 2]], slots: [...fill(1, 3, 1, [[IRON, 2]]), ...fill(2, 3, 1, [[COAL, 2]])] });
scenario("chest-blocked-above", { note: "a normal cube on a chest above the hopper closes it for pulling; removing it reopens the chest", ticks: 40,
  set: [[1, 2, 1, HOPPER, 0], [1, 3, 1, CHEST, 2], [1, 4, 1, STONE, 0]], slots: fill(1, 3, 1, [[IRON, 3]]), events: [[20, "air", 1, 4, 1]] });
scenario("chest-blocked-by-stone", { note: "stone above the chest under a hopper's output side: the hopper cannot push", ticks: 30,
  set: [[1, 1, 1, HOPPER, 5], [2, 1, 1, CHEST, 2], [2, 2, 1, STONE, 0]], slots: fill(1, 1, 1, [[IRON, 3]]) });
scenario("double-chest-partner-blocked", { note: "stone above only the partner half closes the whole double chest", ticks: 30,
  set: [[1, 3, 1, HOPPER, 0], [1, 2, 1, CHEST, 2], [2, 2, 1, CHEST, 2], [2, 3, 1, STONE, 0]], slots: fill(1, 3, 1, [[IRON, 3]]) });
scenario("dispenser-dropper-sources", { note: "hoppers pull from a dispenser above and push into a dropper below (nine slots)", ticks: 50,
  set: [[1, 2, 1, HOPPER, 0], [1, 3, 1, DISPENSER, 1], [1, 1, 1, DROPPER, 1], [4, 2, 4, HOPPER, 0], [4, 3, 4, DROPPER, 1]],
  slots: [...fill(1, 3, 1, [[IRON, 2], [COAL, 1]]), ...fill(4, 3, 4, [[STICK, 3]])] });
scenario("stack-rules", { note: "unstackable, 16-stack and damage-split stacks into a half-filled chest; damaged swords never merge", ticks: 100,
  set: [[1, 3, 1, HOPPER, 0], [1, 2, 1, CHEST, 2]], slots: [...fill(1, 3, 1, [[SWORD, 1, 2], [SWORD, 1, 2], [PEARL, 3], [SNOW, 5], [IRON, 3]]), ...fill(1, 2, 1, [[SWORD, 1, 2], [SWORD, 1, 7], [PEARL, 14], [IRON, 63], [SNOW, 15]])] });
scenario("target-full", { note: "a full destination refuses everything; the hopper keeps its items and its cooldown", ticks: 30,
  set: [[1, 3, 1, HOPPER, 0], [1, 2, 1, HOPPER, 0]], slots: [...fill(1, 3, 1, [[IRON, 5]]), ...fill(1, 2, 1, [[COAL, 64], [COAL, 64], [COAL, 64], [COAL, 64], [COAL, 64]])] });
scenario("comparator-chest", { note: "comparator (metadata 3 reads from x-1) beside a chest follows hopper transfers live (BlockChest comparator override)", ticks: 70,
  set: [[2, 0, 1, STONE, 0], [2, 1, 1, COMPARATOR, 3], [1, 1, 1, CHEST, 2], [1, 3, 1, HOPPER, 0], [1, 2, 1, HOPPER, 0]], slots: fill(1, 3, 1, [[IRON, 6]]) });
scenario("comparator-hopper", { note: "comparator reading a hopper's own contents (five slots)", ticks: 70,
  set: [[2, 0, 1, STONE, 0], [2, 1, 1, COMPARATOR, 3], [1, 1, 1, HOPPER, 0], [1, 2, 1, CHEST, 2]], slots: fill(1, 2, 1, [[IRON, 9], [COAL, 5]]) });
scenario("comparator-furnace", { note: "comparator beside a furnace fed through the side by a hopper", ticks: 50,
  set: [[2, 0, 1, STONE, 0], [2, 1, 1, COMPARATOR, 3], [1, 1, 1, FURNACE, 4], [1, 1, 2, HOPPER, 2]], slots: fill(1, 1, 2, [[COAL, 4]]) });

const researchDirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), out = path.join(research, "redstone-probe"), clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
assert.equal(createHash("sha1").update(await readFile(jar)).digest("hex"), clientSha1);
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
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "netty-all-"].map(library));
const classes = path.join(out, "classes");
if (!(await exists(path.join(classes, "ahb.class")))) {
  await mkdir(classes, { recursive: true });
  await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
}
const probe = path.join(out, "hopper-probe");
await rm(probe, { recursive: true, force: true });
await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/RedstoneProbe.java"), path.join(root, "probes/HopperProbe.java")]);
const input = SCENARIOS.map((s) => [`scenario ${s.name} ${s.ticks}`,
  ...s.set.map((v) => `set ${v.join(" ")}`), ...s.slots.map((v) => `slot ${v.join(" ")}`), ...s.entities.map((v) => `entity ${v.join(" ")}`),
  ...s.events.map((v) => `event ${v.join(" ")}`)].join("\n") + "\n").join("");
const child = spawn("java", ["-cp", cp, "HopperProbe"], { stdio: ["pipe", "pipe", "pipe"] });
let stdout = "", stderr = "";
child.stdout.on("data", (d) => (stdout += d));
child.stderr.on("data", (d) => (stderr += d));
child.stdin.end(input);
await new Promise((res, rej) => child.on("close", (c) => (c === 0 ? res() : rej(new Error("java exited " + c + "\n" + stderr)))));
const lines = stdout.trim().split("\n").map((l) => JSON.parse(l)), facts = lines.shift();
assert.equal(facts.kind, "facts");
assert.equal(lines.length, SCENARIOS.length);

let changes = 0, mismatches = [];
const results = [];
for (const [i, native] of lines.entries()) {
  const s = SCENARIOS[i];
  assert.equal(native.name, s.name);
  const mine = replayHopperScenario(s);
  for (let t = 0; t < s.ticks; t++) {
    if (JSON.stringify(mine.frames[t]) !== JSON.stringify(native.frames[t])) {
      mismatches.push(`${s.name} tick ${t + 1}: native ${JSON.stringify(native.frames[t])} port ${JSON.stringify(mine.frames[t])}`);
      break;
    }
  }
  changes += native.frames.reduce((n, f) => n + f.length, 0);
  results.push({ ...s, frames: native.frames });
}
if (mismatches.length) {
  console.error(mismatches.join("\n"));
  throw new Error(`${mismatches.length} scenarios differ from the original classes`);
}
const digest = async (name) => createHash("sha256").update((await exec("unzip", ["-p", jar, name + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { aln: "BlockHopper", api: "TileEntityHopper", aji: "Block", apg: "TileEntityFurnace", ajx: "BlockChest", ahb: "World", apb: "TileEntityDispenser" };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1,
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method:
    "Unchanged BlockHopper (aln) and TileEntityHopper (api) run in the RedstoneProbe World/Chunk fixture with the original chests, furnaces, dispensers/droppers, hoppers, redstone block, comparators and scripted EntityItems. Per tick (tile-entity loop in set order, then scheduled updates) the probe records block id/metadata, every slot, the hopper cooldown, live item entities, the Block comparator override of every container and the TileEntityComparator output; only changed cells are stored. TileEntityFurnace.updateEntity is not ticked (no smelting). Minecart inventories and ocelots are not in the fixture.",
  facts,
  scenarios: results,
};
await writeFile(path.join(root, "../public/research/hopper-reference.json"), JSON.stringify(reference) + "\n");
console.log(`PASS: ${SCENARIOS.length} scenarios, ${SCENARIOS.reduce((n, s) => n + s.ticks, 0)} ticks, ${changes} recorded changes identical to the original classes.`);
