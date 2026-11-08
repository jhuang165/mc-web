// Replays the scripted piston scenarios of tools/probes/PistonLiveProbe.java (unchanged original TileEntityPiston,
// BlockPistonMoving, BlockPistonBase, World tile-entity loop, scripted entities) through src/redstone.js plus
// src/piston-live.js, compares tile states, render offsets, push boxes, entity positions and every entity move, and
// writes public/research/piston-live-reference.json for src/piston-live.test.js. Needs a JDK, the pinned client JAR
// (tools/research or MC_RESEARCH) and guava / log4j-api / commons-lang3 / netty-all (MC_PROBE_LIBS or a launcher cache).
// Run tools/verify-pistons.mjs once first so tools/research/piston-probe/probe holds the compiled PistonProbe.
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { installShapedBlocks, trapdoorSupportOriginal } from "../src/shaped-blocks.js";
import { RedstoneWorld, blockProperties } from "../src/redstone.js";
import { fromOriginal } from "../src/block-registry.js";
import { installPistons, tileOffset, tileProgress } from "../src/piston-live.js";
import { pistonPushExtras } from "../src/piston-push.js";
import { setMovingBoxes } from "../src/moving-boxes.js";
import { EntityWorld, setEntityBoxes } from "../src/entities.js";
import { Minecarts, Y_OFFSET } from "../src/minecarts.js";
import { Boats } from "../src/boats.js";
import { boatBoxProvider } from "../src/entity-collision.js";
import { solidBlock } from "../src/world.js";

const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
const STONE = 1, STICKY = 29, PISTON = 33, REDSTONE_BLOCK = 152;
const reference_partials = [0, 0.25, 0.5, 0.75, 1];
const ORIGIN = [4, 10, 4], SIZE = [7, 6, 6];
function scenario(name, { cells, events, ticks, note, order }) {
  const grid = [];
  for (let x = 0; x < SIZE[0]; x++) for (let y = 0; y < SIZE[1]; y++) for (let z = 0; z < SIZE[2]; z++) grid.push(cells[`${x},${y},${z}`] ?? (y === 0 ? STONE : 0));
  return { name, note, ticks, seed: 1, grid: grid.join(","), events, ...(order ? { order: true } : {}) };
}
const box = (x, y, z, w = 0.4, h = 0.8) => [x, y, z, x + w, y + h, z + w];
const ent = (t, label, b) => [t, "entity", 0, 0, 0, label, ...b];
// A real entity (probe: EntityPig / EntityMinecartEmpty / EntityBoat constructed in the World) at the cell's centre, feet on its floor.
const PIG = 0, CART = 1, BOAT = 2;
const live = (t, label, kind, [x, y, z], [vx, vy, vz] = [0, 0, 0]) => [t, "live", x, y, z, label, kind, vx, vy, vz];
const SCENARIOS = [];
{
  const c = { "1,1,2": `${PISTON}:5`, "2,1,2": STONE, "3,1,2": STONE };
  SCENARIOS.push(scenario("extend-push-chain", { cells: c, ticks: 12, note: "piston pushes two stones; entities inside each block box and one in the cell the chain enters; retract at tick 8", events: [
    ent(1, 1, box(2.3, 1, 2.3)), ent(1, 2, box(3.3, 1, 2.3)), ent(1, 3, box(4.3, 1, 2.3)), ent(1, 4, box(2.3, 1.9, 2.3)),
    [1, "place", 1, 2, 2, REDSTONE_BLOCK, 0], [8, "air", 1, 2, 2]] }));
}
{
  const c = { "1,1,2": `${STICKY}:5`, "2,1,2": STONE };
  SCENARIOS.push(scenario("sticky-extend-retract", { cells: c, ticks: 14, note: "sticky piston pushes then pulls a stone with entities in the block and the head cell", events: [
    ent(1, 1, box(2.3, 1, 2.3)), ent(1, 2, box(3.3, 1, 2.3)), [1, "place", 1, 2, 2, REDSTONE_BLOCK, 0], [7, "air", 1, 2, 2]] }));
}
{
  const c = { "1,1,1": `${PISTON}:1`, "1,2,1": STONE };
  SCENARIOS.push(scenario("vertical-up", { cells: c, ticks: 10, note: "piston facing up lifts a stone; entity inside the block, one above it, one beside", events: [
    ent(1, 1, box(1.3, 2, 1.3)), ent(1, 2, box(1.3, 2.9, 1.3)), ent(1, 3, box(2.3, 2, 1.3)), [1, "place", 2, 1, 1, REDSTONE_BLOCK, 0]] }));
}
{
  const c = { "1,1,2": `${PISTON}:5` };
  SCENARIOS.push(scenario("head-only", { cells: c, ticks: 12, note: "piston with nothing in front: the head's own box pushes entities; retract at tick 7", events: [
    ent(1, 1, box(2.3, 1, 2.3)), ent(1, 2, box(2.3, 1.2, 2.3, 0.4, 0.3)), [1, "place", 1, 2, 2, REDSTONE_BLOCK, 0], [7, "air", 1, 2, 2]] }));
}
{
  const c = { "1,3,1": `${STICKY}:0`, "1,2,1": STONE };
  SCENARIOS.push(scenario("sticky-down", { cells: c, ticks: 12, note: "sticky piston facing down pushes a stone down and pulls it up; entity inside the block cell", events: [
    ent(1, 1, box(1.3, 2, 1.3)), [1, "place", 2, 3, 1, REDSTONE_BLOCK, 0], [7, "air", 2, 3, 1]] }));
}
{
  const c = { "1,1,1": `${PISTON}:2`, "1,1,0": STONE, "5,1,1": `${PISTON}:4`, "4,1,1": STONE };
  SCENARIOS.push(scenario("negative-facings", { cells: c, ticks: 10, note: "pistons facing north and west (negative offsets) push stones; entities inside both", events: [
    ent(1, 1, box(1.3, 1, 0.3)), ent(1, 2, box(4.3, 1, 1.3)), [1, "place", 2, 1, 1, REDSTONE_BLOCK, 0], [1, "place", 5, 2, 1, REDSTONE_BLOCK, 0]] }));
}

