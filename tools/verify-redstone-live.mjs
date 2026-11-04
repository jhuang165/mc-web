// Runs door (BlockDoor, wooden 64 and iron 71) and TNT (BlockTNT 46) power scenarios through the unchanged
// original classes inside the real World/Chunk fixture of tools/probes/RedstoneProbe.java (see
// tools/probes/RedstoneLiveProbe.java) and through src/redstone.js, checks that every per-tick block change,
// call-log entry, pending tick, door effect, primed TNT, item drop and the world Random agree, and writes
// public/research/redstone-live-reference.json for src/redstone-live.test.js. Needs a JDK, the pinned client
// JAR (tools/research or MC_RESEARCH) and the guava / log4j-api / commons-lang3 / netty-all library JARs.
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { replayScenario } from "../src/redstone.js";

const exec = promisify(execFile),
  root = path.dirname(fileURLToPath(import.meta.url)),
  exists = (p) => access(p).then(() => true, () => false);

const AIR = 0, STONE = 1, WIRE = 55, LEVER = 69, TNT = 46, DOOR = 64, IRON_DOOR = 71, REDSTONE_BLOCK = 152, GLASS = 20;
function scenario(name, { size, ticks, seed = 1, cells = {}, events = [], note }) {
  const [dx, dy, dz] = size, grid = [];
  for (let x = 0; x < dx; x++) for (let y = 0; y < dy; y++) for (let z = 0; z < dz; z++) grid.push(String(cells[`${x},${y},${z}`] ?? (y === 0 ? STONE : AIR)));
  return { name, note, origin: [0, 0, 0], size, ticks, seed, sky: 15, skylightSubtracted: 0, angle: 0, noSky: false, grid: grid.join(","), events };
}
const put = (c, x, y, z, v) => ((c[`${x},${y},${z}`] = v), c);
const door = (c, x, z, meta = 0, id = DOOR) => (put(c, x, 1, z, `${id}:${meta}`), put(c, x, 2, z, `${id}:${8 | (meta & 1)}`));
const SCENARIOS = [];
for (const [label, id] of [["wooden", DOOR], ["iron", IRON_DOOR]]) {
  const c = door({}, 3, 2, 0, id);
  SCENARIOS.push(scenario(`door-${label}-power-sides`, {
    size: [7, 5, 5], ticks: 38, cells: c, note: `${label} door: redstone block beside the lower half, beside the upper half and above the upper half, each placed and removed`,
    events: [[2, "place", 3, 1, 1, REDSTONE_BLOCK, 0], [8, "air", 3, 1, 1], [14, "place", 3, 2, 3, REDSTONE_BLOCK, 0], [20, "air", 3, 2, 3],
      [26, "place", 3, 3, 2, REDSTONE_BLOCK, 0], [32, "air", 3, 3, 2]],
  }));
}
{
  const c = door({}, 3, 2, 1);
  put(c, 0, 1, 2, `${LEVER}:5`); put(c, 1, 1, 2, WIRE); put(c, 2, 1, 2, WIRE);
  SCENARIOS.push(scenario("door-lever-wire", { size: [6, 4, 5], ticks: 30, cells: c, note: "lever, two dust, then a door at facing 1 with hinge bit", events: [[3, "use", 0, 1, 2], [12, "use", 0, 1, 2], [22, "use", 0, 1, 2]] }));
}
{
  const c = door({}, 2, 2); door(c, 5, 2, 3); door(c, 8, 2, 2, IRON_DOOR); put(c, 8, 1, 1, REDSTONE_BLOCK);
  SCENARIOS.push(scenario("door-support-loss", {
    size: [11, 4, 5], ticks: 14, cells: c, note: "floor removed under one door, upper half removed from another, lower half removed from a third (powered iron door)",
    events: [[3, "air", 2, 0, 2], [6, "air", 5, 2, 2], [9, "air", 8, 1, 2]],
  }));
}
{
  const c = door({}, 2, 2); put(c, 2, 1, 1, REDSTONE_BLOCK); door(c, 5, 2); door(c, 8, 2); put(c, 8, 1, 1, REDSTONE_BLOCK); put(c, 8, 1, 2, `${DOOR}:4`);
  SCENARIOS.push(scenario("door-neighbor-notify", {
    size: [11, 4, 5], ticks: 14, cells: c, note: "powered closed door opens on a neighbour notify from stone; unpowered door ignores it; open powered door stays open; a notify whose source is the door itself is ignored",
    events: [[3, "notify", 2, 1, 2, STONE], [4, "notify", 5, 1, 2, STONE], [5, "notify", 8, 1, 2, STONE], [6, "air", 2, 1, 1], [7, "notify", 2, 1, 2, DOOR]],
  }));
}
{
  const c = door({}, 3, 2); door(c, 4, 2, 1); put(c, 3, 1, 1, REDSTONE_BLOCK); put(c, 4, 1, 3, GLASS);
  SCENARIOS.push(scenario("door-double-door", {
    size: [8, 4, 5], ticks: 20, cells: c, note: "two adjacent doors, one powered through its lower half",
    events: [[3, "air", 3, 1, 1], [8, "place", 3, 1, 1, REDSTONE_BLOCK, 0], [14, "place", 4, 1, 3, REDSTONE_BLOCK, 0]],
  }));
}
{
  const c = {}; put(c, 3, 1, 2, TNT); put(c, 5, 1, 2, TNT); put(c, 5, 1, 1, REDSTONE_BLOCK); put(c, 7, 1, 2, TNT);
  SCENARIOS.push(scenario("tnt-neighbor-power", {
    size: [9, 4, 5], ticks: 10, cells: c, note: "TNT primed by a placed redstone block, by a notify next to a powered redstone block; unpowered control stays",
    events: [[2, "place", 3, 1, 1, REDSTONE_BLOCK, 0], [4, "notify", 5, 1, 2, STONE], [4, "notify", 7, 1, 2, STONE]],
  }));
}
{
  const c = {}; put(c, 2, 1, 2, REDSTONE_BLOCK); put(c, 6, 1, 3, STONE);
  SCENARIOS.push(scenario("tnt-placement", {
    size: [9, 4, 6], ticks: 10, cells: c, note: "TNT placed beside power primes in onBlockAdded; TNT placed unpowered stays until power arrives; TNT on top of a redstone block",
    events: [[2, "place", 3, 1, 2, TNT, 0], [3, "place", 6, 1, 2, TNT, 0], [6, "place", 6, 1, 1, REDSTONE_BLOCK, 0], [7, "place", 8, 1, 3, REDSTONE_BLOCK, 0], [8, "place", 8, 2, 3, TNT, 0]],
  }));
}
{
  const c = {}; put(c, 0, 1, 1, `${LEVER}:5`); put(c, 1, 1, 1, WIRE); put(c, 2, 1, 1, WIRE); put(c, 3, 1, 1, TNT);
  put(c, 0, 1, 3, `${LEVER}:5`); put(c, 1, 1, 3, STONE); put(c, 2, 1, 3, TNT);
  SCENARIOS.push(scenario("tnt-lever", { size: [5, 4, 5], ticks: 12, cells: c, note: "lever and dust beside TNT; lever on a stone block beside TNT", events: [[2, "use", 0, 1, 1], [4, "use", 0, 1, 3]] }));
}

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
const probe = path.join(out, "live-probe");
await rm(probe, { recursive: true, force: true });
await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/RedstoneProbe.java"), path.join(root, "probes/RedstoneLiveProbe.java")]);
const input = SCENARIOS.map((s) => `scenario ${s.name} ${s.origin.join(" ")} ${s.size.join(" ")} ${s.ticks} ${s.seed}\ngrid ${s.grid}\n${s.events.map((e) => `event ${e.join(" ")}`).join("\n")}\n`).join("");
const child = spawn("java", ["-cp", cp, "RedstoneLiveProbe"], { stdio: ["pipe", "pipe", "pipe"] });
let stdout = "", stderr = "";
child.stdout.on("data", (d) => (stdout += d));
child.stderr.on("data", (d) => (stderr += d));
child.stdin.end(input);
await new Promise((res, rej) => child.on("close", (c) => (c === 0 ? res() : rej(new Error("java exited " + c + "\n" + stderr)))));
const lines = stdout.trim().split("\n").map((l) => JSON.parse(l)), blocks = lines.shift();
assert.equal(blocks.kind, "blocks");
assert.equal(lines.length, SCENARIOS.length);

