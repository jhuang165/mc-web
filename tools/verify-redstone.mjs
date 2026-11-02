// Runs redstone scenarios through the unchanged original BlockRedstoneWire, BlockRedstoneTorch,
// BlockTorch, BlockLever, BlockButton, BlockRedstoneLight and BlockCompressedPowered inside a
// real World/Chunk (tools/probes/RedstoneProbe.java) and through src/redstone.js, checks that
// every per-tick block/metadata change, call-log entry, sound, item drop, pending tick and the
// world Random's next int agree, and writes public/research/redstone-reference.json for
// src/redstone.test.js. Needs a JDK, the pinned client JAR (tools/research or MC_RESEARCH) and
// the guava / log4j-api / commons-lang3 library JARs (MC_PROBE_LIBS or a launcher/gradle cache).
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { replayScenario, blockProperties } from "../src/redstone.js";

const exec = promisify(execFile),
  root = path.dirname(fileURLToPath(import.meta.url)),
  exists = (p) => access(p).then(() => true, () => false);

// ---- Scenarios (region-relative coordinates; y = 0 is usually a stone floor) ----
const AIR = 0, STONE = 1, GLASS = 20, DOUBLE_SLAB = 43, SLAB = 44, WIRE = 55, LEVER = 69, UNLIT_TORCH = 75, TORCH = 76,
  STONE_BUTTON = 77, GLOWSTONE = 89, LAMP = 123, WOOD_BUTTON = 143, REDSTONE_BLOCK = 152;
function scenario(name, { origin = [0, 0, 0], size, ticks, seed = 1, floor = true, cells = {}, events = [], note }) {
  const [dx, dy, dz] = size,
    grid = [];
  for (let x = 0; x < dx; x++)
    for (let y = 0; y < dy; y++)
      for (let z = 0; z < dz; z++) {
        const v = cells[`${x},${y},${z}`] ?? (floor && y === 0 ? STONE : AIR);
        grid.push(String(v));
      }
  return { name, note, origin, size, ticks, seed, grid: grid.join(","), events };
}
const put = (cells, x, y, z, v) => ((cells[`${x},${y},${z}`] = v), cells);
const line = (cells, x0, x1, y, z, v = WIRE) => {
  for (let x = x0; x <= x1; x++) put(cells, x, y, z, v);
  return cells;
};