{
  const c = { "1,1,1": `${PISTON}:3`, "1,1,2": STONE, "4,1,1": `${STICKY}:3`, "4,1,2": STONE };
  SCENARIOS.push(scenario("south-facing", { cells: c, ticks: 14, note: "pistons facing south (+z, plain and sticky) push and pull stones; entities inside, beside, in the cell ahead and on top", events: [
    ent(1, 1, box(1.3, 1, 2.3)), ent(1, 2, box(2.3, 1, 2.3)), ent(1, 3, box(1.3, 1, 3.3)), ent(1, 4, box(1.3, 2, 2.3)), ent(1, 5, box(4.3, 1, 2.3)),
    [1, "place", 2, 1, 1, REDSTONE_BLOCK, 0], [1, "place", 5, 2, 1, REDSTONE_BLOCK, 0], [8, "air", 2, 1, 1], [8, "air", 5, 2, 1]] }));
}
{
  const c = { "1,1,1": `${PISTON}:1`, "1,2,1": STONE, "3,1,1": `${PISTON}:0`, "3,3,1": STONE, "5,1,3": `${STICKY}:1`, "5,2,3": STONE };
  SCENARIOS.push(scenario("standing-on-moving-block", { cells: c, ticks: 14, note: "entities standing exactly on top of a block pushed up, a block pushed down, and a block lifted then pulled back (sticky); one beside each", events: [
    ent(1, 1, box(1.3, 3, 1.3)), ent(1, 2, box(2.3, 3, 1.3)), ent(1, 3, box(3.3, 2, 1.3)), ent(1, 4, box(3.3, 4, 1.3)), ent(1, 5, box(5.3, 3, 3.3)),
    [1, "place", 2, 1, 1, REDSTONE_BLOCK, 0], [1, "place", 4, 1, 1, REDSTONE_BLOCK, 0], [1, "place", 6, 1, 3, REDSTONE_BLOCK, 0], [8, "air", 6, 1, 3]] }));
}
for (const [f, dx, dy, dz] of [[0, 0, -1, 0], [1, 0, 1, 0], [2, 0, 0, -1], [3, 0, 0, 1], [4, -1, 0, 0]]) {
  const c = { "3,3,3": `${PISTON}:${f}`, [`${3 + dx},${3 + dy},${3 + dz}`]: "96:0" };
  SCENARIOS.push(scenario("trapdoor-facing-" + f, { cells: c, ticks: 6, note: "piston facing " + f + " pushes a trapdoor (box reads the moving cell's metadata = facing)", events: [[1, "place", 3, 4, 3, REDSTONE_BLOCK, 0]] }));
}
for (const [name, id] of [["slab-bottom", "44:0"], ["slab-top", "44:8"], ["fence", "85:0"], ["stairs-up", "53:4"], ["snow-layer", "78:3"], ["chest", "54:2"], ["nether-fence", "113:0"], ["fence-gate", "107:0"], ["fence-gate-1", "107:1"], ["fence-gate-2", "107:2"], ["trapdoor-open", "96:5"], ["trapdoor-top", "96:8"], ["stairs-0", "53:0"], ["stairs-7", "53:7"], ["cobble-stairs", "67:2"], ["end-portal-frame", "120:0"], ["brewing-stand", "117:0"], ["enchanting-table", "116:0"], ["anvil", "145:1"], ["carpet", "171:0"], ["pane-meta", "160:0"], ["hopper", "154:0"], ["flower-pot", "140:0"], ["cobble-wall", "139:0"], ["iron-bars", "101:0"], ["glass-pane", "102:0"], ["trapdoor", "96:0"], ["cactus", "81:0"], ["bed", "26:0"], ["cauldron", "118:0"], ["soul-sand", "88:0"], ["farmland", "60:0"], ["wooden-slab", "126:8"], ["torch", "50:5"], ["lily-pad", "111:0"], ["head-only-south", "0"]]) {
  const c = { "1,1,1": `${PISTON}:5`, "2,1,1": id === "0" ? 0 : id };
  if (id === "0") delete c["2,1,1"];
  SCENARIOS.push(scenario("odd-block-" + name, { cells: c, ticks: 12, note: "piston pushes " + id + " (collision box smaller than the cube, stale bounds quirk) east; retract at tick 7; entity inside, on top and beside", events: [
    ent(1, 1, box(2.3, 1, 1.3)), ent(1, 2, box(2.3, 1.55, 1.3, 0.4, 0.4)), ent(1, 3, box(2.3, 2.0, 1.3)), [1, "place", 1, 2, 1, REDSTONE_BLOCK, 0], [7, "air", 1, 2, 1]] }));
}

