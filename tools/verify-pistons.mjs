// Runs piston scenarios (REDSTONE-04) through the unchanged original BlockPistonBase (normal 33 / sticky 29),
// BlockPistonExtension (34), BlockPistonMoving (36) and TileEntityPiston inside a real World/Chunk
// (tools/probes/PistonProbe.java) and through src/redstone.js, checks that every per-tick block/metadata
// change, call-log entry (setBlock, metadata, neighbour notification, scheduled tick, block event queued and
// delivered, tile entity set/remove, sound, drop), piston tile-entity state (block, metadata, facing, extending,
// head, progress, last progress), pending tick and queued event, sound, item drop and the world Random's next
// int agree, and writes public/research/piston-reference.json for src/pistons.test.js. Needs a JDK, the pinned
// client JAR (tools/research or MC_RESEARCH) and the guava / log4j-api / commons-lang3 / netty-all library JARs
// (MC_PROBE_LIBS or a launcher/gradle cache). MC_PISTON_NATIVE_ONLY=1 prints the native result per scenario to
// stdout without replaying src/redstone.js or writing the reference (development aid).
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const exec = promisify(execFile),
  root = path.dirname(fileURLToPath(import.meta.url)),
  exists = (p) => access(p).then(() => true, () => false);

// ---- Scenarios (region-relative coordinates; y = 0 is a stone floor) ----
const AIR = 0, STONE = 1, DIRT = 3, BEDROCK = 7, GLASS = 20, STICKY = 29, PISTON = 33, HEAD = 34, MOVING = 36,
  DANDELION = 37, POPPY = 38, OBSIDIAN = 49, WIRE = 55, CHEST = 54, LEVER = 69, UNLIT_TORCH = 75, TORCH = 76,
  STONE_BUTTON = 77, REPEATER = 93, LAMP = 123, REDSTONE_BLOCK = 152, STONE_PLATE = 70;
const FX = [0, 0, 0, 0, -1, 1], FY = [-1, 1, 0, 0, 0, 0], FZ = [0, 0, -1, 1, 0, 0];
function scenario(name, { origin = [0, 0, 0], size, ticks, seed = 1, floor = true, cells = {}, events = [], note }) {
  const [dx, dy, dz] = size,
    grid = [];
  for (let x = 0; x < dx; x++)
    for (let y = 0; y < dy; y++)
      for (let z = 0; z < dz; z++) {
        const v = cells[`${x},${y},${z}`] ?? (floor && y === 0 ? STONE : AIR);
        grid.push(String(v));
      }
  return { name, note, origin, size, ticks, seed, sky: 15, skylightSubtracted: 0, angle: 0, noSky: false, pistons: true, grid: grid.join(","), events };
}
const put = (cells, x, y, z, v) => ((cells[`${x},${y},${z}`] = v), cells);
const line = (cells, x0, x1, y, z, v) => {
  for (let x = x0; x <= x1; x++) put(cells, x, y, z, v);
  return cells;
};
// A retracted piston: metadata is the facing (0 down, 1 up, 2 north -z, 3 south +z, 4 west -x, 5 east +x).
const piston = (facing, sticky = false) => `${sticky ? STICKY : PISTON}:${facing}`;
// An extended piston: base metadata facing | 8 with its head (metadata facing, +8 when sticky) in front.
const extended = (c, x, y, z, facing, sticky = false) => {
  put(c, x, y, z, `${sticky ? STICKY : PISTON}:${facing | 8}`);
  put(c, x + FX[facing], y + FY[facing], z + FZ[facing], `${HEAD}:${facing | (sticky ? 8 : 0)}`);
  return c;
};
const lever = (on = false) => `${LEVER}:${5 | (on ? 8 : 0)}`;

