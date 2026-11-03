// Runs redstone scenarios through the unchanged original BlockRedstoneWire, BlockRedstoneTorch,
// BlockTorch, BlockLever, BlockButton, BlockRedstoneLight, BlockCompressedPowered,
// BlockRedstoneRepeater/Diode, BlockRedstoneComparator (+ TileEntityComparator), pressure plates
// and the cauldron / end portal frame comparator overrides inside a
// real World/Chunk (tools/probes/RedstoneProbe.java) and through src/redstone.js, checks that
// every per-tick block/metadata change, call-log entry, comparator output signal, sound, item
// drop, pending tick and the world Random's next int agree, and writes public/research/redstone-reference.json for
// src/redstone.test.js. Needs a JDK, the pinned client JAR (tools/research or MC_RESEARCH) and
// the guava / log4j-api / commons-lang3 / netty-all library JARs (MC_PROBE_LIBS or a launcher/gradle cache).
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
const AIR = 0, STONE = 1, GLASS = 20, DOUBLE_SLAB = 43, SLAB = 44, WIRE = 55, LEVER = 69, STONE_PLATE = 70, WOOD_PLATE = 72,
  UNLIT_TORCH = 75, TORCH = 76, STONE_BUTTON = 77, GLOWSTONE = 89, REPEATER = 93, POWERED_REPEATER = 94, CAULDRON = 118,
  END_PORTAL_FRAME = 120, LAMP = 123, WOOD_BUTTON = 143, LIGHT_PLATE = 147, HEAVY_PLATE = 148, COMPARATOR = 149,
  POWERED_COMPARATOR = 150, REDSTONE_BLOCK = 152;
// Repeater / comparator metadata: bits 0-1 direction (1 = input from -x, output to +x; 3 = output to -x;
// 2 = input from -z, output to +z; 0 = output to -z), bits 2-3 repeater delay index, comparator bit 4 subtract.
const rep = (dir, delay = 0) => `${REPEATER}:${dir | (delay << 2)}`,
  cmp = (dir, subtract = false) => `${COMPARATOR}:${dir | (subtract ? 4 : 0)}`;
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