// Real entities pushed through their own Entity.moveEntity (goal: the port's EntityWorld.pushMove, Minecarts.move and Boats.move
// against the block boxes, BlockPistonMoving's collision box and the other entities' boxes).
{
  const c = { "1,1,2": `${PISTON}:5`, "4,1,2": STONE, "4,2,2": STONE };
  SCENARIOS.push(scenario("live-pig-into-wall", { cells: c, ticks: 12, note: "the head pushes a pig (moving east at 0.05) into a wall two cells ahead; retract at tick 7", events: [
    live(1, 1, PIG, [2, 1, 2], [0.05, 0, 0.02]), [1, "place", 1, 2, 2, REDSTONE_BLOCK, 0], [7, "air", 1, 2, 2]] }));
}
{
  const c = { "1,1,2": `${PISTON}:1`, "1,2,2": STONE, "1,5,2": STONE, "4,1,2": `${PISTON}:1`, "4,2,2": STONE };
  SCENARIOS.push(scenario("live-pig-lift", { cells: c, ticks: 10, note: "pistons facing up lift a stone with a pig on top, one under a ceiling (blocked) and one free (falling motion -0.08)", events: [
    live(1, 1, PIG, [1, 3, 2]), live(1, 2, PIG, [4, 3, 2], [0, -0.08, 0]), [1, "place", 0, 1, 2, REDSTONE_BLOCK, 0], [1, "place", 5, 1, 2, REDSTONE_BLOCK, 0]] }));
}
{
  const c = { "1,1,1": `${PISTON}:5`, "3,1,1": "44:0", "1,1,4": `${PISTON}:5`, "3,1,4": STONE };
  SCENARIOS.push(scenario("live-pig-step", { cells: c, ticks: 10, note: "the head pushes a grounded pig into a bottom slab (steps up 0.5) and another into a full block (no step)", events: [
    live(1, 1, PIG, [2, 1, 1]), live(1, 2, PIG, [2, 1, 4]), [1, "place", 0, 1, 1, REDSTONE_BLOCK, 0], [1, "place", 0, 1, 4, REDSTONE_BLOCK, 0]] }));
}
{
  const c = { "1,1,1": `${PISTON}:5`, "4,1,1": STONE, "1,1,4": `${PISTON}:5`, "5,1,4": STONE };
  SCENARIOS.push(scenario("live-cart-boat-wall", { cells: c, ticks: 10, note: "the head pushes an empty minecart (motion 0.1 east) into a wall and a boat into a wall", events: [
    live(1, 1, CART, [2, 1, 1], [0.1, 0, 0]), live(1, 2, BOAT, [3, 1, 4]), [1, "place", 0, 1, 1, REDSTONE_BLOCK, 0], [1, "place", 0, 1, 4, REDSTONE_BLOCK, 0]] }));
}
{
  const c = { "1,1,2": `${PISTON}:5`, "6,1,2": STONE };
  SCENARIOS.push(scenario("live-pig-into-boat", { cells: c, ticks: 10, note: "the head pushes a pig into a boat (EntityBoat.getBoundingBox is a collision box for other movers)", events: [
    live(1, 1, PIG, [2, 1, 2]), live(1, 2, BOAT, [4, 1, 2]), [1, "place", 0, 1, 2, REDSTONE_BLOCK, 0]] }));
}
{
  const c = { "1,2,2": `${PISTON}:5`, "2,2,2": STONE, "3,1,2": STONE, "4,1,2": STONE };
  SCENARIOS.push(scenario("live-pig-on-moving-path", { cells: c, ticks: 12, note: "a pig standing in the cell the pushed stone enters, on a raised floor, pushed east along it; retract at tick 7", events: [
    live(1, 1, PIG, [3, 2, 2]), [1, "place", 1, 3, 2, REDSTONE_BLOCK, 0], [7, "air", 1, 3, 2]] }));
}