export function compare(s, native, mine) {
  for (let t = 0; t < s.ticks; t++) {
    assert.equal(mine.calls[t], native.calls[t], `${s.name}: call log at tick ${t + 1}`);
    assert.deepEqual(mine.frames[t], native.frames[t], `${s.name}: block changes at tick ${t + 1}`);
  }
  assert.equal(mine.final, native.final, `${s.name}: final region`);
  assert.deepEqual(mine.pending, native.pending, `${s.name}: pending ticks`);
  assert.deepEqual(mine.drops, native.drops, `${s.name}: drops`);
  assert.equal(mine.rng, native.rng, `${s.name}: world Random after the run`);
}
let ticks = 0, calls = 0, changes = 0, drops = 0, aux = 0, primed = 0;
const results = [];
for (const [i, native] of lines.entries()) {
  const s = SCENARIOS[i];
  assert.equal(native.name, s.name);
  compare(s, native, replayScenario(s));
  ticks += s.ticks;
  for (const c of native.calls) for (const e of c ? c.split(" ") : []) { calls++; if (e.startsWith("a,")) aux++; if (e.startsWith("g,")) primed++; }
  changes += native.frames.reduce((n, f) => n + f.length, 0);
  drops += native.drops.length;
  const { kind, name, ...rest } = native;
  results.push({ ...s, ...rest });
}
const digest = async (name) => createHash("sha256").update((await exec("unzip", ["-p", jar, name + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { akn: "BlockDoor", aob: "BlockTNT", xw: "EntityTNTPrimed", ahb: "World", apx: "Chunk", aji: "Block" };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1,
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method:
    "Unchanged BlockDoor (akn, wooden 64 and iron 71) and BlockTNT (aob) run in the RedstoneProbe World/Chunk fixture plus the original wire, lever and redstone block. Recorded: World.playAuxSFXAtEntity (log a,id,x,y,z; door effect 1003) and World.spawnEntityInWorld of EntityTNTPrimed (log g,x,y,z of the floored entity position); the primed TNT's sound and motion are not compared. Frames [x,y,z,id,meta] per tick, calls (E op, s setBlock, m metadata, n notify, t schedule, u updateTick, a aux effect, g primed TNT, e dropped item, T tick), drops [tick,x,y,z,item,count,damage], pending ticks and the world Random are compared with src/redstone.js replayScenario.",
  blocks,
  scenarios: results,
};
await writeFile(path.join(root, "../public/research/redstone-live-reference.json"), JSON.stringify(reference) + "\n");
console.log(`PASS: ${SCENARIOS.length} scenarios, ${ticks} ticks, ${calls} logged calls, ${changes} cell changes, ${aux} door effects, ${primed} primed TNT, ${drops} drops identical to the original classes.`);
