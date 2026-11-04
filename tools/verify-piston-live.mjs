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
import { RedstoneWorld } from "../src/redstone.js";
import { installPistons, tileOffset, tileProgress } from "../src/piston-live.js";

const exec = promisify(execFile), root = path.dirname(fileURLToPath(import.meta.url)), exists = (p) => access(p).then(() => true, () => false);
const STONE = 1, STICKY = 29, PISTON = 33, REDSTONE_BLOCK = 152;
const reference_partials = [0, 0.25, 0.5, 0.75, 1];
const ORIGIN = [4, 10, 4], SIZE = [7, 6, 6];
function scenario(name, { cells, events, ticks, note }) {
  const grid = [];
  for (let x = 0; x < SIZE[0]; x++) for (let y = 0; y < SIZE[1]; y++) for (let z = 0; z < SIZE[2]; z++) grid.push(cells[`${x},${y},${z}`] ?? (y === 0 ? STONE : 0));
  return { name, note, ticks, seed: 1, grid: grid.join(","), events };
}
const box = (x, y, z, w = 0.4, h = 0.8) => [x, y, z, x + w, y + h, z + w];
const ent = (t, label, b) => [t, "entity", 0, 0, 0, label, ...b];
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
export function replay(s) {
  const w = new RedstoneWorld({ seed: s.seed }), cells = s.grid.split(",");
  for (let x = 0; x < SIZE[0]; x++) for (let y = 0; y < SIZE[1]; y++) for (let z = 0; z < SIZE[2]; z++) {
    const [id, meta = 0] = cells[(x * SIZE[1] + y) * SIZE[2] + z].split(":").map(Number);
    if (id) w.setRaw(ox + x, oy + y, oz + z, id, meta);
  }
  const ents = [], moves = [];
  let tick = 0;
  const p = installPistons({ redstone: w, blocks: { toInternal: (id, meta) => (id === 0 ? null : { id: { 1: 1, 29: 116, 33: 117, 34: 118 }[id] ?? id, meta }) }, entities: { extra: () => ents } });
  const tes = [], boxes = [], entityPos = [], samples = [];
  for (tick = 1; tick <= s.ticks; tick++) {
    for (const [t, op, x0, y0, z0, a, ...rest] of s.events) {
      if (t !== tick) continue;
      const x = ox + x0, y = oy + y0, z = oz + z0;
      if (op === "place") w.setBlock(x, y, z, a, rest[0], 3);
      else if (op === "air") w.setBlockToAir(x, y, z);
      else if (op === "entity") {
        const b = [ox + rest[0], oy + rest[1], oz + rest[2], ox + rest[3], oy + rest[4], oz + rest[5]], e = { label: a, box: b, move(dx, dy, dz) { moves.push([tick, a, dx, dy, dz]); b[0] += dx; b[3] += dx; b[1] += dy; b[4] += dy; b[2] += dz; b[5] += dz; } };
        ents.push(e);
      }
    }
    w.time++;
    w.tickUpdates();
    w.sendQueuedBlockEvents();
    w.updateTileEntities();
    p.tick();
    const tiles = w.pistonTiles();
    tes.push(tiles.map((t) => [t.x - ox, t.y - oy, t.z - oz, t.block, t.meta, t.facing, t.extending ? 1 : 0, t.renderHead ? 1 : 0, t.progress, t.lastProgress]));
    boxes.push(p.pushBoxes().map((b) => b && [b[0] - ox, b[1] - oy, b[2] - oz, b[3] - ox, b[4] - oy, b[5] - oz]));
    entityPos.push(ents.map((e) => [e.label, e.box[0] - ox, e.box[1] - oy, e.box[2] - oz]));
  }
  return { tes, boxes, entityPos, moves, api: p };
}
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);
const failures = [];
let totalMoves = 0, tileStates = 0, offsets = 0, boxCount = 0;
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
      mine.entityPos[t].forEach((e, k) => e.forEach((v, j) => close(v, n.entities[t][k][j], `${s.name}: entity position at tick ${t + 1}`)));
      tileStates += mine.tes[t].length;
    }
    assert.equal(mine.moves.length, n.moves.length, `${s.name}: number of entity moves`);
    mine.moves.forEach((m, k) => m.forEach((v, j) => close(v, n.moves[k][j], `${s.name}: move ${k}`)));
    totalMoves += n.moves.length;
    results.push({ ...s, te: n.te, pushBoxes: n.pushBoxes, entities: n.entities, moves: n.moves });
  } catch (e) {
    failures.push(`${s.name}: ${String(e.message).split("\n").slice(0, 8).join(" | ")}`);
  }
}
if (process.env.DBG) console.log(JSON.stringify(natives[0].te[0]), JSON.stringify(natives[0].pushBoxes[0]), JSON.stringify(replay(SCENARIOS[0]).boxes[0]));
if (failures.length) { console.error(failures.join("\n\n")); throw new Error(`${failures.length} of ${SCENARIOS.length} scenarios differ from the original classes`); }
const digest = async (name) => createHash("sha256").update((await exec("unzip", ["-p", jar, name + ".class"], { encoding: "buffer", maxBuffer: 1 << 24 })).stdout).digest("hex");
const names = { aps: "TileEntityPiston", apr: "BlockPistonMoving", app: "BlockPistonBase", apq: "BlockPistonExtension", bmq: "TileEntityRendererPiston", blm: "RenderBlocks", sa: "Entity", ahb: "World" };
const reference = {
  target: "Minecraft Java 1.7.10", clientSha1, origin: ORIGIN, size: SIZE, partials: [0, 0.25, 0.5, 0.75, 1],
  classes: Object.fromEntries(await Promise.all(Object.entries(names).map(async ([c, n]) => [c, { name: n, sha256: await digest(c) }]))),
  method: "tools/probes/PistonLiveProbe.java on the PistonProbe world: per tick te rows [x,y,z,storedBlock,meta,facing,extending,renderHead,progress,lastProgress,[[progress(partial),offX,offY,offZ] x5 partials]] from aps.a/b/c/d(partial); pushBoxes from apr.a(world,x,y,z,stored,arg,facing) with arg = extending ? 1-progress : progress-1; entities [label,minX,minY,minZ] after the tick; moves [tick,label,dx,dy,dz] from native TileEntityPiston.func_145863_a through Entity.moveEntity stand-ins (EntityItem subclasses that record the delta and shift their scripted box). Coordinates region-relative to origin.",
  scenarios: results,
};
await writeFile(path.join(root, "../public/research/piston-live-reference.json"), JSON.stringify(reference) + "\n");
console.log(`PASS: ${SCENARIOS.length} scenarios, ${tileStates} tile states, ${offsets} render offsets, ${boxCount} push boxes, ${totalMoves} entity moves identical to the original classes.`);