// More stored blocks (batch 24): every stairs id, the slab variants, carpet colour, mossy wall, anvil metadata, rails, an open
// gate, wet farmland, trapdoor metadata, ladders, snow depths. Appended after the earlier scenarios, so the stale-bounds state the
// earlier scenarios leave in the shared Block instances is unchanged for them.
{
  const ids = [
    ...[53, 67, 108, 109, 114, 128, 134, 135, 136, 156, 163, 164].map((id) => `${id}:1`), "53:2", "53:3", "53:5", "53:6",
    ...[1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15].map((m) => `44:${m}`), ...[0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13].map((m) => `126:${m}`),
    "171:5", "139:1", "145:0", "145:3", "145:4", "145:8", "122:0", "66:0", "66:1", "27:0", "28:0", "157:0", "107:4", "60:7",
    "96:1", "96:2", "96:3", "96:4", "96:12", "96:13", "65:2", "65:5", "78:0", "78:7", "120:4", "88:0", "1:0",
  ];
  for (const id of ids) {
    const c = { "1,1,1": `${PISTON}:5`, "2,1,1": id };
    SCENARIOS.push(scenario("odd-block2-" + id.replace(":", "-"), { cells: c, ticks: 12, note: "piston pushes " + id + " east (stored-block collision box at each progress); retract at tick 7; entity inside, on top and beside", events: [
      ent(1, 1, box(2.3, 1, 1.3)), ent(1, 2, box(2.3, 1.55, 1.3, 0.4, 0.4)), ent(1, 3, box(2.3, 2.0, 1.3)), [1, "place", 1, 2, 1, REDSTONE_BLOCK, 0], [7, "air", 1, 2, 1]] }));
  }
}

// Push order (batch 25): TileEntityPiston.updateEntity pushes inside World.updateEntities' loadedTileEntityList loop, so a push
// sees the tiles before it updated and the ones after it not yet (their lastProgress, which BlockPistonMoving's collision box
// reads, and a finished tile's placed block). Each of these is checked twice: the port's in-loop order must match the original
// classes and the batch 20-24 order (every push after the loop, replay(..., { deferred: true })) must not. Found by a random
// search over two-piston layouts (about 1% depend on the order); cells as "x,y,z": "id:meta".
for (const [name, cells, events, note] of [
  ["order-pig-two-pistons", { "2,1,1": "33:3", "2,1,4": "29:2" }, [live(1, 1, PIG, [2, 1, 3]), [2, "place", 2, 1, 0, REDSTONE_BLOCK, 0], [3, "place", 2, 1, 5, REDSTONE_BLOCK, 0], [9, "air", 2, 1, 5]], "two pistons facing each other (south, sticky north) push the same pig, a tick apart; the sticky one retracts at tick 9"],
  ["order-pig-into-moving-stone", { "1,1,4": "33:5", "4,1,4": STONE, "5,1,4": "33:4" }, [live(1, 1, PIG, [3, 1, 4], [0.05, 0, 0]), [2, "place", 0, 1, 4, REDSTONE_BLOCK, 0], [3, "place", 6, 1, 4, REDSTONE_BLOCK, 0]], "a head pushes a pig east into a stone another piston pushes west: the pig is pushed between two moving blocks"],
  ["order-pig-sticky-stone", { "1,1,3": "33:5", "4,1,3": STONE, "5,1,3": "29:4" }, [live(1, 1, PIG, [2, 1, 3], [0.05, 0, 0]), [2, "place", 0, 1, 3, REDSTONE_BLOCK, 0], [3, "place", 6, 1, 3, REDSTONE_BLOCK, 0], [8, "air", 6, 1, 3]], "as order-pig-into-moving-stone with a sticky piston that pulls the stone back at tick 8"],
  ["order-pig-slab-same-tick", { "1,1,1": "29:5", "4,1,1": "44:0", "5,1,1": "33:4" }, [live(1, 1, PIG, [2, 1, 1], [-0.05, 0, 0]), [2, "place", 0, 1, 1, REDSTONE_BLOCK, 0], [2, "place", 6, 1, 1, REDSTONE_BLOCK, 0], [7, "air", 6, 1, 1], [9, "air", 0, 1, 1]], "both pistons powered in the same tick: a sticky head pushes a pig into a slab pushed the other way"],
  ["order-pigs-trapdoor", { "1,1,1": "33:5", "2,1,1": "96:0", "4,1,1": "29:4" }, [live(1, 1, PIG, [1, 2, 1], [0.05, 0, 0]), live(1, 2, PIG, [3, 1, 1]), [1, "place", 5, 1, 1, REDSTONE_BLOCK, 0], [2, "place", 0, 1, 1, REDSTONE_BLOCK, 0], [4, "air", 5, 1, 1]], "a pushed trapdoor and a sticky head close on a pig; another pig on the piston"],
  ["order-boat-two-pistons", { "1,1,1": "139:0", "1,1,3": "33:5", "2,1,1": "33:4", "2,1,3": "88:0" }, [live(1, 1, BOAT, [2, 1, 2], [0, 0, 0.05]), [1, "place", 3, 1, 1, REDSTONE_BLOCK, 0], [1, "place", 0, 1, 3, REDSTONE_BLOCK, 0]], "two pistons (one pushing soul sand) push the same boat in the same tick"],
  ["order-boat-cart", { "1,1,1": "29:5", "2,1,1": "88:0", "4,1,3": "33:5" }, [live(1, 1, BOAT, [2, 1, 2], [0, 0, -0.05]), live(1, 2, CART, [4, 1, 4], [0.05, 0, 0]), [3, "place", 0, 1, 1, REDSTONE_BLOCK, 0], [3, "place", 3, 1, 3, REDSTONE_BLOCK, 0]], "a pushed boat blocked by a minecart (EntityBoat.getCollisionBox returns any entity's box), two pistons in the same tick"],
  ["order-two-boats", { "1,1,2": "33:5", "2,1,2": "88:0", "3,1,3": "33:5" }, [live(1, 1, BOAT, [5, 1, 4], [0.05, 0, -0.05]), live(1, 2, BOAT, [2, 1, 1], [0.05, 0, 0.05]), [3, "place", 0, 1, 2, REDSTONE_BLOCK, 0], [3, "place", 2, 1, 3, REDSTONE_BLOCK, 0], [7, "air", 2, 1, 3]], "two boats, two pistons powered in the same tick"],
]) SCENARIOS.push(scenario(name, { cells, ticks: 14, note, events, order: true }));