// ---- Diodes, comparators and pressure plates (REDSTONE-02) ----
// Levers are placed on the floor at tick 1 (meta 5) and toggled with "use".
const levers = (list, ticks) => list.flatMap(([x, y, z]) => [[1, "place", x, y, z, LEVER, 5], ...ticks.map((t) => [t, "use", x, y, z])]);
// Four repeaters in parallel, one per delay setting, each driving wire and a lamp; fast toggles near the delay edge.
{
  const c = {}, ev = [];
  for (let d = 0; d < 4; d++) { const z = 1 + 2 * d; put(c, 1, 1, z, rep(1, d)); put(c, 2, 1, z, WIRE); put(c, 3, 1, z, LAMP); ev.push(...levers([[0, 1, z]], [2, 14, 16, 30])); }
  SCENARIOS.push(scenario("repeater-delays", {
    size: [5, 3, 8], ticks: 44, cells: c, note: "repeaters with delay 2/4/6/8 ticks beside lever, wire and lamp; toggles 2 ticks apart",
    events: ev.sort((a, b) => a[0] - b[0]),
  }));
}
// Diode chains: mixed delays, a wire in the middle, then a plain 4-repeater chain with a 2-tick pulse.
{
  const c = {};
  put(c, 1, 1, 1, rep(1, 0)); put(c, 2, 1, 1, rep(1, 1)); put(c, 3, 1, 1, WIRE); put(c, 4, 1, 1, rep(1, 2)); put(c, 5, 1, 1, rep(1, 3)); put(c, 6, 1, 1, LAMP);
  for (let i = 1; i <= 4; i++) put(c, i, 1, 3, rep(1, 0)); put(c, 5, 1, 3, LAMP);
  SCENARIOS.push(scenario("repeater-chain", {
    size: [8, 3, 5], ticks: 50, cells: c, note: "adjacent repeaters in a line, mixed delays, a wire between",
    events: [...levers([[0, 1, 1], [0, 1, 3]], [2, 25, 27]), [26, "air", 6, 1, 1]].sort((a, b) => a[0] - b[0]),
  }));
}
// Ring of four repeaters and four corner wires; one redstone-block pulse starts a loop that never settles.
{
  const c = {};
  for (const [x, z] of [[1, 1], [3, 1], [3, 3], [1, 3]]) put(c, x, 1, z, WIRE);
  put(c, 2, 1, 1, rep(1, 0)); put(c, 3, 1, 2, rep(2, 0)); put(c, 2, 1, 3, rep(3, 0)); put(c, 1, 1, 2, rep(0, 0));
  SCENARIOS.push(scenario("repeater-clock", {
    size: [5, 3, 5], ticks: 80, cells: c, note: "repeater loop kicked by a 1-tick redstone block pulse, second pulse at tick 40",
    events: [[2, "place", 0, 1, 1, REDSTONE_BLOCK, 0], [3, "air", 0, 1, 1], [40, "place", 0, 1, 1, REDSTONE_BLOCK, 0], [41, "air", 0, 1, 1]],
  }));
}
// Locking: a side repeater facing the target holds its state. S1: lock while on. S2: lock while off.
// S3: lock from the other side. S4: a redstone block beside a repeater does not lock it.
{
  const c = {}, ev = [];
  const unit = (b, lockZ, delay) => {
    put(c, b + 2, 1, 5, rep(1, delay)); put(c, b + 3, 1, 5, WIRE); put(c, b + 4, 1, 5, LAMP);
    if (lockZ === 4) put(c, b + 2, 1, 4, rep(2, 0));
    if (lockZ === 6) put(c, b + 2, 1, 6, rep(0, 0));
  };
  unit(0, 4, 0); unit(6, 4, 1); unit(12, 6, 0); unit(18, 0, 0);
  const lock = (b, z) => [b + 2, 1, z];
  ev.push(...levers([[1, 1, 5]], [2, 14]), ...levers([lock(0, 3)], [10, 20]));
  ev.push(...levers([[7, 1, 5]], [8]), ...levers([lock(6, 3)], [2, 14]));
  ev.push(...levers([[13, 1, 5]], [2, 14]), ...levers([lock(12, 7)], [10, 20]));
  ev.push(...levers([[19, 1, 5]], [2, 14]), [8, "place", 20, 1, 4, REDSTONE_BLOCK, 0], [20, "air", 20, 1, 4]);
  SCENARIOS.push(scenario("repeater-lock", {
    size: [23, 3, 9], ticks: 36, cells: c, note: "repeater locking by side diodes: while on, while off, from the far side, and a non-locking redstone block",
    events: ev.sort((a, b) => a[0] - b[0]),
  }));
}
// Pulse shortening and extension: lever pulses of 1, 2, 3 and 5 ticks into repeaters of delay 2, 4 and 8.
{
  const c = {}, ev = [];
  [0, 1, 3].forEach((d, i) => {
    const z = 1 + 2 * i;
    put(c, 1, 1, z, rep(1, d)); put(c, 2, 1, z, WIRE); put(c, 3, 1, z, WIRE);
    ev.push([1, "place", 0, 1, z, LEVER, 5]);
    [[2, 1], [22, 2], [42, 3], [62, 5]].forEach(([on, w]) => ev.push([on, "use", 0, 1, z], [on + w, "use", 0, 1, z]));
  });
  SCENARIOS.push(scenario("repeater-pulses", {
    size: [5, 3, 6], ticks: 90, cells: c, note: "lever pulses of 1/2/3/5 ticks into delay 2, 4 and 8 repeaters",
    events: ev.sort((a, b) => a[0] - b[0]),
  }));
}
// Repeaters feeding solid blocks: strong output to the front powers the block, lamps beside it, a repeater behind it and a torch on it.
{
  const c = {}, ev = [];
  put(c, 1, 1, 1, rep(1, 1)); put(c, 2, 1, 1, STONE); put(c, 2, 2, 1, LAMP); put(c, 2, 1, 0, LAMP); put(c, 2, 1, 2, LAMP);
  put(c, 3, 1, 1, rep(1, 0)); put(c, 4, 1, 1, WIRE); put(c, 5, 1, 1, LAMP);
  put(c, 1, 1, 5, rep(1, 0)); put(c, 2, 1, 5, STONE); put(c, 3, 1, 5, TORCH + ":1"); put(c, 4, 1, 5, WIRE); put(c, 5, 1, 5, LAMP);
  put(c, 1, 1, 9, rep(1, 0)); put(c, 2, 1, 9, WIRE); put(c, 3, 1, 9, STONE); put(c, 3, 2, 9, WIRE); put(c, 4, 2, 9, WIRE); put(c, 5, 2, 9, LAMP);
  ev.push(...levers([[0, 1, 1], [0, 1, 5], [0, 1, 9]], [2, 15, 17, 30]));
  SCENARIOS.push(scenario("repeater-solid", {
    size: [7, 4, 11], ticks: 45, cells: c, note: "repeater into a stone block feeding lamps, a second repeater and a torch; wire into a block topped by dust",
    events: ev.sort((a, b) => a[0] - b[0]),
  }));
}
// Wire, repeaters and a torch inverter in one line, with a branch lamp.
{
  const c = {};
  line(c, 1, 3, 1, 1); put(c, 4, 1, 1, rep(1, 1)); put(c, 5, 1, 1, WIRE); put(c, 6, 1, 1, WIRE); put(c, 7, 1, 1, STONE);
  put(c, 11, 1, 1, rep(1, 2)); put(c, 12, 1, 1, WIRE); put(c, 13, 1, 1, LAMP);
  put(c, 6, 1, 2, WIRE); put(c, 7, 1, 2, LAMP);
  SCENARIOS.push(scenario("repeater-mixed", {
    size: [15, 3, 4], ticks: 70, cells: c, seed: 11, note: "lever, wire, repeater, torch inverter, repeater, lamp, and a branch lamp",
    events: [[1, "place", 8, 1, 1, TORCH, 1], [1, "place", 9, 1, 1, WIRE, 0], [1, "place", 10, 1, 1, WIRE, 0], ...levers([[0, 1, 1]], [2, 20, 22, 40])].sort((a, b) => a[0] - b[0]),
  }));
}
// Placement by a player facing each yaw, redstone block inputs, delay cycling, support loss and a neighbour update on glass.
{
  const c = put({}, 9, 0, 1, GLASS), ev = [];
  [[1, 1, 0], [3, 1, 90], [5, 1, 180], [7, 1, 270], [1, 5, 45], [3, 5, 44.9], [5, 5, -135], [7, 5, 359]].forEach(([x, z, yaw]) => ev.push([1, "placeby", x, 1, z, REPEATER, yaw]));
  // Input cells (behind each repeater): yaw 0 -> facing 2 (input z-1), 90 -> 3 (x+1), 180 -> 0 (z+1), 270 -> 1 (x-1), 45 -> 3, -135 -> 1.
  for (const [x, z] of [[1, 0], [4, 1], [5, 2], [6, 1], [2, 5], [4, 5]]) ev.push([2, "place", x, 1, z, LEVER, 5], [3, "use", x, 1, z]);
  ev.push([3, "use", 1, 1, 1], [4, "use", 1, 1, 1], [5, "use", 1, 1, 1], [6, "use", 1, 1, 1], [3, "use", 3, 1, 1], [3, "use", 3, 1, 5]);
  ev.push([10, "air", 1, 0, 1], [11, "air", 3, 0, 5], [12, "place", 9, 1, 1, REPEATER, 0], [13, "place", 10, 1, 1, STONE, 0]);
  SCENARIOS.push(scenario("repeater-placement", {
    size: [11, 3, 8], ticks: 24, seed: 5, cells: c, note: "onBlockPlacedBy at eight yaws, lever inputs behind them, delay cycling, support removal and glass base drops",
    events: ev.sort((a, b) => a[0] - b[0]),
  }));
}

