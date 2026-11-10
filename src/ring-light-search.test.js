// Batch 32: the per-cell RingLight search skips work it can prove useless (no height map within reach of the sky, no emitter in the
// 3 x 3 chunks, early stop once nothing can beat the found values). Its answers must equal the plain search's for every cell.
import test from "node:test";
import assert from "node:assert/strict";
import { World, TORCH } from "./world.js";
import { HeadlessColumns, attachRing } from "./headless-columns.js";
import { populationBlockMapperReady } from "./population-world.js";

await populationBlockMapperReady;
const make = () => {
  const world = new World("17", "javaStreamed", 12);
  world.blockLight = () => 0;
  const cols = new Map();
  const generate = (cx, cz) => { const k = `${cx},${cz}`; if (!cols.has(k)) cols.set(k, world.chunkAt(cx, cz) ? { blocks: world.chunkAt(cx, cz).blocks, metadata: world.chunkAt(cx, cz).meta } : world.generateTerrainChunk(cx, cz)); return cols.get(k); };
  const ring = new HeadlessColumns(world, { generate, perTick: 1000, every: 1, radius: 6 });
  const cx0 = (world.minX + world.maxX) / 32 | 0, cz0 = (world.minZ + world.maxZ) / 32 | 0;
  ring.update(cx0, cz0);
  attachRing(world, ring);
  return { world, ring, cx0, cz0 };
};
const rng = (s) => () => (s = (Math.imul(s, 1664525) + 1013904223) | 0) >>> 0;

test("fast search equals the plain search over random cells, rim and interior columns, with and without emitters", () => {
  const { ring } = make();
  const keys = [...ring.cols.keys()].map((k) => { const cz = ((k % 8388608) + 8388608 + 4194304) % 8388608 - 4194304; return [(k - cz) / 8388608, cz]; });
  assert.ok(keys.length > 40);
  const next = rng(7);
  // Torches in a few columns only, so most neighbourhoods have none.
  let torches = 0;
  for (let i = 0; i < 6; i++) {
    const [cx, cz] = keys[next() % keys.length], x = cx * 16 + (next() & 15), z = cz * 16 + (next() & 15);
    for (let y = 120; y > 20; y--) if (ring.get(x, y, z) === 0 && ring.get(x, y - 1, z)) { if (ring.putOutside(x, y, z, TORCH, 0, false)) torches++; break; }
  }
  assert.ok(torches > 0);
  const light = ring.light;
  let cells = 0, lit = 0, sky = 0, rim = 0;
  for (let n = 0; n < 1500; n++) {
    const [cx, cz] = keys[next() % keys.length], x = cx * 16 + (next() & 15), z = cz * 16 + (next() & 15);
    const y = n % 3 === 0 ? 55 + (next() % 40) : next() % 255;
    light.fast = false; const plain = light.search(x, y, z);
    light.fast = true; const fast = light.search(x, y, z);
    assert.equal(fast, plain, `cell ${x},${y},${z}`);
    cells++; if (plain & 15) lit++; if (plain >> 4) sky++;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !ring.cols.has(ring.key(cx + a, cz + b)) && !ring.resident((cx + a) * 16, (cz + b) * 16))) rim++;
  }
  light.fast = true;
  assert.ok(lit > 0 && sky > 100 && rim > 20, `coverage: ${lit} block-lit, ${sky} sky-lit, ${rim} rim cells of ${cells}`);
});

test("an emitter more than 14 cells above or below the query is skipped without changing the answer (batch 34 y-range)", () => {
  const { ring } = make();
  const keys = [...ring.cols.keys()].map((k) => { const cz = ((k % 8388608) + 8388608 + 4194304) % 8388608 - 4194304; return [(k - cz) / 8388608, cz]; });
  const next = rng(11), light = ring.light;
  const held = keys.filter(([cx, cz]) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (ring.resident((cx + a) * 16, (cz + b) * 16) || !ring.cols.has(ring.key(cx + a, cz + b))) return false; return true; });
  assert.ok(held.length > 3, "ring columns with a fully held neighbourhood");
  let placed = 0, lit = 0;
  for (const [cx, cz] of held.slice(0, 4)) {
    const x = cx * 16 + 8, z = cz * 16 + 8;
    for (const y of [30, 100]) if (ring.putOutside(x + y % 5, y, z, TORCH, 0, false)) placed++;
    for (let n = 0; n < 120; n++) {
      const qx = x + (next() % 25) - 12, qz = z + (next() % 25) - 12, qy = [20, 31, 45, 60, 70, 85, 100, 101, 120][n % 9];
      light.fast = false; const plain = light.search(qx, qy, qz);
      light.fast = true; assert.equal(light.search(qx, qy, qz), plain, `cell ${qx},${qy},${qz}`);
      if (plain & 15) lit++;
    }
  }
  light.fast = true;
  assert.ok(placed >= 2 && lit > 0, `torches ${placed}, block-lit cells ${lit}`);
});