// BlockTrapDoor's support test (aoe.a: opaque material and normal render, glowstone, slab, stairs; no power test) accepts a
// redstone block: a trapdoor hung on one stays when the block is placed, then pushed and pulled.
SCENARIOS.push(scenario("trapdoor-on-redstone-block", { cells: { "4,1,3": "29:5", "4,1,4": "33:4", "5,1,3": "96:0" }, ticks: 14, note: "a trapdoor next to a redstone block, pushed and pulled by a sticky piston; a pig pushed west by another piston", events: [
  live(1, 1, PIG, [2, 1, 4], [-0.05, 0, -0.05]), [1, "place", 5, 1, 4, REDSTONE_BLOCK, 0], [1, "place", 3, 1, 3, REDSTONE_BLOCK, 0], [5, "air", 3, 1, 3]] }));

const researchDirs = [process.env.MC_RESEARCH, path.join(root, "../../tools/research")].filter(Boolean);
let research;
for (const dir of researchDirs) if (await exists(path.join(dir, "minecraft-1.7.10.jar"))) { research = dir; break; }
if (!research) throw new Error("Place minecraft-1.7.10.jar in tools/research or set MC_RESEARCH.");
const jar = path.join(research, "minecraft-1.7.10.jar"), clientSha1 = "e80d9b3bf5085002218d4be59e668bac718abbc6";
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
const out = path.join(research, "piston-live-probe"), classes = path.join(out, "classes"), probe = path.join(out, "probe");
await rm(out, { recursive: true, force: true });
await mkdir(classes, { recursive: true });
await mkdir(probe, { recursive: true });
await exec("unzip", ["-q", "-o", jar, "*.class", "-d", classes], { maxBuffer: 1 << 24 });
const cp = [probe, classes, ...libs].join(path.delimiter);
await exec("javac", ["-nowarn", "-cp", cp, "-d", probe, path.join(root, "probes/PistonProbe.java"), path.join(root, "probes/PistonLiveProbe.java")]);
const input = SCENARIOS.map((s) => `scenario ${s.name} ${ORIGIN.join(" ")} ${SIZE.join(" ")} ${s.ticks} ${s.seed}\ngrid ${s.grid}\n${s.events.map((e) => `event ${e.join(" ")}`).join("\n")}\n`).join("");
const child = spawn("java", ["-cp", cp, "PistonLiveProbe"], { stdio: ["pipe", "pipe", "pipe"] });
let stdout = "", stderr = "";
child.stdout.on("data", (d) => (stdout += d));
child.stderr.on("data", (d) => (stderr += d));
child.stdin.end(input);
await new Promise((res, rej) => child.on("close", (c) => (c === 0 ? res() : rej(new Error("java exited " + c + "\n" + stderr)))));
const natives = stdout.trim().split("\n").map((l) => JSON.parse(l));
assert.equal(natives.length, SCENARIOS.length);