const SCENARIOS = [];
// ---- Single pushes and pulls ----
for (const sticky of [false, true]) {
  const c = {};
  put(c, 1, 1, 1, piston(5, sticky)); put(c, 2, 1, 1, STONE); put(c, 1, 1, 2, lever());
  SCENARIOS.push(scenario(sticky ? "sticky-pull-single" : "push-single", {
    size: [6, 3, 4], ticks: 22, cells: c, events: [[2, "use", 1, 1, 2], [10, "use", 1, 1, 2]],
    note: `${sticky ? "sticky" : "normal"} piston pushes one stone east and ${sticky ? "pulls it back" : "retracts leaving it"}`,
  }));
}
// Twelve pushed blocks work; thirteen never queue an extend event; a thirteenth block placed between the
// power update and the delivery makes tryExtend fail after the event was queued.
for (const [name, count, note] of [["push-12", 12, "twelve stones are pushed"], ["push-13-fails", 13, "thirteen stones cannot be pushed: canExtend is false, nothing is queued"]]) {
  const c = {};
  put(c, 1, 1, 1, piston(5)); line(c, 2, 1 + count, 1, 1, STONE); put(c, 1, 1, 2, lever());
  SCENARIOS.push(scenario(name, { size: [18, 3, 4], ticks: 26, cells: c, events: [[2, "use", 1, 1, 2], [12, "use", 1, 1, 2]], note }));
}
{
  const c = {};
  put(c, 1, 1, 1, piston(5)); line(c, 2, 13, 1, 1, STONE); put(c, 1, 1, 2, lever());
  SCENARIOS.push(scenario("push-12-race-13th", {
    size: [18, 3, 4], ticks: 16, cells: c, events: [[2, "use", 1, 1, 2], [2, "place", 14, 1, 1, STONE, 0], [8, "use", 1, 1, 2]],
    note: "twelve stones, lever on queues the event, a thirteenth stone is placed in the same tick: the delivered event fails",
  }));
}
{
  const c = {};
  put(c, 1, 1, 1, piston(5)); line(c, 2, 13, 1, 1, STONE); put(c, 14, 1, 1, `${TORCH}:5`); put(c, 1, 1, 2, lever());
  SCENARIOS.push(scenario("push-12-plus-torch", {
    size: [18, 3, 4], ticks: 22, cells: c, events: [[2, "use", 1, 1, 2], [10, "use", 1, 1, 2]],
    note: "twelve stones then a torch at the thirteenth cell: the torch is broken and dropped, the line moves",
  }));
}
// ---- Immovable blocks: each lane has its own piston and a redstone block placed beside it ----
{
  const c = {}, ev = [], lanes = [
    ["obsidian", (z) => put(c, 2, 1, z, OBSIDIAN)],
    ["bedrock", (z) => put(c, 2, 1, z, BEDROCK)],
    ["chest (tile entity)", (z) => put(c, 2, 1, z, CHEST)],
    ["extended piston", (z) => extended(put(c, 2, 1, z, `${PISTON}:${8 | 5}`), 2, 1, z, 5) && put(c, 2, 1, z, `${PISTON}:13`)],
    ["stone then obsidian", (z) => { put(c, 2, 1, z, STONE); put(c, 3, 1, z, OBSIDIAN); }],
    ["retracted piston (pushable)", (z) => put(c, 2, 1, z, piston(5))],
    ["piston head only", (z) => put(c, 2, 1, z, `${HEAD}:5`)],
    ["lit lamp?no: stone (pushable control)", (z) => put(c, 2, 1, z, STONE)],
  ];
  lanes.forEach(([, fill], i) => { const z = 1 + 3 * i; put(c, 1, 1, z, piston(5)); fill(z); ev.push([2, "place", 1, 1, z + 1, REDSTONE_BLOCK, 0]); });
  SCENARIOS.push(scenario("immovable-blocks", {
    size: [8, 3, 3 * lanes.length + 1], ticks: 14, cells: c, events: ev,
    note: "lanes: obsidian, bedrock, chest, extended piston, stone behind obsidian, retracted piston, lone piston head, plain stone control",
  }));
}
// ---- Mobility-1 blocks are broken and dropped (world Random draws, dropped items) ----
{
  const c = {}, ev = [], lanes = [
    ["dandelion", DANDELION, DIRT],
    ["poppy", POPPY, DIRT],
    ["wire", WIRE, STONE],
    ["lever", `${LEVER}:5`, STONE],
    ["powered lever", `${LEVER}:13`, STONE],
    ["repeater", `${REPEATER}:1`, STONE],
    ["unlit torch", `${UNLIT_TORCH}:5`, STONE],
    ["lit torch", `${TORCH}:5`, STONE],
    ["stone button", `${STONE_BUTTON}:1`, STONE],
  ];
  lanes.forEach(([, block, below], i) => {
    const z = 1 + 3 * i;
    put(c, 1, 1, z, piston(5)); put(c, 2, 1, z, block); put(c, 2, 0, z, below); put(c, 3, 1, z, STONE);
    if (block === `${STONE_BUTTON}:1`) put(c, 2, 1, z, `${STONE_BUTTON}:4`), put(c, 3, 1, z, STONE);
    ev.push([2, "place", 1, 1, z + 1, REDSTONE_BLOCK, 0]);
  });
  SCENARIOS.push(scenario("push-drops", {
    size: [8, 3, 3 * lanes.length + 1], ticks: 14, seed: 20241103, cells: c, events: ev,
    note: "a mobility-1 block in front of each piston (flowers, wire, levers, repeater, torches, button) is broken: Block.dropBlockAsItem draws and item entities",
  }));
}
// ---- Pulses shorter than the extension (normal and sticky) ----
for (const sticky of [false, true]) {
  const c = {}, ev = [];
  for (let len = 1; len <= 6; len++) {
    const z = 1 + 3 * (len - 1);
    put(c, 1, 1, z, piston(5, sticky)); put(c, 2, 1, z, STONE); put(c, 1, 1, z + 1, lever());
    ev.push([2, "use", 1, 1, z + 1], [2 + len, "use", 1, 1, z + 1]);
  }
  SCENARIOS.push(scenario(sticky ? "sticky-pulses" : "normal-pulses", {
    size: [6, 3, 19], ticks: 20, cells: c, events: ev,
    note: `${sticky ? "sticky" : "normal"} pistons with lever pulses of 1 to 6 ticks; stone in front. Short sticky pulses hit the moving-block branch of the 1.7.10 retraction`,
  }));
}
// ---- Sticky pull exceptions ----
{
  const c = {}, ev = [], lanes = [
    ["torch", (z) => put(c, 3, 1, z, `${TORCH}:5`)],
    ["retracted piston", (z) => put(c, 3, 1, z, piston(5))],
    ["extended piston", (z) => extended(c, 3, 1, z, 5)],
    ["obsidian", (z) => put(c, 3, 1, z, OBSIDIAN)],
    ["stone", (z) => put(c, 3, 1, z, STONE)],
    ["wire", (z) => put(c, 3, 1, z, WIRE)],
    ["air", () => {}],
  ];
  lanes.forEach(([, fill], i) => {
    const z = 1 + 3 * i;
    extended(c, 1, 1, z, 5, true); put(c, 1, 1, z + 1, lever(true)); fill(z);
    ev.push([3, "use", 1, 1, z + 1]);
  });
  SCENARIOS.push(scenario("sticky-pull-exceptions", {
    size: [8, 3, 3 * lanes.length + 1], ticks: 12, seed: 5, cells: c, events: ev,
    note: "extended sticky pistons retract with a torch, retracted piston, extended piston, obsidian, stone, wire or air in front of the head",
  }));
}
// ---- Quasi-connectivity (BUD) ----
{
  const c = {}, ev = [];
  put(c, 1, 1, 1, piston(5)); put(c, 2, 1, 1, STONE);
  // Redstone block two above the piston: only a block update at the piston makes it extend.
  ev.push([2, "place", 1, 3, 1, REDSTONE_BLOCK, 0], [6, "place", 1, 1, 2, STONE, 0], [9, "air", 1, 3, 1], [12, "air", 1, 1, 2], [15, "place", 1, 1, 2, STONE, 0]);
  // Diagonal quasi cells (y + 1, one block to each side) on three more pistons.
  put(c, 1, 1, 5, piston(5)); put(c, 2, 1, 5, STONE);
  put(c, 1, 1, 9, piston(5)); put(c, 2, 1, 9, STONE);
  put(c, 1, 1, 13, piston(5)); put(c, 2, 1, 13, STONE);
  ev.push([2, "place", 1, 2, 4, REDSTONE_BLOCK, 0], [2, "place", 1, 2, 10, REDSTONE_BLOCK, 0], [2, "place", 0, 2, 13, REDSTONE_BLOCK, 0]);
  ev.push([6, "place", 0, 1, 5, STONE, 0], [6, "place", 0, 1, 9, STONE, 0], [6, "place", 0, 1, 13, STONE, 0]);
  SCENARIOS.push(scenario("quasi-connectivity", {
    size: [6, 5, 16], ticks: 22, cells: c, events: ev,
    note: "redstone blocks at (x,y+2,z), (x,y+1,z-1), (x,y+1,z+1) and (x-1,y+1,z) power the piston only after a block update; removal does not retract until another update",
  }));
}
// ---- Pistons moving redstone circuits ----
{
  const c = {}, ev = [];
  // Piston pushes a redstone block towards a wire/lamp line, then (sticky) pulls it away.
  for (const [z, sticky] of [[1, false], [5, true]]) {
    put(c, 1, 1, z, piston(5, sticky)); put(c, 2, 1, z, REDSTONE_BLOCK); put(c, 1, 1, z + 1, lever());
    line(c, 4, 7, 1, z, WIRE); put(c, 8, 1, z, LAMP);
    ev.push([2, "use", 1, 1, z + 1], [14, "use", 1, 1, z + 1]);
  }
  // Piston pushes a stone into a torch's support block line: torch tower beside the path.
  put(c, 1, 1, 9, piston(5)); put(c, 2, 1, 9, STONE); put(c, 3, 1, 8, `${TORCH}:4`); put(c, 4, 1, 8, WIRE); put(c, 5, 1, 8, LAMP); put(c, 1, 1, 10, lever());
  ev.push([2, "use", 1, 1, 10], [14, "use", 1, 1, 10]);
  SCENARIOS.push(scenario("piston-redstone-circuits", {
    size: [10, 4, 12], ticks: 30, cells: c, events: ev,
    note: "normal and sticky pistons move a redstone block along a wire/lamp line (power returns when the moved block lands); a stone pushed against a torch's wall",
  }));
}
// ---- Double extension chains ----
{
  const c = {}, ev = [];
  put(c, 1, 1, 1, piston(5, true)); put(c, 2, 1, 1, piston(5, true)); put(c, 4, 1, 1, STONE);
  put(c, 1, 1, 2, lever()); put(c, 3, 1, 2, lever());
  ev.push([2, "use", 1, 1, 2], [8, "use", 3, 1, 2], [16, "use", 3, 1, 2], [22, "use", 1, 1, 2]);
  SCENARIOS.push(scenario("double-extender", {
    size: [9, 3, 4], ticks: 34, cells: c, events: ev,
    note: "sticky piston A pushes retracted sticky piston B and a stone; B is then powered at its new position and extends; both retract",
  }));
}
{
  const c = {}, ev = [];
  put(c, 1, 1, 1, piston(5, true)); put(c, 2, 1, 1, piston(5, true)); put(c, 3, 1, 1, STONE);
  put(c, 1, 1, 2, lever()); put(c, 2, 1, 2, lever());
  ev.push([2, "use", 2, 1, 2], [8, "use", 1, 1, 2], [18, "use", 2, 1, 2], [24, "use", 1, 1, 2]);
  SCENARIOS.push(scenario("double-extender-blocked", {
    size: [8, 3, 4], ticks: 32, cells: c, events: ev,
    note: "B extends first, then A cannot push the extended B; retract B, then A pushes it",
  }));
}
// ---- Lever flicker and same-tick toggles: event de-duplication and the re-check at delivery ----
for (const sticky of [false, true]) {
  const c = {}, ev = [];
  put(c, 1, 1, 1, piston(5, sticky)); put(c, 2, 1, 1, STONE); put(c, 1, 1, 2, lever());
  for (const t of [2, 3, 4, 6, 7, 10]) ev.push([t, "use", 1, 1, 2]);
  ev.push([14, "use", 1, 1, 2], [14, "use", 1, 1, 2], [18, "use", 1, 1, 2], [18, "use", 1, 1, 2], [18, "use", 1, 1, 2], [24, "use", 1, 1, 2]);
  SCENARIOS.push(scenario(sticky ? "sticky-flicker" : "normal-flicker", {
    size: [6, 3, 4], ticks: 34, cells: c, events: ev,
    note: "rapid lever toggles across consecutive ticks and several toggles inside one tick (the extend/retract events are re-checked against the power at delivery)",
  }));
}
// ---- Placement ----
{
  const c = {}, ev = [];
  // placepiston: id, placer x, y (feet), z (region-relative) and yaw. Positions chosen far from each other.
  const spots = [
    [3, 1, 3, 3, 1, 3, 0], [7, 1, 3, 7, 1, 7, 90], [11, 1, 3, 11, 1, 11, 180], [15, 1, 3, 15, 1, 15, 270],
    [19, 1, 3, 19, 4, 3, 0], [23, 1, 3, 23, -2, 3, 0], [27, 1, 3, 29.2, 1, 3.3, 45], [31, 1, 3, 31, 1, 1, -135],
  ];
  spots.forEach(([x, y, z, px, py, pz, yaw], i) => ev.push([1, "placepiston", x, y, z, i % 2 ? STICKY : PISTON, px, py, pz, yaw]));
  SCENARIOS.push(scenario("placement-orientation", {
    size: [34, 6, 18], ticks: 4, cells: c, events: ev,
    note: "BlockPistonBase.determineOrientation for placers at four yaws, above (looking down), below (looking up), 45 degrees and a far diagonal",
  }));
}
{
  const c = {}, ev = [];
  // Pistons placed beside a powered redstone block: placement meta 0 (down) powers first, then the orientation update.
  put(c, 1, 2, 3, REDSTONE_BLOCK); put(c, 5, 2, 3, REDSTONE_BLOCK); put(c, 9, 2, 3, REDSTONE_BLOCK); put(c, 13, 2, 3, REDSTONE_BLOCK);
  put(c, 3, 1, 5, STONE); put(c, 7, 1, 5, STONE);
  put(c, 11, 1, 3, STONE); put(c, 11, 2, 4, STONE);
  ev.push([2, "placepiston", 2, 2, 3, PISTON, 2, 1, 3, 90], [2, "placepiston", 6, 2, 3, STICKY, 6, 1, 3, 90], [2, "placepiston", 10, 2, 3, PISTON, 10, 1, 3, 0], [2, "placepiston", 14, 2, 3, STICKY, 14, 1, 3, 270]);
  ev.push([12, "air", 1, 2, 3], [12, "air", 5, 2, 3], [12, "air", 9, 2, 3], [12, "air", 13, 2, 3]);
  SCENARIOS.push(scenario("place-powered", {
    size: [17, 5, 8], ticks: 24, cells: c, events: ev,
    note: "pistons placed next to powered redstone blocks update at metadata 0 first, then again after onBlockPlacedBy sets the orientation",
  }));
}
// ---- Head and base removal ----
{
  const c = {}, ev = [];
  extended(c, 1, 1, 1, 5); put(c, 1, 1, 2, lever(true));
  extended(c, 1, 1, 5, 5, true); put(c, 1, 1, 6, lever(true));
  extended(c, 1, 1, 9, 5); put(c, 1, 1, 10, lever(true));
  extended(c, 1, 1, 13, 5, true); put(c, 1, 1, 14, lever(true));
  ev.push([2, "air", 2, 1, 1], [2, "air", 2, 1, 5], [4, "air", 1, 1, 9], [4, "air", 1, 1, 13]);
  SCENARIOS.push(scenario("head-and-base-removal", {
    size: [6, 3, 16], ticks: 10, seed: 77, cells: c, events: ev,
    note: "breaking an extended piston's head drops the base piston; removing the base removes the orphan head",
  }));
}
// ---- Height bounds ----
{
  const c = {}, ev = [];
  // origin y 250: floor at 250, local y 1 = 251. Up-facing pistons.
  for (const [i, [py, blocks]] of [[2, 1], [2, 0], [3, 1], [3, 0]].entries()) {
    const x = 1 + 3 * i;
    put(c, x, py, 1, piston(1)); if (blocks) put(c, x, py + 1, 1, STONE);
    ev.push([2, "place", x + 1, py, 1, REDSTONE_BLOCK, 0]);
  }
  SCENARIOS.push(scenario("bounds-top", {
    origin: [0, 250, 0], size: [14, 6, 3], ticks: 14, cells: c, events: ev,
    note: "up-facing pistons at y 252 and 253 with and without a stone in front: a push into y 255 is refused (target y >= 255 fails canExtend)",
  }));
}
{
  const c = {}, ev = [];
  // origin y 0: floor at y 0. Down-facing pistons at y 1 (target y 0, refused) and y 2 (target y 1).
  for (const [i, [py, blocks]] of [[1, 0], [1, 1], [2, 0], [2, 1], [3, 1]].entries()) {
    const x = 1 + 3 * i;
    put(c, x, py, 1, piston(0)); if (blocks) put(c, x, py - 1, 1, STONE);
    ev.push([2, "place", x + 1, py, 1, REDSTONE_BLOCK, 0]);
  }
  SCENARIOS.push(scenario("bounds-bottom", {
    origin: [0, 0, 0], size: [17, 5, 3], ticks: 14, cells: c, events: ev,
    note: "down-facing pistons at y 1 (target y 0 refused), y 2 and y 3: pushes down need the target y > 0",
  }));
}
// ---- All six facings, normal and sticky ----
for (const sticky of [false, true]) {
  const c = {}, ev = [];
  // x spacing 7; z centre 3; y centre 3 (floor below at 0).
  for (let f = 0; f < 6; f++) {
    const x = 2 + 7 * f, y = 3, z = 3;
    put(c, x, y, z, piston(f, sticky)); put(c, x + FX[f], y + FY[f], z + FZ[f], STONE);
    // Redstone block on a side that is not the face: pick a perpendicular direction.
    const side = f < 2 ? [1, 0, 0] : f < 4 ? [1, 0, 0] : [0, 0, 1];
    ev.push([2, "place", x + side[0], y + side[1], z + side[2], REDSTONE_BLOCK, 0], [10, "air", x + side[0], y + side[1], z + side[2]]);
  }
  SCENARIOS.push(scenario(sticky ? "sticky-all-facings" : "normal-all-facings", {
    size: [44, 7, 7], ticks: 20, cells: c, events: ev,
    note: `${sticky ? "sticky" : "normal"} pistons facing down, up, north, south, west and east push (and for sticky pull) a stone`,
  }));
}
// ---- Block event ordering: one redstone block powers four pistons ----
{
  const c = {}, ev = [];
  for (const [x, z] of [[2, 3], [4, 3], [3, 2], [3, 4]]) put(c, x, 1, z, piston(1));
  ev.push([2, "place", 3, 1, 3, REDSTONE_BLOCK, 0], [10, "air", 3, 1, 3], [16, "place", 3, 1, 3, REDSTONE_BLOCK, 0]);
  SCENARIOS.push(scenario("event-order-four", {
    size: [7, 4, 7], ticks: 24, cells: c, events: ev,
    note: "one redstone block placed between four up-facing pistons queues four events in neighbour-notification order, extends, retracts and re-extends",
  }));
}
{
  const c = {}, ev = [];
  // Piston A (east) pushes B (east, sticky, retracted) in line while a third piston C (up) is powered by the same block.
  put(c, 1, 1, 3, piston(5)); put(c, 2, 1, 3, STONE); put(c, 3, 1, 3, piston(1, true)); put(c, 4, 1, 3, STONE);
  put(c, 2, 1, 2, REDSTONE_BLOCK);
  ev.push([2, "place", 1, 1, 2, REDSTONE_BLOCK, 0], [12, "air", 1, 1, 2]);
  SCENARIOS.push(scenario("event-order-chain", {
    size: [8, 4, 6], ticks: 24, cells: c, events: ev,
    note: "a redstone block beside the first piston of a chain: the pushed blocks' neighbour updates queue further events in the second delivery pass",
  }));
}
// ---- Wire, repeater and torch power sources ----
{
  const c = {}, ev = [];
  // Lane 1: wire. Lane 2: repeater output. Lane 3: lever on a stone block next to the piston (strong power through the block).
  put(c, 1, 1, 1, piston(5)); put(c, 2, 1, 1, STONE); put(c, 1, 1, 2, WIRE); put(c, 1, 1, 3, lever());
  put(c, 1, 1, 5, piston(5)); put(c, 2, 1, 5, STONE); put(c, 1, 1, 6, `${REPEATER}:3`); put(c, 1, 1, 7, lever());
  put(c, 1, 1, 9, piston(5)); put(c, 2, 1, 9, STONE); put(c, 1, 1, 10, STONE); put(c, 0, 1, 10, `${LEVER}:1`);
  put(c, 1, 1, 12, piston(5)); put(c, 2, 1, 12, STONE); put(c, 1, 1, 13, STONE); put(c, 1, 2, 13, WIRE); put(c, 1, 2, 14, lever());
  ev.push([2, "use", 1, 1, 3], [3, "use", 1, 1, 7], [4, "use", 0, 1, 10], [5, "use", 1, 2, 14], [14, "use", 1, 1, 3], [15, "use", 1, 1, 7], [16, "use", 0, 1, 10], [17, "use", 1, 2, 14]);
  SCENARIOS.push(scenario("power-sources", {
    size: [6, 4, 16], ticks: 30, cells: c, events: ev,
    note: "pistons powered by adjacent wire, a repeater output, a block strongly powered by a wall lever and wire on a block beside them",
  }));
}
// ---- Repeater clock driving pistons ----
{
  const c = {}, ev = [];
  for (const [x, z] of [[1, 1], [3, 1], [3, 3], [1, 3]]) put(c, x, 1, z, WIRE);
  put(c, 2, 1, 1, `${REPEATER}:1`); put(c, 3, 1, 2, `${REPEATER}:2`); put(c, 2, 1, 3, `${REPEATER}:3`); put(c, 1, 1, 2, `${REPEATER}:0`);
  // Tap repeaters leave the ring eastwards and power a normal and a sticky piston that face up under a stone.
  put(c, 4, 1, 1, `${REPEATER}:1`); put(c, 5, 1, 1, piston(1)); put(c, 5, 2, 1, STONE);
  put(c, 4, 1, 3, `${REPEATER}:1`); put(c, 5, 1, 3, piston(1, true)); put(c, 5, 2, 3, STONE);
  ev.push([1, "place", 1, 1, 0, REDSTONE_BLOCK, 0], [2, "air", 1, 1, 0]);
  SCENARIOS.push(scenario("clock-drives-pistons", {
    size: [8, 5, 5], ticks: 90, cells: c, events: ev,
    note: "a four-repeater ring started by a one-tick redstone block pulse; two tap repeaters drive a normal and a sticky piston on every pass of the pulse",
  }));
}
// ---- Pistons starting from raw extended state and a retract with a moving head ----
{
  const c = {}, ev = [];
  extended(c, 1, 1, 1, 5); put(c, 1, 1, 2, lever(true)); put(c, 3, 1, 1, STONE);
  extended(c, 1, 1, 5, 5, true); put(c, 1, 1, 6, lever(true)); put(c, 3, 1, 5, STONE);
  // Vertical sticky pulling down and up.
  extended(c, 1, 3, 9, 1, true); put(c, 1, 5, 9, STONE); put(c, 2, 3, 9, lever(true)); put(c, 2, 2, 9, STONE);
  extended(c, 5, 3, 9, 0, true); put(c, 5, 1, 9, STONE); put(c, 6, 3, 9, lever(true)); put(c, 6, 2, 9, STONE);
  ev.push([2, "use", 1, 1, 2], [2, "use", 1, 1, 6], [2, "use", 2, 3, 9], [2, "use", 6, 3, 9]);
  SCENARIOS.push(scenario("retract-from-extended", {
    size: [8, 7, 11], ticks: 12, cells: c, events: ev,
    note: "extended pistons present at the start retract on power loss: normal leaves the stone, sticky pulls it (horizontal, up and down)",
  }));
}
// ---- Push a plate and a lamp-lit line into circuits, then a pressure-plate driven piston ----
{
  const c = {}, ev = [];
  put(c, 1, 1, 1, piston(5)); put(c, 2, 1, 1, STONE_PLATE); put(c, 3, 1, 1, STONE); put(c, 1, 1, 2, lever());
  put(c, 1, 1, 5, piston(5, true)); put(c, 2, 1, 5, LAMP); put(c, 3, 1, 5, REDSTONE_BLOCK); put(c, 1, 1, 6, lever());
  ev.push([2, "use", 1, 1, 2], [2, "use", 1, 1, 6], [10, "use", 1, 1, 2], [10, "use", 1, 1, 6]);
  SCENARIOS.push(scenario("push-plate-lamp", {
    size: [6, 3, 8], ticks: 24, cells: c, events: ev,
    note: "a pressure plate (needs a supporting block) and a lamp next to a redstone block are pushed and, for the sticky piston, pulled back",
  }));
}