const SCENARIOS = [];
// Straight 16-wire line from a floor lever: 15 at the lever, 0 at the far end.
SCENARIOS.push(scenario("line-lever", {
  size: [18, 3, 3], ticks: 30, note: "16 raw wires, floor lever placed, toggled on/off/on",
  cells: line({}, 1, 16, 1, 1),
  events: [[1, "place", 0, 1, 1, LEVER, 5], [3, "use", 0, 1, 1], [12, "use", 0, 1, 1], [20, "use", 0, 1, 1]],
}));
// Wire placed one per tick away from a redstone block.
SCENARIOS.push(scenario("line-place-wires", {
  size: [12, 3, 3], ticks: 14, note: "redstone block, then a wire per tick",
  events: [[1, "place", 0, 1, 1, REDSTONE_BLOCK, 0], ...Array.from({ length: 9 }, (_, i) => [2 + i, "place", 1 + i, 1, 1, WIRE, 0])],
}));
// Break dust mid-line, re-place it, then remove the source.
SCENARIOS.push(scenario("line-break-mid", {
  size: [14, 3, 3], ticks: 16, note: "line cut and restored, then source removed",
  cells: line({}, 1, 12, 1, 1),
  events: [[1, "place", 0, 1, 1, REDSTONE_BLOCK, 0], [4, "air", 6, 1, 1], [7, "place", 6, 1, 1, WIRE, 0], [10, "air", 0, 1, 1]],
}));
// Plus, T and corner branches from one lever.
{
  const c = {};
  line(c, 1, 8, 1, 4);
  for (let z = 0; z <= 8; z++) put(c, 4, 1, z, WIRE);
  for (let x = 6; x <= 8; x++) put(c, x, 1, 7, WIRE);
  put(c, 8, 1, 6, WIRE); put(c, 8, 1, 5, WIRE); put(c, 1, 1, 1, WIRE); put(c, 2, 1, 1, WIRE); put(c, 2, 1, 2, WIRE); put(c, 2, 1, 3, WIRE);
  SCENARIOS.push(scenario("branches", {
    size: [9, 3, 9], ticks: 20, note: "cross, T and corners from a floor lever",
    cells: c, events: [[1, "place", 0, 1, 4, LEVER, 5], [2, "use", 0, 1, 4], [9, "use", 0, 1, 4], [15, "use", 0, 1, 4]],
  }));
}
// Closed 5x5 ring: the classic loop depowers fully.
{
  const c = {};
  for (let i = 1; i <= 5; i++) { put(c, i, 1, 1, WIRE); put(c, i, 1, 5, WIRE); put(c, 1, 1, i, WIRE); put(c, 5, 1, i, WIRE); }
  SCENARIOS.push(scenario("loop", {
    size: [7, 3, 7], ticks: 20, cells: c, note: "ring of 16 wires with an outside lever",
    events: [[1, "place", 0, 1, 3, LEVER, 5], [2, "use", 0, 1, 3], [8, "use", 0, 1, 3], [14, "use", 0, 1, 3]],
  }));
}
// Up and down a stepped hill; a cutting block above a step breaks the climb.
{
  const h = [0, 0, 1, 2, 3, 3, 2, 1, 0, 0, 0], c = {};
  for (let x = 0; x < h.length; x++) {
    for (let y = 1; y <= h[x]; y++) put(c, x, y, 1, STONE);
    if (x > 0) put(c, x, h[x] + 1, 1, WIRE);
  }
  SCENARIOS.push(scenario("stairs-up-down", {
    size: [11, 7, 3], ticks: 26, cells: c, note: "wire over a 3-high stepped hill; stone placed above a lower step cuts it",
    events: [[1, "place", 0, 1, 1, LEVER, 5], [2, "use", 0, 1, 1], [8, "place", 2, 3, 1, STONE, 0], [13, "air", 2, 3, 1], [18, "place", 6, 4, 1, STONE, 0], [22, "use", 0, 1, 1]],
  }));
}
// Dust on top of a block strongly powers it (and the lamp beside and below it); dust under a block does not power it.
{
  const c = {};
  put(c, 2, 0, 1, LAMP); put(c, 2, 1, 1, STONE); put(c, 3, 1, 1, LAMP); put(c, 1, 1, 1, STONE);
  put(c, 1, 2, 1, WIRE); put(c, 2, 2, 1, WIRE); put(c, 0, 1, 1, STONE);
  put(c, 5, 1, 1, WIRE); put(c, 5, 2, 1, STONE); put(c, 5, 3, 1, LAMP); put(c, 6, 1, 1, WIRE); put(c, 6, 2, 1, LAMP);
  SCENARIOS.push(scenario("dust-over-under-block", {
    size: [8, 5, 3], ticks: 16, cells: c, note: "wire on a block powers it; wire under a block does not",
    events: [[1, "place", 0, 2, 1, LEVER, 5], [2, "use", 0, 2, 1], [2, "place", 7, 1, 1, REDSTONE_BLOCK, 0], [9, "use", 0, 2, 1], [9, "air", 7, 1, 1]],
  }));
}
// Lamp: on immediately, off after 4 ticks; re-powering inside the delay keeps it lit.
{
  const c = put(put({}, 1, 1, 1, LAMP), 2, 1, 1, LAMP);
  SCENARIOS.push(scenario("lamp-delay", {
    size: [4, 3, 3], ticks: 26, cells: c, note: "floor lever beside a lamp; second lamp is unpowered by the first",
    events: [[1, "place", 0, 1, 1, LEVER, 5], [2, "use", 0, 1, 1], [5, "use", 0, 1, 1], [12, "use", 0, 1, 1], [13, "use", 0, 1, 1], [14, "use", 0, 1, 1], [16, "use", 0, 1, 1]],
  }));
}
// Torch inverter driven by a wire into its block.
{
  const c = line(line(put({}, 3, 1, 1, STONE), 1, 2, 1, 1), 5, 8, 1, 1);
  SCENARIOS.push(scenario("torch-inverter", {
    size: [10, 3, 3], ticks: 20, cells: c, note: "wire into a block with a side torch feeding a line",
    events: [[1, "place", 4, 1, 1, TORCH, 1], [1, "place", 0, 1, 1, LEVER, 5], [3, "use", 0, 1, 1], [10, "use", 0, 1, 1]],
  }));
}
// Torch clock that burns out (8 toggles inside 60 ticks) and is re-lit by a neighbour change later.
{
  const c = put(put(put({}, 1, 1, 1, STONE), 2, 2, 1, STONE), 1, 2, 1, WIRE);
  SCENARIOS.push(scenario("torch-clock-burnout", {
    size: [4, 4, 3], ticks: 120, seed: 8675309, cells: c, note: "side torch powers dust on its own block; burnout then a poke at tick 100",
    events: [[1, "place", 2, 1, 1, TORCH, 1], [100, "place", 2, 1, 2, STONE, 0]],
  }));
}
// Burnout window edge: two lever-driven inverters turn off 8 times; the 8th turn-off comes 60 ticks
// (A, still inside the window: burns out) and 61 ticks (B, first toggle expired: no burnout) after the first.
{
  const c = put(put({}, 1, 1, 1, STONE), 1, 1, 4, STONE), ev = [];
  for (const z of [1, 4]) ev.push([1, "place", 0, 1, z, LEVER, 2], [1, "place", 2, 1, z, TORCH, 1]);
  for (let k = 0; k < 7; k++) for (const z of [1, 4]) ev.push([2 + 6 * k, "use", 0, 1, z], [5 + 6 * k, "use", 0, 1, z]);
  ev.push([62, "use", 0, 1, 1], [63, "use", 0, 1, 4], [70, "use", 0, 1, 1], [70, "use", 0, 1, 4]);
  ev.sort((a, b) => a[0] - b[0]);
  SCENARIOS.push(scenario("torch-burnout-window", {
    size: [4, 3, 6], ticks: 80, seed: 99, cells: c, note: "8 turn-offs spanning 60 vs 61 ticks", events: ev,
  }));
}
// Stone (20 ticks) and wooden (30 ticks) buttons, a lamp behind the block, a second press while pressed.
{
  const c = {};
  put(c, 1, 1, 1, STONE); put(c, 0, 1, 1, LAMP); line(c, 3, 6, 1, 1); put(c, 7, 1, 1, LAMP);
  put(c, 1, 1, 3, STONE); put(c, 0, 1, 3, LAMP); line(c, 3, 6, 1, 3); put(c, 7, 1, 3, LAMP);
  SCENARIOS.push(scenario("buttons", {
    size: [8, 3, 5], ticks: 40, cells: c, note: "stone and wooden buttons on block sides",
    events: [[1, "place", 2, 1, 1, STONE_BUTTON, 1], [1, "place", 2, 1, 3, WOOD_BUTTON, 1], [2, "use", 2, 1, 1], [2, "use", 2, 1, 3], [5, "use", 2, 1, 1], [26, "use", 2, 1, 1]],
  }));
}
// Negative coordinates across a chunk border: ChunkPosition hashes with negative values.
{
  const c = {};
  line(c, 1, 12, 1, 3);
  for (let z = 0; z <= 6; z++) put(c, 7, 1, z, WIRE);
  put(c, 3, 1, 4, WIRE); put(c, 3, 1, 5, WIRE); put(c, 10, 1, 2, WIRE); put(c, 11, 1, 2, WIRE);
  SCENARIOS.push(scenario("negative-chunk-border", {
    origin: [-7, 10, -5], size: [14, 3, 7], ticks: 18, cells: c, note: "branches spanning x = -1/0 and z = -1/0",
    events: [[1, "place", 0, 1, 3, LEVER, 5], [2, "use", 0, 1, 3], [9, "use", 0, 1, 3], [12, "air", 7, 1, 3], [14, "use", 0, 1, 3]],
  }));
}
// Section border: the climb places a wire in an empty 16-high section (y 16).
{
  const c = {};
  line(c, 1, 4, 1, 1);
  put(c, 5, 1, 1, STONE); put(c, 6, 1, 1, STONE); put(c, 6, 2, 1, STONE);
  SCENARIOS.push(scenario("section-border", {
    origin: [10, 14, 0], size: [10, 5, 3], ticks: 16, cells: c, note: "floor at y 14; wires placed at y 16 and 17 create a new section",
    events: [[1, "place", 0, 1, 1, LEVER, 5], [2, "use", 0, 1, 1], [3, "place", 5, 2, 1, WIRE, 0], [4, "place", 6, 3, 1, WIRE, 0], [5, "place", 7, 1, 1, WIRE, 0], [6, "place", 8, 1, 1, WIRE, 0], [10, "air", 5, 2, 1], [12, "use", 0, 1, 1]],
  }));
}
// Supports removed under dust, a side torch, a lever and a button: drops and Random draws.
{
  const c = {};
  line(c, 1, 3, 1, 1); put(c, 5, 1, 1, STONE); put(c, 5, 1, 3, STONE); put(c, 2, 1, 3, STONE);
  SCENARIOS.push(scenario("support-drops", {
    size: [8, 3, 5], ticks: 14, seed: 42, cells: c, note: "removing supporting blocks drops dust, torch, lever and button",
    events: [[1, "place", 6, 1, 1, TORCH, 1], [1, "place", 6, 1, 3, LEVER, 1], [1, "place", 3, 1, 3, STONE_BUTTON, 1], [2, "use", 6, 1, 3], [3, "use", 3, 1, 3], [4, "air", 2, 0, 1], [5, "air", 5, 1, 1], [6, "air", 5, 1, 3], [7, "air", 2, 1, 3], [9, "air", 1, 0, 1]],
  }));
}
// Dust on top and bottom slabs, glowstone, glass and a double slab; a torch on glass.
{
  const c = {};
  put(c, 1, 1, 1, `${SLAB}:8`); put(c, 2, 1, 1, SLAB); put(c, 3, 1, 1, GLOWSTONE); put(c, 4, 1, 1, GLASS); put(c, 5, 1, 1, DOUBLE_SLAB); put(c, 6, 1, 1, GLASS);
  SCENARIOS.push(scenario("support-surfaces", {
    size: [8, 4, 3], ticks: 10, seed: 7, floor: true, cells: c, note: "wire placed on each surface, then a redstone block triggers updates",
    events: [...[1, 2, 3, 4, 5].map((x) => [1, "place", x, 2, 1, WIRE, 0]), [1, "place", 6, 2, 1, TORCH, 5], [3, "place", 0, 2, 1, REDSTONE_BLOCK, 0], [3, "place", 1, 1, 0, STONE, 0], [5, "place", 7, 2, 1, WIRE, 0], [6, "air", 0, 2, 1]],
  }));
}
// Vertical torch tower driven by a wall lever.
{
  const c = {};
  for (const y of [1, 3, 5]) put(c, 1, y, 1, STONE);
  SCENARIOS.push(scenario("torch-tower", {
    size: [3, 8, 3], ticks: 30, cells: c, note: "torches stacked on blocks; wall lever on the bottom block",
    events: [[1, "place", 1, 2, 1, TORCH, 5], [1, "place", 1, 4, 1, TORCH, 5], [1, "place", 1, 6, 1, TORCH, 5], [1, "place", 0, 1, 1, LEVER, 2], [5, "use", 0, 1, 1], [15, "use", 0, 1, 1], [16, "use", 0, 1, 1]],
  }));
}
// Redstone block beside dust, under a torch and beside a lamp.
{
  const c = {};
  line(c, 2, 6, 1, 1); put(c, 1, 1, 3, LAMP);
  SCENARIOS.push(scenario("redstone-block", {
    size: [8, 4, 5], ticks: 14, cells: c, note: "redstone block placed/removed near dust, lamp and a torch on top of it",
    events: [[1, "place", 1, 1, 2, REDSTONE_BLOCK, 0], [2, "place", 1, 2, 2, TORCH, 5], [3, "place", 1, 1, 1, WIRE, 0], [8, "air", 1, 1, 2]],
  }));
}
// Filled 5x5 wire carpet from a corner lever: dense HashSet ordering.
{
  const c = {};
  for (let x = 1; x <= 5; x++) for (let z = 1; z <= 5; z++) put(c, x, 1, z, WIRE);
  SCENARIOS.push(scenario("wire-carpet", {
    size: [7, 3, 7], ticks: 12, cells: c, note: "25 wires; lever on, off, on",
    events: [[1, "place", 0, 1, 1, LEVER, 5], [2, "use", 0, 1, 1], [6, "use", 0, 1, 1], [9, "use", 0, 1, 1]],
  }));
}
// Levers on walls, ceilings and floors, placed powered and broken while powered.
{
  const c = {};
  put(c, 2, 1, 1, STONE); put(c, 2, 3, 1, STONE); put(c, 3, 1, 1, LAMP); put(c, 1, 1, 1, LAMP); put(c, 2, 1, 2, LAMP); put(c, 2, 4, 1, LAMP); put(c, 4, 1, 1, WIRE); put(c, 5, 1, 1, WIRE);
  SCENARIOS.push(scenario("lever-orientations", {
    size: [7, 5, 4], ticks: 20, cells: c, note: "ceiling, wall and powered-placed levers; breaking a powered lever",
    events: [[1, "place", 2, 2, 1, LEVER, 7], [2, "use", 2, 2, 1], [4, "place", 2, 1, 0, LEVER, 4 + 8], [6, "use", 2, 2, 1], [8, "air", 2, 1, 0], [10, "place", 2, 2, 2, LEVER, 5], [11, "use", 2, 2, 2], [14, "air", 2, 2, 2]],
  }));
}
// Torch beside a lamp, then the torch removed; an unlit torch placed on a powered block.
{
  const c = {};
  put(c, 2, 1, 1, LAMP); put(c, 4, 1, 1, STONE); put(c, 3, 1, 1, WIRE);
  SCENARIOS.push(scenario("torch-lamp", {
    size: [7, 3, 3], ticks: 16, cells: c, note: "floor torch lights a lamp; removal turns it off after 4 ticks",
    events: [[1, "place", 1, 1, 1, TORCH, 5], [3, "place", 5, 1, 1, UNLIT_TORCH, 1], [6, "air", 1, 1, 1], [9, "place", 3, 1, 0, LEVER, 5], [10, "use", 3, 1, 0]],
  }));
}

