// Batch 37 (natural-spawning.md "Batch 37"): pistons and redstone in the headless ring. The same scenes tick in a ring-backed streamed
// world and in the same world with every chunk resident (native rules applied directly); the per-tick logs must match.
import test from "node:test";
import assert from "node:assert/strict";
import { World, WorldChunk } from "./world.js";
import { HeadlessColumns, attachRing } from "./headless-columns.js";
import { LiveRedstone } from "./redstone-live.js";
import { fromOriginal } from "./block-registry.js";

const STONE = 3, STONE_ID = () => fromOriginal(1, 0).id;
const O_PISTON = 33, O_STICKY = 29, O_LEVER = 69, O_STONE = 1, O_WIRE = 55, O_REPEATER = 93;
const silence = (w) => { w.blockLight = () => 0; return w; };
const cache = new Map();

function setup(withRing) {
  const world = silence(new World("17", "javaStreamed", 12));
  const column = (cx, cz) => { const k = `${cx},${cz}`; return cache.get(k) ?? (cache.set(k, world.chunkAt(cx, cz) ? { blocks: world.chunkAt(cx, cz).blocks, metadata: world.chunkAt(cx, cz).meta } : world.generateTerrainChunk(cx, cz)), cache.get(k)); };
  const ring = new HeadlessColumns(world, { generate: column, perTick: 1000, every: 1 });
  if (withRing) { ring.update(4, 4); attachRing(world, ring); } else {
    for (let cx = -6; cx <= 14; cx++) for (let cz = -6; cz <= 14; cz++) {
      if (world.chunkAt(cx, cz)) continue;
      const c = column(cx, cz), chunk = new WorldChunk(cx, cz, 256);
      chunk.blocks.set(c.blocks); chunk.meta.set(c.metadata);
      world.chunks.set(`${cx},${cz}`, chunk);
    }
    world.minX = -96; world.maxX = 240; world.minZ = -96; world.maxZ = 240;
    world.isTicking = (x, z) => { const cx = Math.floor(x) >> 4, cz = Math.floor(z) >> 4; for (let a = cx - 2; a <= cx + 2; a++) for (let b = cz - 2; b <= cz + 2; b++) if (!world.chunkAt(a, b)) return false; return true; };
  }
  return { world, ring };
}

// Scenes: [x, z] anchor, `dir` +x. A lever beside a piston with a train of blocks in front; sticky variant retracts; a wire/repeater line.
export function scenes(world, read, redstone, spots) {
  const levers = [];
  const surface = (x, z) => { let y = 200; while (y > 0 && !read(x, y, z)) y--; return y + 1; };
  for (const [i, [x, z, kind]] of spots.entries()) {
    const y0 = surface(x, z) + 2;
    for (let dx = -2; dx < 18; dx++) for (let dz = -2; dz <= 3; dz++) world.set(x + dx, y0 - 1, z + dz, STONE, true, 0);
    for (let dx = -2; dx < 18; dx++) for (let dz = -2; dz <= 3; dz++) for (let dy = 0; dy < 3; dy++) world.set(x + dx, y0 + dy, z + dz, 0, true, 0);
    if (kind === "push") {
      redstone.setBlock(x, y0, z, O_PISTON, 5, 3);
      for (let k = 1; k <= 6; k++) redstone.setBlock(x + k, y0, z, O_STONE, 0, 3);
      redstone.setBlock(x, y0, z + 1, O_LEVER, 5, 3);
      levers.push([x, y0, z + 1]);
    } else if (kind === "sticky") {
      redstone.setBlock(x, y0, z, O_STICKY, 5, 3);
      for (let k = 1; k <= 3; k++) redstone.setBlock(x + k, y0, z, O_STONE, 0, 3);
      redstone.setBlock(x, y0, z + 1, O_LEVER, 5, 3);
      levers.push([x, y0, z + 1]);
    } else { // lever -> wire run -> repeater -> wire -> piston
      redstone.setBlock(x, y0, z + 1, O_LEVER, 5, 3);
      for (let k = 1; k <= 5; k++) redstone.setBlock(x + k, y0, z + 1, O_WIRE, 0, 3);
      redstone.setBlock(x + 6, y0, z + 1, O_REPEATER, 1, 3);
      redstone.setBlock(x + 7, y0, z + 1, O_WIRE, 0, 3);
      redstone.setBlock(x + 8, y0, z + 1, O_STONE, 0, 3);
      redstone.setBlock(x + 8, y0, z, O_PISTON, 5, 3);
      redstone.setBlock(x + 9, y0, z, O_STONE, 0, 3);
      levers.push([x, y0, z + 1]);
    }
    void i;
  }
  return levers;
}

