// Batch 41 (ringpiston): what a piston at the edge of the held area decides when its push line reaches a chunk nobody holds.
// Native (public/research/rim-piston-reference.json, executed): World.getBlock goes through ChunkProviderServer.provideChunk, which
// loads the saved chunk or generates it on demand (loadChunkOnProvideRequest is true), so BlockPistonBase.canExtend sees real blocks
// and a line of 13 pushable blocks or an obsidian block beyond the edge refuses. Here the neighbour update still reads the missing
// chunk as air and queues a block event; the event waits (LiveRedstone.eventActive) and re-decides with BlockPistonBase.tryExtend
// when the chunks are held, which refuses the same lines and changes nothing before that. The replays below prove the end states equal.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, WorldChunk } from "./world.js";
import { HeadlessColumns, attachRing } from "./headless-columns.js";
import { LiveRedstone } from "./redstone-live.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/rim-piston-reference.json", import.meta.url), "utf8"));
const O_PISTON = 33, O_LEVER = 69, O_STONE = 1, O_OBSIDIAN = 49;
const STONE = 3;
const X0 = 14 * 16 + 8, Z0 = 72; // chunk 14 is the last chunk the ring holds in the rim world; cells x + 8 and beyond are in chunk 15

test("the executed 1.7.10 record: a chunk that is not loaded is loaded on demand for the piston's read", () => {
  const by = Object.fromEntries(reference.scenes.map((s) => [s.name, s]));
  for (const name of ["generated", "saved"]) {
    assert.equal(by[name].canExtend, false, `${name}: the loaded stone makes the 13-cell line too long`);
    assert.deepEqual(by[name].loadedAfter, [[0, 0], [1, 0]], `${name}: the chunk stays loaded`);
  }
  assert.ok(by.generated.events.includes("G 1 0"), "generated terrain");
  assert.ok(by.saved.events.includes("L 1 0 1"), "the saved chunk is read");
  assert.equal(by.providerEmpty.canExtend, true, "only with loadChunkOnProvideRequest off does a piston see air");
  assert.equal(by.providerEmpty.loadChunkOnProvideRequest, false);
});

const columns = new Map();
function makeWorld(withRing) {
  const world = new World("17", "javaStreamed", 12);
  world.blockLight = () => 0;
  const column = (cx, cz) => { const k = `${cx},${cz}`; if (!columns.has(k)) { const c = world.chunkAt(cx, cz); columns.set(k, c ? { blocks: c.blocks, metadata: c.meta } : world.generateTerrainChunk(cx, cz)); } return columns.get(k); };
  if (withRing) {
    const ring = new HeadlessColumns(world, { generate: column, perTick: 1000, every: 1 });
    ring.update(4, 4);
    attachRing(world, ring);
    return { world, ring };
  }
  for (let cx = -6; cx <= 18; cx++) for (let cz = -6; cz <= 14; cz++) {
    if (world.chunkAt(cx, cz)) continue;
    const c = column(cx, cz), chunk = new WorldChunk(cx, cz, 256);
    chunk.blocks.set(c.blocks); chunk.meta.set(c.metadata);
    world.chunks.set(`${cx},${cz}`, chunk);
  }
  world.minX = -96; world.maxX = 288; world.minZ = -96; world.maxZ = 240;
  world.isTicking = () => true;
  return { world, ring: null };
}