// Comparator compare/subtract: rear wire level 9..15, side wire or lever, output wire and lamp.
{
  const c = {}, ev = [];
  // [z, rear lever x, side wire count (0 = lever side), sideLeverOnOtherSide, subtract]
  const rows = [[5, 6, 4, false, false], [12, 0, 1, false, false], [19, 3, 4, false, false], [26, 4, 0, true, false],
    [33, 6, 4, false, true], [40, 0, 1, false, true], [47, 3, 4, false, true], [54, 4, 0, true, true]];
  for (const [z, L, j, other, sub] of rows) {
    line(c, L + 1, 7, 1, z); put(c, 8, 1, z, cmp(1, sub)); line(c, 9, 10, 1, z); put(c, 11, 1, z, LAMP);
    ev.push(...levers([[L, 1, z]], [2, 20]));
    if (j > 0) {
      for (let k = 0; k < j; k++) put(c, 8, 1, z - 1 - k, WIRE);
      ev.push(...levers([[8, 1, z - 1 - j]], [8, 26]));
    } else if (other) ev.push(...levers([[8, 1, z + 1]], [8, 26]));
    else ev.push(...levers([[8, 1, z - 1]], [8, 26]));
    ev.push([30, "use", 8, 1, z], [34, "use", 8, 1, z]);
  }
  SCENARIOS.push(scenario("comparator-modes", {
    size: [13, 3, 58], ticks: 40, cells: c, note: "compare and subtract comparators with wire and lever side inputs; mode toggled at ticks 30 and 34",
    events: ev.sort((a, b) => a[0] - b[0]),
  }));
}
// Rear input reading container output: cauldron water level and end portal frame eye, directly and through a solid block.
{
  const c = {}, ev = [];
  put(c, 1, 1, 1, CAULDRON); put(c, 2, 1, 1, STONE); put(c, 3, 1, 1, cmp(1)); put(c, 4, 1, 1, WIRE); put(c, 5, 1, 1, LAMP);
  put(c, 1, 1, 4, CAULDRON); put(c, 2, 1, 4, cmp(1)); put(c, 3, 1, 4, WIRE); put(c, 4, 1, 4, LAMP);
  put(c, 2, 1, 7, STONE); put(c, 3, 1, 7, cmp(1, true)); put(c, 4, 1, 7, WIRE); put(c, 5, 1, 7, LAMP);
  put(c, 1, 1, 10, CAULDRON); put(c, 2, 1, 10, STONE); put(c, 3, 1, 10, cmp(1, true)); put(c, 4, 1, 10, WIRE); put(c, 5, 1, 10, LAMP);
  for (const z of [1, 4, 10]) ev.push([2, "cauldron", 1, 1, z, 1], [5, "cauldron", 1, 1, z, 2], [8, "cauldron", 1, 1, z, 3], [11, "cauldron", 1, 1, z, 1], [14, "cauldron", 1, 1, z, 0]);
  ev.push([2, "place", 1, 1, 7, END_PORTAL_FRAME, 4], [6, "place", 1, 1, 7, END_PORTAL_FRAME, 0], [18, "place", 1, 1, 7, END_PORTAL_FRAME, 4]);
  ev.push(...levers([[3, 1, 11]], [10, 13]));
  SCENARIOS.push(scenario("comparator-container", {
    size: [7, 3, 12], ticks: 26, cells: c, note: "cauldron levels 0-3 and end portal frame eyes read directly and through a stone block; subtract with a side lever",
    events: ev.sort((a, b) => a[0] - b[0]),
  }));
}
// Comparator clock: a subtract comparator whose output wire loops back into its side.
{
  const c = {};
  put(c, 1, 1, 2, WIRE); put(c, 2, 1, 2, cmp(1, true)); put(c, 3, 1, 2, WIRE); put(c, 3, 1, 3, WIRE); put(c, 2, 1, 3, WIRE);
  SCENARIOS.push(scenario("comparator-clock", {
    size: [5, 3, 5], ticks: 80, cells: c, note: "subtract comparator output looped back to its own side input; lever on at tick 2, off at tick 60",
    events: levers([[0, 1, 2]], [2, 60]).sort((a, b) => a[0] - b[0]),
  }));
}
// Comparators between repeaters, another comparator, a solid block and wire.
{
  const c = {}, ev = [];
  put(c, 1, 1, 1, rep(1, 1)); put(c, 2, 1, 1, WIRE); put(c, 3, 1, 1, WIRE); put(c, 4, 1, 1, cmp(1)); put(c, 5, 1, 1, WIRE);
  put(c, 6, 1, 1, cmp(1, true)); put(c, 7, 1, 1, WIRE); put(c, 8, 1, 1, rep(1, 0)); put(c, 9, 1, 1, LAMP);
  line(c, 1, 2, 1, 5); put(c, 3, 1, 5, STONE); put(c, 4, 1, 5, cmp(1)); put(c, 5, 1, 5, WIRE); put(c, 6, 1, 5, LAMP);
  ev.push(...levers([[0, 1, 1], [4, 1, 0], [6, 1, 2], [0, 1, 5]], [2]));
  // levers are toggled individually below
  const evs = [...ev.filter((e) => e[1] === "place"), [2, "use", 0, 1, 1], [14, "use", 4, 1, 0], [20, "use", 6, 1, 2], [30, "use", 0, 1, 1], [36, "use", 4, 1, 0], [40, "use", 6, 1, 2], [3, "use", 0, 1, 5], [25, "use", 0, 1, 5]];
  SCENARIOS.push(scenario("comparator-mixed", {
    size: [11, 3, 7], ticks: 56, cells: c, note: "lever, repeater, comparator, comparator (subtract), repeater, lamp; a comparator reading through a stone block",
    events: evs.sort((a, b) => a[0] - b[0]),
  }));
}
// Comparator placement: onBlockPlacedBy, mode toggles with click sounds, and support removal dropping item 404.
{
  const c = put({}, 7, 0, 1, GLASS), ev = [];
  [[1, 1, 0], [3, 1, 90], [5, 1, 180], [1, 4, 270]].forEach(([x, z, yaw]) => ev.push([1, "placeby", x, 1, z, COMPARATOR, yaw]));
  // Input cells: yaw 0 -> facing 2 (z-1), 90 -> 3 (x+1), 180 -> 0 (z+1), 270 -> 1 (x-1).
  for (const [x, z] of [[1, 0], [4, 1], [5, 2], [0, 4]]) ev.push([2, "place", x, 1, z, LEVER, 5], [3, "use", x, 1, z]);
  ev.push([4, "use", 3, 1, 1], [6, "use", 3, 1, 1], [7, "use", 5, 1, 1], [9, "use", 1, 1, 1], [10, "use", 1, 1, 4]);
  ev.push([12, "air", 3, 0, 1], [13, "air", 2, 1, 1], [14, "place", 7, 1, 1, COMPARATOR, 1], [15, "place", 8, 1, 1, STONE, 0]);
  SCENARIOS.push(scenario("comparator-placement", {
    size: [9, 3, 7], ticks: 24, seed: 3, cells: c, note: "comparators placed at four yaws, lever on the rear, mode toggles, support loss drops, glass base",
    events: ev.sort((a, b) => a[0] - b[0]),
  }));
}
// Pressure plates with scripted entities: stone (living only), wood (any), weighted light (15) and heavy (150).
{
  const c = {}, ev = [];
  const rows = [[1, STONE_PLATE], [3, WOOD_PLATE], [5, LIGHT_PLATE], [7, HEAVY_PLATE]];
  for (const [z, id] of rows) { put(c, 1, 1, z, id); put(c, 2, 1, z, WIRE); put(c, 3, 1, z, WIRE); put(c, 4, 1, z, LAMP); }
  const add = (t, z, kind, n = 1) => { for (let i = 0; i < n; i++) ev.push([t, "entity", 1, 1, z, kind]); ev.push([t, "collide", 1, 1, z]); };
  add(2, 1, 0); add(3, 3, 0); add(6, 1, 1); add(8, 1, 2);
  add(2, 5, 0, 3); add(5, 5, 0, 5); add(9, 5, 0, 10);
  add(3, 7, 0, 11); add(8, 7, 0, 20); add(12, 7, 0, 120);
  for (const z of [1, 3, 5, 7]) ev.push([30, "unentity", 1, 1, z]);
  ev.push([12, "unentity", 1, 1, 1], [25, "unentity", 1, 1, 5]);
  SCENARIOS.push(scenario("pressure-plates", {
    size: [6, 3, 9], ticks: 55, cells: c, note: "stone plate ignores items; wood plate takes them; light plate strength = count; heavy plate 1, 2, 4 and 15 with 11, 31 and 151 entities",
    events: ev.sort((a, b) => a[0] - b[0]),
  }));
}
// Plate support: removal, a plate on glass, and a plate under a strong-powered block.
{
  const c = put({}, 4, 0, 1, GLASS), ev = [];
  put(c, 1, 1, 1, STONE_PLATE); put(c, 2, 1, 1, WOOD_PLATE); put(c, 1, 1, 3, LIGHT_PLATE); put(c, 2, 1, 3, HEAVY_PLATE); put(c, 3, 1, 3, LAMP);
  put(c, 1, 0, 3, STONE); put(c, 0, 0, 3, LAMP);
  ev.push([2, "entity", 1, 1, 3, 1], [2, "collide", 1, 1, 3], [4, "air", 1, 0, 1], [6, "air", 2, 0, 1], [8, "place", 4, 1, 1, STONE_PLATE, 0], [9, "place", 5, 1, 1, STONE, 0], [12, "air", 1, 0, 3]);
  SCENARIOS.push(scenario("pressure-plate-support", {
    size: [7, 3, 5], ticks: 20, seed: 9, cells: c, note: "plates losing their floor drop; a plate on glass drops after a neighbour update; a pressed plate powers the block below",
    events: ev.sort((a, b) => a[0] - b[0]),
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
const libs = await Promise.all(["guava-", "log4j-api-", "commons-lang3-", "netty-all-"].map(library));
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
    assert.deepEqual(mine.tiles[t], native.tiles[t], `${s.name}: comparator outputs at tick ${t + 1}`);
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
let ticks = 0, calls = 0, changes = 0, sounds = 0, drops = 0, tileChanges = 0;
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
  if (rest.tiles.every((t) => t.length === 0)) delete rest.tiles;
  else tileChanges += rest.tiles.reduce((n, t) => n + t.length, 0);
  results.push({ ...s, ...rest });
}
const digest = async (name) => createHash("sha256").update((await exec("unzip", ["-p", jar, name + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { ana: "BlockRedstoneWire", anc: "BlockRedstoneTorch", and: "BlockRedstoneTorch$Toggle", aoc: "BlockTorch", alv: "BlockLever", ajs: "BlockButton", anx: "BlockButtonStone", aon: "BlockButtonWood", anb: "BlockRedstoneLight", ams: "BlockCompressedPowered", anf: "BlockRedstoneRepeater", akj: "BlockRedstoneDiode", akc: "BlockRedstoneComparator", aoz: "TileEntityComparator", amu: "BlockPressurePlate", aol: "BlockPressurePlateWeighted", ajd: "BlockBasePressurePlate", ajw: "BlockCauldron", aku: "BlockEndPortalFrame", agt: "ChunkPosition", ahs: "NextTickListEntry", ahb: "World", apx: "Chunk", apz: "ExtendedBlockStorage", aji: "Block" };
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1,
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method:
    "Unchanged original redstone block classes run inside a real World (ahb, allocated without its constructor) with real Chunk (apx) and ExtendedBlockStorage objects from a stub chunk provider. Native: World.setBlock, setBlockMetadataWithNotify, notifyBlocksOfNeighborChange, notifyBlockOfNeighborChange, power queries, doesBlockHaveSolidTopSurface, isBlockNormalCubeDefault, Chunk.func_150807_a/setBlockMetadata, Block drops. Replaced: WorldServer scheduled ticks (copied: HashSet + TreeSet of original NextTickListEntry, 1000 cap, this-tick list), getTotalWorldTime, getGameRules (default GameRules), playSoundEffect/spawnEntityInWorld (recorded), spawnParticle (ignored), getEntitiesWithinAABB (a scripted entity list with strict AABB intersection: allocated item xk, zombie yq and player mw objects), loaded tile entity lists (empty ArrayLists), lighting updates (disabled). Real: TileEntityComparator (aoz) created by the comparator block, Chunk tile entity maps, World.func_147453_f comparator updates, BlockCauldron.func_150024_a and BlockEndPortalFrame comparator overrides, ItemReed-style placement (setBlock(block,0,3) then onBlockPlacedBy with a placer yaw). The wire's blocksNeedingUpdate HashSet is replaced by a fresh one per scenario; the JVM is Java 8+ (HashMap iteration order of Java 8 and later). Terrain is written straight into chunk sections; events of tick t run before tick t (world time advances, then tickUpdates). No random block ticks. Per tick: changed region cells [x,y,z,id,meta], and the call log: E,op event; s,x,y,z,id,meta,flags setBlock; m,x,y,z,meta,flags setBlockMetadataWithNotify; n,x,y,z,source notifyBlockOfNeighborChange; t,x,y,z,id,delay,priority scheduled tick; u,x,y,z,id updateTick; p,name sound; e,item dropped item; T world tick; scripted events place, air, use, placeby (block, yaw), cauldron (water level), entity (0 item, 1 mob, 2 player), unentity, collide (onEntityCollidedWithBlock with a null entity). tiles (only when non-empty): per tick [x,y,z,signal] changes of the TileEntityComparator output signal. sounds: [tick,x,y,z,name,volume,pitch]; drops: [tick,x,y,z,item,count,damage]; pending: [x,y,z,id,ticksLeft,priority]; rng: world Random nextInt() after the run.",
  blocks,
  scenarios: results,
};
await writeFile(path.join(root, "../public/research/redstone-reference.json"), JSON.stringify(reference) + "\n");
console.log(`PASS: ${SCENARIOS.length} scenarios, ${ticks} ticks, ${calls} logged calls, ${changes} cell changes, ${tileChanges} comparator output changes, ${sounds} sounds, ${drops} drops identical to the original classes.`);
