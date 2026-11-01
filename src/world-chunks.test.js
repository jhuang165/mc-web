import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { World, WorldChunk, SIZE, HEIGHT, ticksRandomly } from "./world.js";
import { LightVolume } from "./lighting.js";

const sha = (...arrays) => {
  const h = createHash("sha1");
  for (const a of arrays) h.update(a);
  return h.digest("hex").slice(0, 16);
};

// sha1 of the flat block + metadata arrays (and of the LightVolume after five edits), taken from the
// 128 x 128 x 64 Uint8Array World before its cells moved into chunk columns.
const FLAT = [
  ["Overworld", "meadow", 1, "20522ba8b6dc119f"], ["Overworld", "meadow", 2, "39b6242823445542"],
  ["Overworld", "meadow", 3, "abc19b640a9e662a"], ["Overworld", "meadow", 4, "2a10ec6940acb23f"],
  ["Overworld", "meadow", 5, "9fe45df5eb7607f8"], ["Overworld", "meadow", 6, "9fe45df5eb7607f8"],
  ["Overworld", "meadow", 7, "c5b75f4ace8cfe38"], ["Overworld", "meadow", 8, "e92d63e262ea8ab7"],
  ["chunks", "meadow", 8, "d2501b0113a444c2"], ["chunks", "alpine", 8, "56c26d55095d6c49"],
  ["chunks", "island", 8, "1d7820a22aa54ea5"], ["chunks", "snowy", 8, "d971e94f41baa804"],
  ["frost", "snowy", 6, "227d62bd932d582a"], ["peaks", "alpine", 8, "905b554037644e10"],
];

test("chunk-column worlds generate the same cells as the flat arrays did", () => {
  for (const [seed, biome, version, hash] of FLAT) {
    const { data, meta } = new World(seed, biome, version).snapshot();
    assert.equal(sha(data, meta), hash, `${seed} ${biome} ${version}`);
  }
});

test("lighting over chunk columns matches the flat-array LightVolume", () => {
  const w = new World("light", "meadow", 8), light = new LightVolume(w);
  for (const [x, y, z, b] of [[40, 30, 40, 20], [41, 31, 40, 0], [64, 20, 64, 42], [10, 45, 100, 0], [100, 5, 7, 0]]) {
    w.set(x, y, z, b);
    light.update(x, y, z);
  }
  assert.equal(sha(light.sky, light.block, light.heights), "a2ee2a558fca8089");
});

test("cells live in their own 16 x 16 column; the world keeps its legacy bounds", () => {
  const w = new World("columns");
  assert.equal(w.chunks.size, (SIZE / 16) ** 2);
  for (const c of w.chunks.values()) {
    assert.ok(c instanceof WorldChunk);
    assert.equal(c.blocks.length, 256 * HEIGHT);
    assert.strictEqual(w.chunkAt(c.x, c.z), c);
  }
  assert.equal(w.chunkAt(-1, 0), null);
  assert.equal(w.chunkAt(SIZE / 16, 0), null);
  // A write at a column edge lands in that column only, at (lx * 16 + lz) * HEIGHT + y.
  const before = new Map([...w.chunks.values()].map((c) => [c, sha(c.blocks, c.meta)]));
  assert.equal(w.put(47, 40, 32, 8, 3), true);
  const c = w.chunkAt(2, 2), i = (15 * 16 + 0) * HEIGHT + 40;
  assert.deepEqual([c.blocks[i], c.meta[i]], [8, 3]);
  for (const [other, hash] of before) if (other !== c) assert.equal(sha(other.blocks, other.meta), hash);
  assert.deepEqual([w.get(47, 40, 32), w.getMeta(47, 40, 32)], [8, 3]);
  assert.equal(w.edits.get("47,40,32"), 8 | (3 << 8));
  // Outside: virtual bedrock below y 0, air beyond the edges and above the top; writes refused.
  assert.equal(w.get(5, -1, 5), 11);
  for (const p of [[-1, 30, 5], [SIZE, 30, 5], [5, 30, -1], [5, 30, SIZE], [5, HEIGHT, 5]]) {
    assert.equal(w.get(...p), 0);
    assert.equal(w.getMeta(...p), 0);
    assert.equal(w.put(...p, 3), false);
  }
  assert.equal(w.put(5, 0, 5, 3), false, "bedrock layer");
  // index() keeps the flat order the fire and fluid queues key by.
  assert.equal(w.index(47, 40, 32), (47 * SIZE + 32) * HEIGHT + 40);
  const { data, meta } = w.snapshot();
  assert.deepEqual([data[w.index(47, 40, 32)], meta[w.index(47, 40, 32)]], [8, 3]);
});

test("per-column section tick counts follow edits", () => {
  const w = new World("ticks", "meadow", 8);
  const count = (cx, cz, s) => {
    let n = 0;
    for (let x = cx * 16; x < cx * 16 + 16; x++)
      for (let z = cz * 16; z < cz * 16 + 16; z++) for (let y = s * 16; y < s * 16 + 16; y++) if (ticksRandomly(w.get(x, y, z))) n++;
    return n;
  };
  assert.equal(w.sectionTickCount(3, 4, 1), count(3, 4, 1));
  // Grass (ticks) over stone, a sapling, then back to air: the count moves with each write.
  w.set(50, 20, 66, 1);
  w.set(51, 20, 66, 48);
  w.set(52, 20, 66, 3);
  assert.equal(w.sectionTickCount(3, 4, 1), count(3, 4, 1));
  w.set(51, 20, 66, 0);
  assert.equal(w.sectionTickCount(3, 4, 1), count(3, 4, 1));
  for (let s = 0; s < HEIGHT / 16; s++) assert.equal(w.sectionTickCount(7, 0, s), count(7, 0, s));
});