// A powered piston at the rim, a line of `count` blocks of `id` (original ids) starting beside it, an obsidian block optionally after it.
function scene(withRing, { count, id, obsidianAt = 0 }) {
  const { world, ring } = makeWorld(withRing);
  const redstone = new LiveRedstone(world, {});
  world.ringReads = !!ring;
  if (ring) { ring.update(6, 4); ring.update(6, 4); } // hold chunks 15 and 16 while the scene is built ...
  let y = 200; while (y > 0 && !world.get(X0, y, Z0)) y--; y += 3;
  for (let dx = -2; dx < 20; dx++) for (let dz = -1; dz < 3; dz++) { world.set(X0 + dx, y - 1, Z0 + dz, STONE, true, 0); for (let dy = 0; dy < 3; dy++) world.set(X0 + dx, y + dy, Z0 + dz, 0, true, 0); }
  redstone.setBlock(X0, y, Z0, O_PISTON, 5, 3);
  for (let k = 1; k <= count; k++) redstone.setBlock(X0 + k, y, Z0, id, 0, 3);
  if (obsidianAt) redstone.setBlock(X0 + obsidianAt, y, Z0, O_OBSIDIAN, 0, 3);
  redstone.setBlock(X0, y, Z0 + 1, O_LEVER, 5, 3);
  if (ring) { // ... then drop them again: chunk 14 is the last one held
    for (const cx of [15, 16]) for (let cz = -6; cz <= 14; cz++) ring.cols.delete(ring.key(cx, cz));
    ring.cx = NaN; ring.dirty = true; ring.update(4, 4); ring.touch();
    assert.equal(ring.holds(15 * 16, Z0), false);
  }
  return { world, ring, redstone, y };
}
function row(world, y) { const out = []; for (let k = 0; k <= 20; k++) out.push(`${world.get(X0 + k, y, Z0)}:${world.getMeta(X0 + k, y, Z0)}`); return out; }
function run(withRing, spec) {
  const s = scene(withRing, spec);
  const { world, ring, redstone, y } = s;
  const start = row(world, y);
  assert.ok(redstone.use(X0, y, Z0 + 1));
  for (let i = 0; i < 20; i++) redstone.tick();
  const waiting = redstone.blockEvents.flat().length;
  const mid = row(world, y);
  if (ring) { // the player walks east: the ring now holds chunk 15 and 16
    const cols = new Map(ring.cols);
    ring.cx = 6; ring.radius = 10; ring.keep = 12; ring.dirty = true; ring.update(6, 4);
    for (const [k, c] of cols) if (!ring.cols.has(k)) ring.cols.set(k, c);
  }
  for (let i = 0; i < 40; i++) redstone.tick();
  const end = row(world, y);
  world.ringReads = false;
  return { start, waiting, mid, end, tiles: redstone.pistonTiles().length, events: redstone.blockEvents.flat().length };
}

for (const [name, spec, moves] of [
  ["a line of 13 blocks (too long, native canExtend refuses)", { count: 13, id: O_STONE }, false],
  ["an obsidian block in chunk 15 ends the line (native refuses)", { count: 12, id: O_STONE, obsidianAt: 13 }, false],
  ["a line of 9 blocks into chunk 15 (pushable, control)", { count: 9, id: O_STONE }, true],
]) {
  test(`rim piston, ${name}: nothing is lost or moved early, and the end state equals the all-resident world`, () => {
    const ring = run(true, spec), resident = run(false, spec);
    assert.deepEqual(ring.end, resident.end);
    assert.equal(ring.tiles, 0);
    assert.equal(ring.events, 0, "no event is left over");
    assert.equal(resident.waiting, 0);
    if (moves) {
      assert.notDeepEqual(resident.end, resident.start, "native: the line moved");
      assert.ok(ring.waiting > 0, "the event waited for the unheld chunk");
      assert.deepEqual(ring.mid.slice(0, 8), ring.start.slice(0, 8), "nothing moved before the chunk arrived");
    } else assert.deepEqual(ring.mid.slice(0, 8), ring.end.slice(0, 8), "the refused line is unchanged before and after the chunk arrives (cells in chunk 15 read as air until it is held)");
  });
}

// Batch 44: the no-op event exists only where the decision truly needs the unheld chunk. A line that native canExtend refuses from cells the
// ring already holds (obsidian right beside the piston) queues no block event at all, exactly as natively; only a line that reaches the unheld
// chunk (above: 13 blocks, obsidian in chunk 15) waits, because its answer depends on cells that read as air here.
test("rim piston: a refusal decided inside held cells queues no event (native: the event is not added)", () => {
  const ring = run(true, { count: 0, id: O_STONE, obsidianAt: 1 }), resident = run(false, { count: 0, id: O_STONE, obsidianAt: 1 });
  assert.equal(ring.waiting, 0, "no event waits");
  assert.equal(resident.waiting, 0);
  assert.deepEqual(ring.end, resident.end);
});