// ---- Replay with src/redstone.js + src/piston-live.js (same tick order as the probe) ----
const [ox, oy, oz] = ORIGIN;
// `deferred`: the batch 20-24 order (every push after the whole tile loop) instead of the native per-tile order, used to show that
// the order scenarios depend on it.
export function replay(s, { deferred = false } = {}) {
  const w = new RedstoneWorld({ seed: s.seed }), cells = s.grid.split(",");
  installShapedBlocks(w, trapdoorSupportOriginal(blockProperties())); // as redstone-runtime.js: trapdoor support loss, gate opening
  for (let x = 0; x < SIZE[0]; x++) for (let y = 0; y < SIZE[1]; y++) for (let z = 0; z < SIZE[2]; z++) {
    const [id, meta = 0] = cells[(x * SIZE[1] + y) * SIZE[2] + z].split(":").map(Number);
    if (id) w.setRaw(ox + x, oy + y, oz + z, id, meta);
  }
  const ents = [], moves = [], liveMoves = [], lives = [];
  let tick = 0;
  const toInternal = (id, meta) => (id === 0 ? null : { id: { 1: 1, 29: 116, 33: 117, 34: 118 }[id] ?? fromOriginal(id, meta)?.id ?? id, meta: fromOriginal(id, meta)?.meta ?? meta });
  // The live World as the game sees it (internal ids; the moving cell is the internal moving block, which has no box of its own).
  const cell = (x, y, z) => toInternal(w.getBlock(x, y, z), w.getBlockMetadata(x, y, z));
  const view = { get: (x, y, z) => cell(x, y, z)?.id ?? 0, getMeta: (x, y, z) => cell(x, y, z)?.meta ?? 0, solid: (x, y, z) => { const c = cell(x, y, z); return !!c && solidBlock(c.id, c.meta); }, set() {} };
  // Real entities: pigs in an EntityWorld (pushMove), carts and boats in their systems (Minecarts.move / Boats.move), as the
  // redstone runtime wires them (piston-push.js pistonPushExtras), each move recorded before it runs.
  const mobs = new EntityWorld(view, [], () => 0.5), carts = new Minecarts({ random: () => ({ nextFloat: () => 0.5, nextInt: () => 0, nextDouble: () => 0.5, nextGaussian: () => 0 }) }), boats = new Boats();
  for (const [obj, key, label] of [[mobs, "pushMove", (e) => e.label], [carts, "move", (c, a) => a[1].label], [boats, "move", (c, a) => a[1].label]]) {
    const orig = obj[key].bind(obj);
    obj[key] = (...a) => { const d = key === "pushMove" ? a.slice(1, 4) : a.slice(2, 5); liveMoves.push([tick, key === "pushMove" ? label(a[0]) : label(null, a), ...d]); return orig(...a); };
  }
  // The probe World's entity query returns its scripted list in spawn order (PistonProbe.W), so pushes follow the spawn order here.
  let seq = 0;
  const order = (list) => list.slice().sort((a, b) => (a.entity?.seq ?? 1e9) - (b.entity?.seq ?? 1e9));
  const p = installPistons({ redstone: w, world: view, blocks: { toInternal }, entities: { mobs, order, extra: () => [...ents, ...pistonPushExtras(view, { minecarts: () => carts, boatSystem: () => boats, mobs: () => mobs, player: () => null })] } });
  let flush = () => {};
  if (deferred) {
    const real = w.pistonPush, queue = [], later = (...a) => queue.push(a);
    later.pistonLive = true;
    w.pistonPush = later;
    flush = () => { for (const a of queue.splice(0)) real(...a); };
  }
  setMovingBoxes((b) => p.collisionBoxes(b));
  setEntityBoxes(boatBoxProvider({ get carts() { return boats.carts; } }));
  const tes = [], boxes = [], entityPos = [], samples = [], collide = [], liveStates = [];
  try {
  for (tick = 1; tick <= s.ticks; tick++) {
    for (const [t, op, x0, y0, z0, a, ...rest] of s.events) {
      if (t !== tick) continue;
      const x = ox + x0, y = oy + y0, z = oz + z0;
      if (op === "place") w.setBlock(x, y, z, a, rest[0], 3);
      else if (op === "air") w.setBlockToAir(x, y, z);
      else if (op === "entity") {
        const b = [ox + rest[0], oy + rest[1], oz + rest[2], ox + rest[3], oy + rest[4], oz + rest[5]], e = { label: a, seq: seq++, box: b, move(dx, dy, dz) { moves.push([tick, a, dx, dy, dz]); b[0] += dx; b[3] += dx; b[1] += dy; b[4] += dy; b[2] += dz; b[5] += dz; } };
        ents.push(e);
      } else if (op === "live") {
        const [kind, vx, vy, vz] = rest, px = x + 0.5, pz = z + 0.5;
        let e;
        if (kind === PIG) { e = { id: mobs.nextId++, type: "pig", x: px, y, z: pz, vx, vy, vz, onGround: true, fallDistance: 0, health: 10, growingAge: 0, rotationYaw: 0 }; mobs.entities.push(e); }
        else if (kind === CART) { e = carts.spawnEmpty({ x: px, y: y + Y_OFFSET, z: pz }, { seed: 1 }); Object.assign(e, { vx, vy, vz, onGround: true }); }
        else { e = boats.spawnBoat({ x: px, y, z: pz, vx, vy, vz }, { seed: 1 }); e.onGround = true; }
        e.label = a;
        e.seq = seq++;
        lives.push(e);
      }
    }
    w.time++;
    w.tickUpdates();
    w.sendQueuedBlockEvents();
    w.updateTileEntities();
    flush();
    p.tick();
    const tiles = w.pistonTiles();
    tes.push(tiles.map((t) => [t.x - ox, t.y - oy, t.z - oz, t.block, t.meta, t.facing, t.extending ? 1 : 0, t.renderHead ? 1 : 0, t.progress, t.lastProgress]));
    boxes.push(p.pushBoxes().map((b) => b && [b[0] - ox, b[1] - oy, b[2] - oz, b[3] - ox, b[4] - oy, b[5] - oz]));
    collide.push(tiles.map((t) => p.collisionBoxes([t.x + 0.001, t.y + 0.001, t.z + 0.001, t.x + 0.999, t.y + 0.999, t.z + 0.999]).map((b) => [b[0] - ox, b[1] - oy, b[2] - oz, b[3] - ox, b[4] - oy, b[5] - oz])));
    entityPos.push(ents.map((e) => [e.label, e.box[0] - ox, e.box[1] - oy, e.box[2] - oz]));
    liveStates.push(lives.map((e) => [e.label, e.x - ox, (e.bb ? e.bb[1] : e.y) - oy, e.z - oz, e.vx, e.vy, e.vz, e.onGround ? 1 : 0, e.collidedH ? 1 : 0, e.fallDistance ?? 0]));
  }
  } finally { setMovingBoxes(null); setEntityBoxes(null); }
  return { tes, boxes, entityPos, moves, collide, live: liveStates, liveMoves, api: p };
}
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);
const failures = [];
let orderDependent = 0, liveStates = 0, totalLiveMoves = 0, collideCount = 0, totalMoves = 0, tileStates = 0, offsets = 0, boxCount = 0;
const results = [];
for (const [i, n] of natives.entries()) {
  const s = SCENARIOS[i];
  try {
    const mine = replay(s);
    for (let t = 0; t < s.ticks; t++) {
      assert.equal(mine.tes[t].length, n.te[t].length, `${s.name}: tile count at tick ${t + 1}`);
      mine.tes[t].forEach((row, k) => {
        assert.deepEqual(row, n.te[t][k].slice(0, 10), `${s.name}: tile at tick ${t + 1}`);
        const tile = { block: row[3], meta: row[4], facing: row[5], extending: !!row[6], progress: row[8], lastProgress: row[9] };
        n.te[t][k][10].forEach(([prog, dx, dy, dz], j) => {
          const pt = reference_partials[j], off = tileOffset(tile, pt);
          assert.equal(tileProgress(tile, pt), Math.fround(prog), `${s.name}: progress(${pt}) at tick ${t + 1}`);
          assert.deepEqual(off.map((v) => v + 0), [dx, dy, dz].map((v) => Math.fround(v) + 0), `${s.name}: offset(${pt}) at tick ${t + 1}`);
          offsets++;
        });
      });
      assert.equal(mine.boxes[t].length, n.pushBoxes[t].length);
      mine.boxes[t].forEach((b, k) => {
        const nb = n.pushBoxes[t][k];
        assert.equal(b === null, nb === null, `${s.name}: push box existence at tick ${t + 1}`);
        if (b) b.forEach((v, j) => close(v, nb[j], `${s.name}: push box at tick ${t + 1}`));
        boxCount++;
      });
      assert.equal(mine.collide[t].length, n.collide[t].length, `${s.name}: collide tile count at tick ${t + 1}`);
      mine.collide[t].forEach((list, k) => {
        assert.equal(list.length, n.collide[t][k].length, `${s.name}: collision box count at tick ${t + 1}: ${JSON.stringify(list)} vs ${JSON.stringify(n.collide[t][k])}`);
        list.forEach((b, i) => b.forEach((v, j) => close(v, n.collide[t][k][i][j], `${s.name}: collision box at tick ${t + 1}`)));
        collideCount += list.length;
      });
      mine.entityPos[t].forEach((e, k) => e.forEach((v, j) => close(v, n.entities[t][k][j], `${s.name}: entity position at tick ${t + 1}`)));
      tileStates += mine.tes[t].length;
    }
    for (let t = 0; t < s.ticks; t++) {
      assert.equal(mine.live[t].length, n.live[t].length, `${s.name}: live entity count at tick ${t + 1}`);
      mine.live[t].forEach((e, k) => e.forEach((v, j) => close(v, n.live[t][k][j], `${s.name}: live entity ${e[0]} field ${j} at tick ${t + 1}: ${JSON.stringify(e)} vs ${JSON.stringify(n.live[t][k])}`)));
      liveStates += mine.live[t].length;
    }
    assert.equal(mine.liveMoves.length, n.liveMoves.length, `${s.name}: number of live moves ${JSON.stringify(mine.liveMoves)} vs ${JSON.stringify(n.liveMoves)}`);
    mine.liveMoves.forEach((m, k) => m.forEach((v, j) => close(v, n.liveMoves[k][j], `${s.name}: live move ${k}`)));
    totalLiveMoves += n.liveMoves.length;
    assert.equal(mine.moves.length, n.moves.length, `${s.name}: number of entity moves`);
    mine.moves.forEach((m, k) => m.forEach((v, j) => close(v, n.moves[k][j], `${s.name}: move ${k}`)));
    totalMoves += n.moves.length;
    if (s.order) {
      const late = replay(s, { deferred: true }), key = (r) => JSON.stringify([r.live, r.liveMoves, r.entityPos, r.moves]);
      assert.notEqual(key(late), key(mine), `${s.name}: the push order does not matter here (the deferred order gives the same result)`);
      orderDependent++;
    }
    results.push({ ...s, te: n.te, pushBoxes: n.pushBoxes, collide: n.collide, entities: n.entities, moves: n.moves, ...(n.live.some((l) => l.length) ? { live: n.live, liveMoves: n.liveMoves } : {}) });
  } catch (e) {
    failures.push(`${s.name}: ${String(e.message).split("\n").slice(0, 8).join(" | ")}`);
  }
}
if (process.env.DBG) for (const nm of process.env.DBG.split(",")) { const i = SCENARIOS.findIndex((s) => s.name === nm); console.log(nm, JSON.stringify(natives[i].te[0]).slice(0, 80), "native", JSON.stringify(natives[i].pushBoxes.slice(0, 5)), "port", JSON.stringify(replay(SCENARIOS[i]).boxes.slice(0, 5))); }
if (failures.length) { console.error(failures.join("\n\n")); throw new Error(`${failures.length} of ${SCENARIOS.length} scenarios differ from the original classes`); }
const digest = async (name) => createHash("sha256").update((await exec("unzip", ["-p", jar, name + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { aps: "TileEntityPiston", apr: "BlockPistonMoving", app: "BlockPistonBase", apq: "BlockPistonExtension", bmq: "TileEntityRendererPiston", blm: "RenderBlocks", sa: "Entity", ahb: "World" };
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1, origin: ORIGIN, size: SIZE, partials: [0, 0.25, 0.5, 0.75, 1],
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method: "tools/probes/PistonLiveProbe.java on the PistonProbe world: per tick te rows [x,y,z,storedBlock,meta,facing,extending,renderHead,progress,lastProgress,[[progress(partial),offX,offY,offZ] x5 partials]] from aps.a/b/c/d(partial); pushBoxes from apr.a(world,x,y,z,stored,arg,facing) with arg = extending ? 1-progress : progress-1; entities [label,minX,minY,minZ] after the tick; moves [tick,label,dx,dy,dz] from native TileEntityPiston.func_145863_a through Entity.moveEntity stand-ins (EntityItem subclasses that record the delta and shift their scripted box). Live entities (EntityPig, EntityMinecartEmpty, EntityBoat constructed in the World, their own moveEntity run after recording the delta): live [label,posX,minY,posZ,motionX,motionY,motionZ,onGround,isCollidedHorizontally,fallDistance] after each tick, liveMoves [tick,label,dx,dy,dz]. Coordinates region-relative to origin.",
  scenarios: results,
};
await writeFile(path.join(root, "../public/research/piston-live-reference.json"), JSON.stringify(reference) + "\n");
console.log(`PASS: ${SCENARIOS.length} scenarios, ${tileStates} tile states, ${offsets} render offsets, ${boxCount} push boxes, ${collideCount} collision boxes, ${totalMoves} entity moves, ${liveStates} live entity states, ${totalLiveMoves} live entity moves identical to the original classes; ${orderDependent} order scenarios differ under the deferred (after-the-loop) push order.`);
