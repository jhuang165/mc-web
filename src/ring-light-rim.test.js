// Batch 30 (light-engine.md "Batch 30"): rim columns of the headless ring and edits in the window beside ring columns.
// Natively no light update runs within 17 blocks of an unloaded chunk and generation leaves lateral light lazy, so a ring column with
// a missing neighbour is not lit from or across it (it used to read the missing chunk as open air, sky 15, and came out brighter).
import test from "node:test";
import assert from "node:assert/strict";
import { World, TORCH } from "./world.js";
import { HeadlessColumns, attachRing } from "./headless-columns.js";
import { populationBlockMapperReady } from "./population-world.js";

await populationBlockMapperReady;
const STONE = 3;
const make = () => {
  const world = new World("17", "javaStreamed", 12);
  world.blockLight = () => 0;
  const cols = new Map();
  const generate = (cx, cz) => { const k = `${cx},${cz}`; if (!cols.has(k)) cols.set(k, world.chunkAt(cx, cz) ? { blocks: world.chunkAt(cx, cz).blocks, metadata: world.chunkAt(cx, cz).meta } : world.generateTerrainChunk(cx, cz)); return cols.get(k); };
  const ring = new HeadlessColumns(world, { generate, perTick: 1000, every: 1, radius: 4 });
  const cx0 = (world.minX + world.maxX) / 32 | 0, cz0 = (world.minZ + world.maxZ) / 32 | 0;
  ring.update(cx0, cz0);
  attachRing(world, ring);
  return { world, ring, cx0, cz0 };
};
const topOf = (ring, x, z) => { for (let y = 255; y > 0; y--) if (ring.get(x, y, z)) return y + 1; return 0; };

test("a ring column beside an unloaded chunk is not lit across it (bulk and per-cell search agree)", () => {
  const { world, ring } = make();
  // The outermost held column on the east side, and an interior one.
  let rim = -Infinity, rimZ = 0;
  for (const k of ring.cols.keys()) { const cz = ((k % 8388608) + 8388608 + 4194304) % 8388608 - 4194304, cx = (k - cz) / 8388608; if (cx > rim) { rim = cx; rimZ = cz; } }
  const inner = rim - 3;
  assert.ok(!ring.cols.has(ring.key(rim + 1, rimZ)) && ring.cols.has(ring.key(rim, rimZ)) && !ring.resident(rim * 16, rimZ * 16));
  // A stone slab over the column and its west, north and south neighbours (flat, 3 above the highest terrain), so only the east side is open.
  const roof = (cx, cz) => {
    let top = 0;
    for (let x = cx * 16 - 16; x < cx * 16 + 16; x++) for (let z = cz * 16 - 16; z < cz * 16 + 32; z++) top = Math.max(top, topOf(ring, x, z));
    for (let x = cx * 16 - 16; x < cx * 16 + 16; x++) for (let z = cz * 16 - 16; z < cz * 16 + 32; z++) assert.ok(ring.putOutside(x, top + 3, z, STONE, 0, false));
    return top + 1;
  };
  const edge = (cx, cz, y) => ring.light.skyAt(cx * 16 + 15, y, cz * 16 + 8);
  const yr = roof(rim, rimZ), yi = roof(inner, rimZ);
  for (const mode of ["bulk", "search"]) {
    ring.light.hot = mode === "bulk" ? 1 : Infinity; ring.light.clear();
    for (const c of ring.lstate.values()) { c.light = null; c.asked = 0; }
    assert.equal(ring.get(rim * 16 + 15, yr, rimZ * 16 + 8), 0, "air under the roof");
    assert.equal(edge(rim, rimZ, yr), 0, `${mode}: the unloaded side lights nothing under the rim roof`);
    assert.ok(edge(inner, rimZ, yi) > 0, `${mode}: a held neighbour still lights under an interior roof`);
  }
  assert.ok(world);
});

test("an edit in the window drops the light of ring columns beside it (bulk light and the search cache)", () => {
  const { world, ring } = make();
  const x = world.maxX - 1, z = (world.minZ + world.maxZ) >> 1; // last resident column
  const y = topOf(ring, x, z) + 3, ox = x + 1;
  assert.ok(ring.resident(x, z) && !ring.resident(ox, z) && ring.outside(ox, z));
  for (const mode of ["bulk", "search"]) {
    ring.light.hot = mode === "bulk" ? 1 : Infinity;
    for (const c of ring.lstate.values()) { c.light = null; c.asked = 0; }
    ring.light.clear();
    world.set(x, y, z, 0, false, 0);
    assert.equal(ring.light.blockAt(ox, y, z), 0, "dark before");
    assert.equal(ring.light.blockAt(ox, y, z), 0);
    if (mode === "bulk") assert.ok(ring.state(ox >> 4, z >> 4).light, "the column is lit whole and kept");
    world.set(x, y, z, TORCH, false, 0);
    assert.equal(ring.light.blockAt(ox, y, z), 13, `${mode}: torch one cell away`);
    world.set(x, y, z, 0, false, 0);
    assert.equal(ring.light.blockAt(ox, y, z), 0, `${mode}: removed`);
  }
});