// ---- Native run ----
const researchDirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"),
  out = path.join(research, "redstone-probe"),
  clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
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
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-"].map(library));
const classes = path.join(out, "classes");
await rm(classes, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const probe = path.join(out, "probe");
await rm(probe, { recursive: true, force: true });
await mkdir(probe, { recursive: true });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/RedstoneProbe.java")]);
const input = SCENARIOS.map((s) => `scenario ${s.name} ${s.origin.join(" ")} ${s.size.join(" ")} ${s.ticks} ${s.seed}\ngrid ${s.grid}\n${s.events.map((e) => `event ${e.join(" ")}`).join("\n")}\n`).join("");
const child = spawn("java", ["-cp", cp, "RedstoneProbe"], { stdio: ["pipe", "pipe", "pipe"] });
let stdout = "", stderr = "";
child.stdout.on("data", (d) => (stdout += d));
child.stderr.on("data", (d) => (stderr += d));
child.stdin.end(input);
await new Promise((res, rej) => child.on("close", (c) => (c === 0 ? res() : rej(new Error("java exited " + c + "\n" + stderr)))));
const lines = stdout.trim().split("\n").map((l) => JSON.parse(l)),
  blocks = lines.shift();
assert.equal(blocks.kind, "blocks");
assert.equal(lines.length, SCENARIOS.length);

// ---- Compare ----
assert.deepEqual(blockProperties(), blocks.props, "block property table");
const f32 = Math.fround;
export function compare(s, native, mine) {
  for (let t = 0; t < s.ticks; t++) {
    assert.equal(mine.calls[t], native.calls[t], `${s.name}: call log at tick ${t + 1}`);
    assert.deepEqual(mine.frames[t], native.frames[t], `${s.name}: block changes at tick ${t + 1}`);
  }
  assert.equal(mine.final, native.final, `${s.name}: final region`);
  assert.deepEqual(mine.pending, native.pending, `${s.name}: pending ticks`);
  assert.equal(mine.sounds.length, native.sounds.length, `${s.name}: sounds`);
  mine.sounds.forEach((m, i) => {
    const n = native.sounds[i];
    assert.deepEqual(m.slice(0, 5), n.slice(0, 5), `${s.name}: sound ${i}`);
    assert.equal(m[5], f32(n[5]), `${s.name}: sound ${i} volume`);
    assert.equal(m[6], f32(n[6]), `${s.name}: sound ${i} pitch`);
  });
  assert.deepEqual(mine.drops, native.drops, `${s.name}: drops`);
  assert.equal(mine.rng, native.rng, `${s.name}: world Random after the run`);
}
let ticks = 0, calls = 0, changes = 0, sounds = 0, drops = 0;
const results = [];
for (const [i, native] of lines.entries()) {
  const s = SCENARIOS[i];
  assert.equal(native.name, s.name);
  compare(s, native, replayScenario(s));
  ticks += s.ticks;
  calls += native.calls.reduce((n, c) => n + (c ? c.split(" ").length : 0), 0);
  changes += native.frames.reduce((n, f) => n + f.length, 0);
  sounds += native.sounds.length;
  drops += native.drops.length;
  const { kind, name, ...rest } = native;
  results.push({ ...s, ...rest });
}
const digest = async (name) => createHash("sha256").update((await exec("unzip", ["-p", jar, name + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { ana: "BlockRedstoneWire", anc: "BlockRedstoneTorch", and: "BlockRedstoneTorch$Toggle", aoc: "BlockTorch", alv: "BlockLever", ajs: "BlockButton", anx: "BlockButtonStone", aon: "BlockButtonWood", anb: "BlockRedstoneLight", ams: "BlockCompressedPowered", agt: "ChunkPosition", ahs: "NextTickListEntry", ahb: "World", apx: "Chunk", apz: "ExtendedBlockStorage", aji: "Block" };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1,
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method:
    "Unchanged original redstone block classes run inside a real World (ahb, allocated without its constructor) with real Chunk (apx) and ExtendedBlockStorage objects from a stub chunk provider. Native: World.setBlock, setBlockMetadataWithNotify, notifyBlocksOfNeighborChange, notifyBlockOfNeighborChange, power queries, doesBlockHaveSolidTopSurface, isBlockNormalCubeDefault, Chunk.func_150807_a/setBlockMetadata, Block drops. Replaced: WorldServer scheduled ticks (copied: HashSet + TreeSet of original NextTickListEntry, 1000 cap, this-tick list), getTotalWorldTime, getGameRules (default GameRules), playSoundEffect/spawnEntityInWorld (recorded), spawnParticle (ignored), getEntitiesWithinAABB (empty), lighting updates (disabled). The wire's blocksNeedingUpdate HashSet is replaced by a fresh one per scenario; the JVM is Java 8+ (HashMap iteration order of Java 8 and later). Terrain is written straight into chunk sections; events of tick t run before tick t (world time advances, then tickUpdates). No random block ticks. Per tick: changed region cells [x,y,z,id,meta], and the call log: E,op event; s,x,y,z,id,meta,flags setBlock; m,x,y,z,meta,flags setBlockMetadataWithNotify; n,x,y,z,source notifyBlockOfNeighborChange; t,x,y,z,id,delay,priority scheduled tick; u,x,y,z,id updateTick; p,name sound; e,item dropped item; T world tick. sounds: [tick,x,y,z,name,volume,pitch]; drops: [tick,x,y,z,item,count,damage]; pending: [x,y,z,id,ticksLeft,priority]; rng: world Random nextInt() after the run.",
  blocks,
  scenarios: results,
};
await writeFile(path.join(root, "../public/research/redstone-reference.json"), JSON.stringify(reference) + "\n");
console.log(`PASS: ${SCENARIOS.length} scenarios, ${ticks} ticks, ${calls} logged calls, ${changes} cell changes, ${sounds} sounds, ${drops} drops identical to the original classes.`);