// ---- Native run ----
const researchDirs = [process.env.MC_RESEARCH, path.join(root, "research"), path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"),
  out = path.join(research, "piston-probe"),
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
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/PistonProbe.java")]);
const input = SCENARIOS.map((s) => `scenario ${s.name} ${s.origin.join(" ")} ${s.size.join(" ")} ${s.ticks} ${s.seed} ${s.sky} ${s.skylightSubtracted} ${s.angle} ${s.noSky ? 1 : 0}\ngrid ${s.grid}\n${s.events.map((e) => `event ${e.join(" ")}`).join("\n")}\n`).join("");
const child = spawn("java", ["-cp", cp, "PistonProbe"], { stdio: ["pipe", "pipe", "pipe"] });
let stdout = "", stderr = "";
child.stdout.on("data", (d) => (stdout += d));
child.stderr.on("data", (d) => (stderr += d));
child.stdin.end(input);
await new Promise((res, rej) => child.on("close", (c) => (c === 0 ? res() : rej(new Error("java exited " + c + "\n" + stderr)))));
const lines = stdout.trim().split("\n").map((l) => JSON.parse(l)),
  blocks = lines.shift();
assert.equal(blocks.kind, "blocks");
assert.equal(lines.length, SCENARIOS.length);
if (process.env.MC_PISTON_NATIVE_ONLY) {
  console.log(JSON.stringify({ blocks, scenarios: lines.map((n) => ({ ...n, frames: undefined })) }, null, 0));
  process.exit(0);
}

// ---- Compare ----
const { replayScenario, pistonBlockProperties, blockProperties } = await import("../src/redstone.js");
assert.deepEqual(blockProperties(), blocks.props, "block property table");
assert.deepEqual(pistonBlockProperties(), blocks.pistonProps, "piston block property table");
const f32 = Math.fround;
export function compare(s, native, mine) {
  for (let t = 0; t < s.ticks; t++) {
    assert.equal(mine.calls[t], native.calls[t], `${s.name}: call log at tick ${t + 1}`);
    assert.deepEqual(mine.frames[t], native.frames[t], `${s.name}: block changes at tick ${t + 1}`);
    assert.deepEqual(mine.te[t], native.te[t], `${s.name}: piston tile entities at tick ${t + 1}`);
  }
  assert.equal(mine.final, native.final, `${s.name}: final region`);
  assert.deepEqual(mine.pending, native.pending, `${s.name}: pending ticks`);
  assert.deepEqual(mine.queued, native.queued, `${s.name}: queued block events`);
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
let ticks = 0, calls = 0, changes = 0, sounds = 0, drops = 0, tileStates = 0, events = 0;
const results = [],
  failures = [];
for (const [i, native] of lines.entries()) {
  const s = SCENARIOS[i];
  assert.equal(native.name, s.name);
  try {
    compare(s, native, replayScenario(s));
  } catch (error) {
    failures.push(`${s.name}: ${String(error.message).split("\n").slice(0, 12).join(" | ")}`);
    continue;
  }
  ticks += s.ticks;
  calls += native.calls.reduce((n, c) => n + (c ? c.split(" ").length : 0), 0);
  changes += native.frames.reduce((n, f) => n + f.length, 0);
  events += native.calls.reduce((n, c) => n + (c.match(/(^| )v,/g) ?? []).length, 0);
  sounds += native.sounds.length;
  drops += native.drops.length;
  tileStates += native.te.reduce((n, t) => n + t.length, 0);
  const { kind, name, tiles, ...rest } = native;
  results.push({ ...s, ...rest });
}
if (failures.length) {
  console.error(failures.join("\n\n"));
  throw new Error(`${failures.length} of ${SCENARIOS.length} scenarios differ from the original classes`);
}
const digest = async (name) => createHash("sha256").update((await exec("unzip", ["-p", jar, name + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = {
  app: "BlockPistonBase", apq: "BlockPistonExtension", apr: "BlockPistonMoving", aps: "TileEntityPiston", aor: "TileEntity", ajc: "BlockContainer",
  mt: "WorldServer", mv: "ServerBlockEventList", ags: "BlockEventData", ahb: "World", apx: "Chunk", apz: "ExtendedBlockStorage", aji: "Block", ahs: "NextTickListEntry",
  ana: "BlockRedstoneWire", anc: "BlockRedstoneTorch", aoc: "BlockTorch", alv: "BlockLever", ajs: "BlockButton", anb: "BlockRedstoneLight", ams: "BlockCompressedPowered",
  anf: "BlockRedstoneRepeater", akj: "BlockRedstoneDiode", amu: "BlockPressurePlate", ajd: "BlockBasePressurePlate", agt: "ChunkPosition",
};
const reference = {
  target: "Minecraft Java 1.7.10",
  clientSha1,
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method:
    "Unchanged original BlockPistonBase (app, sticky 29 / normal 33), BlockPistonExtension (apq, 34), BlockPistonMoving (apr, 36) and TileEntityPiston (aps) plus the redstone blocks of redstone-reference.json run inside a real World (ahb, allocated without its constructor) with real Chunk (apx) objects. Native: World.setBlock, setBlockMetadataWithNotify, notifyBlocksOfNeighborChange, setTileEntity / getTileEntity / removeTileEntity, World.updateEntities (the tile-entity loop and TileEntityPiston.updateEntity), Block drops, power queries. Replaced: WorldServer scheduled ticks and WorldServer.addBlockEvent / sendQueuedBlockEvents (copied: two ArrayLists swapped by index, BlockEventData.equals de-duplication against the list being filled, delivery through the native Block.onBlockEventReceived), getTotalWorldTime, getGameRules, playSoundEffect / spawnEntityInWorld (recorded), getEntitiesWithinAABB (a scripted list that is empty in every piston scenario: entity pushing is not exercised), lighting. Per tick: scripted events, world time + 1, tickUpdates, sendQueuedBlockEvents, World.updateEntities. Scenario events: place, air, use, placepiston (id, placer x/y/z feet position and yaw; setBlock(id,0,3) then onBlockPlacedBy, 1.62 eye height) plus the redstone events (entity/collide, cauldron, ...). Per tick: changed region cells [x,y,z,id,meta]; te: every TileEntityPiston in the loaded list [x,y,z,storedBlock,storedMeta,facing,extending,renderHead,progress,lastProgress]; the call log: E,op; s,x,y,z,id,meta,flags; m,x,y,z,meta,flags; n,x,y,z,source; t,x,y,z,id,delay,priority; u,x,y,z,id; b,x,y,z,id,event,param addBlockEvent; v,x,y,z,id,event,param delivered; r,0|1 its result; k,x,y,z setTileEntity; K,x,y,z removeTileEntity; p,name sound; e,item dropped item; T world tick. sounds [tick,x,y,z,name,volume,pitch]; drops [tick,x,y,z,item,count,damage]; pending ticks; queued: block events still in the list being filled; rng: world Random nextInt() after the run. blocks.pistonProps rows [id, hardness == -1, getMobilityFlag, ITileEntityProvider, material air] for every registered id below 256.",
  blocks,
  scenarios: results,
};
await writeFile(path.join(root, "../public/research/piston-reference.json"), JSON.stringify(reference) + "\n");
console.log(`PASS: ${SCENARIOS.length} scenarios, ${ticks} ticks, ${calls} logged calls, ${events} delivered block events, ${changes} cell changes, ${tileStates} piston tile-entity states, ${sounds} sounds, ${drops} drops identical to the original classes.`);