function replay(withRing, spots, steps = 120) {
  const { world, ring } = setup(withRing);
  const reads = (on) => { if (withRing) world.ringReads = on; };
  const rs = [];
  const redstone = new LiveRedstone(world, { changed: (x, y, z, a, b) => rs.push([x, y, z, a ?? -1, b ?? -1]) });
  const read = (x, y, z) => (withRing ? ring.get(x, y, z) : world.get(x, y, z));
  const readMeta = (x, y, z) => (withRing ? ring.getMeta(x, y, z) : world.getMeta(x, y, z));
  reads(true);
  const levers = scenes(world, read, redstone, spots);
  reads(false);
  const log = [];
  for (let tick = 0; tick < steps; tick++) {
    reads(true);
    const mark = rs.length;
    try {
      if (tick % 40 === 3) for (const [x, y, z] of levers) redstone.use(x, y, z);
      redstone.tick();
    } finally { reads(false); }
    log.push({ tick, rs: rs.slice(mark), tiles: redstone.pistonTiles().map((t) => [t.x, t.y, t.z, t.block, t.meta, t.facing, t.extending, t.progress, t.lastProgress]), q: redstone.queuedBlockEvents().length, rand: String(redstone.rand.seed) });
  }
  const blocks = [];
  for (const [x, z] of spots) for (let dx = -2; dx < 18; dx++) for (let dz = -2; dz <= 3; dz++) for (let y = 0; y < 256; y++) { const b = read(x + dx, y, z + dz); if (b) blocks.push([x + dx, y, z + dz, b, readMeta(x + dx, y, z + dz)].join(":")); }
  return { log, blocks, changes: rs.length };
}

const edge = [[118, 60, "push"], [121, 90, "sticky"], [120, 120, "wire"]]; // straddle the resident window edge (x 128)
const far = [[150, 40, "push"], [170, 90, "sticky"], [190, 60, "wire"], [-40, 60, "push"]];

for (const [name, spots] of [["straddling the resident window edge", edge], ["in ring columns", far]]) {
  test(`pistons, wires and repeaters ${name} tick like the all-resident world`, () => {
    const a = replay(true, spots), b = replay(false, spots);
    for (let i = 0; i < a.log.length; i++) assert.deepEqual(a.log[i], b.log[i], `tick ${i}`);
    assert.deepEqual(a.blocks, b.blocks);
    assert.ok(b.changes > 40, `the scene did something (${b.changes})`);
    assert.ok(b.log.some((l) => l.tiles.length), "pistons moved");
  });
}

test("a piston event near the rim waits for the chunks its line reads; it then runs, and the moving block finishes", () => {
  const { world, ring } = setup(true);
  const redstone = new LiveRedstone(world, {});
  const x = 14 * 16 + 2, z = 72; // chunk 14 is the last held one: 13 blocks along +x reach chunk 15
  world.ringReads = true;
  let y = 200; while (y > 0 && !world.get(x, y, z)) y--; y += 3;
  for (let dx = -2; dx < 14; dx++) for (let dz = -1; dz < 3; dz++) { world.set(x + dx, y - 1, z + dz, STONE, true, 0); for (let dy = 0; dy < 3; dy++) world.set(x + dx, y + dy, z + dz, 0, true, 0); }
  redstone.setBlock(x, y, z, O_PISTON, 5, 3);
  for (let k = 1; k <= 3; k++) redstone.setBlock(x + k, y, z, O_STONE, 0, 3);
  redstone.setBlock(x, y, z + 1, O_LEVER, 5, 3);
  const beyond = world.get(x + 4, y, z);
  assert.ok(redstone.use(x, y, z + 1));
  for (let i = 0; i < 20; i++) redstone.tick();
  assert.deepEqual([1, 2, 3, 4].map((k) => world.get(x + k, y, z)), [STONE_ID(), STONE_ID(), STONE_ID(), beyond], "nothing pushed, nothing lost");
  assert.equal(redstone.blockEvents.flat().length, 1, "the event is kept (and saved with the others)");
  assert.equal(redstone.save().events.flat().length, 1);
  const cols = new Map(ring.cols);
  ring.cx = 6; ring.radius = 10; ring.keep = 12; ring.dirty = true; ring.update(6, 4); // the ring now holds chunk 15 and 16
  for (const [k, c] of cols) if (!ring.cols.has(k)) ring.cols.set(k, c);
  for (let i = 0; i < 30; i++) redstone.tick();
  const row = [1, 2, 3, 4].map((k) => world.get(x + k, y, z));
  world.ringReads = false;
  assert.deepEqual(row.slice(1), [STONE_ID(), STONE_ID(), STONE_ID()], "the three stones moved one block");
  assert.notEqual(row[0], STONE_ID(), "the head stands where the first stone was");
  assert.equal(redstone.pistonTiles().length, 0, "no moving block is left");
  assert.equal(redstone.blockEvents.flat().length, 0);
});
