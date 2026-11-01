import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NibbleArray, ExtendedBlockStorage, Chunk, ChunkStore, chunkXZ2Int, chunkHash, chunkKey, fromLegacyWorld, toLegacyWorld } from "./chunk-store.js";
import { ORIGINAL_BLOCK_IDS, ORIGINAL_CONTAINERS } from "./block-registry.js";
import { JavaRandom } from "./lighting.js";
import { World, SIZE, HEIGHT, BLOCKS } from "./world.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/chunk-reference.json", import.meta.url)));
const records = (kind) => reference.records.filter((r) => r.kind === kind);
const hex = (bytes) => Buffer.from(bytes).toString("hex");

test("NibbleArray replays the original get/set ops and byte layout", () => {
  const cases = records("nibble");
  assert.equal(cases.length, 3);
  for (const c of cases) {
    const n = new NibbleArray(c.size, c.depth);
    for (const [x, y, z, v] of c.ops) n.set(x, y, z, v);
    assert.equal(hex(n.data), c.data);
    for (const [x, y, z, v] of c.reads) assert.equal(n.get(x, y, z), v);
  }
});

test("ExtendedBlockStorage matches reference counts, ids, metadata, light and raw arrays", () => {
  const cases = records("section");
  assert.equal(cases.length, 4);
  for (const c of cases) {
    const s = new ExtendedBlockStorage(c.yBase, c.sky);
    c.ops.forEach((op, i) => {
      const [kind, x, y, z, v] = op;
      if (kind === 0) s.setBlock(x, y, z, v);
      else if (kind === 1) s.setMeta(x, y, z, v);
      else if (kind === 2) s.setSkylight(x, y, z, v);
      else if (kind === 3) s.setBlocklight(x, y, z, v);
      else if (kind === 4) s.lsb[x] = y;
      else if (kind === 5) (s.msb || s.createMsb()).set(x, y, z, v);
      else s.recount();
      const [ref, tick, empty, needs, ax, ay, az, id, meta] = c.after[i];
      assert.deepEqual([s.blockRefCount, s.tickRefCount, +s.isEmpty(), +s.needsRandomTick()], [ref, tick, empty, needs], `op ${i}`);
      assert.deepEqual([s.getBlock(ax, ay, az), s.getMeta(ax, ay, az)], [id, meta], `op ${i} read`);
    });
    for (const [x, y, z, id, meta, block, sky] of c.reads) {
      assert.deepEqual([s.getBlock(x, y, z), s.getMeta(x, y, z), s.getBlocklight(x, y, z)], [id, meta, block]);
      if (c.sky) assert.equal(s.getSkylight(x, y, z), sky);
    }
    assert.equal(hex(s.lsb), c.lsb);
    assert.equal(s.msb ? hex(s.msb.data) : null, c.msb);
    assert.equal(!!s.skylight, c.hasSky);
  }
});

test("high block ids use the MSB nibble and unregistered ids read as air", () => {
  const s = new ExtendedBlockStorage(0, true);
  s.lsb[0] = 1;
  s.createMsb().set(0, 0, 0, 1); // 257: unregistered
  assert.equal(s.getBlock(0, 0, 0), 0);
  s.recount();
  assert.equal(s.blockRefCount, 0);
  s.setBlock(0, 0, 0, 1);
  assert.equal(s.msb.get(0, 0, 0), 0, "a low id clears the high nibble");
  assert.throws(() => s.setBlock(1, 0, 0, 300), RangeError);
  assert.throws(() => s.setBlock(1, 0, 0, 167), RangeError);
});

function summary(c) {
  return c.sections.map((s) => (s ? [s.yBase, s.blockRefCount, s.tickRefCount, !!s.skylight] : null));
}

test("Chunk generation constructors, reads and setBlockMetadata match the original", () => {
  for (const c of records("chunk")) {
    const chunk = Chunk.fromGeneration(Int16Array.from(c.blocks.map(Number)), Uint8Array.from(c.meta.map(Number)), c.x, c.z);
    assert.deepEqual(summary(chunk), c.sections, `k ${c.k}`);
    assert.equal(chunk.topFilledSegment(), c.top);
    for (const [x, y, z, id, meta] of c.reads) assert.deepEqual([chunk.getBlock(x, y, z), chunk.getMeta(x, y, z)], [id, meta], `${x},${y},${z}`);
    assert.equal(c.negativeY, "ArrayIndexOutOfBoundsException");
    assert.throws(() => chunk.getBlock(0, -1, 0), RangeError);
    for (const [x, y, z, v, result, after] of c.metaOps) {
      assert.equal(chunk.setMeta(x, y, z, v), !!result, `setMeta ${x},${y},${z} ${v}`);
      assert.equal(chunk.getMeta(x, y, z), after);
    }
    assert.ok(c.heightMap.every((h, i) => h === chunk.heightMap[i]));
    assert.ok(c.precipitation.every((h, i) => h === chunk.precipitationHeightMap[i]));
    assert.equal(Buffer.from(chunk.biomes.buffer).toString("hex"), c.biomes);
  }
  const b = records("blockChunk")[0];
  const chunk = Chunk.fromBlocks(Int16Array.from(b.blocks.map(Number)), b.x, b.z);
  assert.deepEqual(summary(chunk), b.sections);
  assert.equal(chunk.topFilledSegment(), b.top);
  for (const [x, y, z, id, meta] of b.reads) assert.deepEqual([chunk.getBlock(x, y, z), chunk.getMeta(x, y, z)], [id, meta]);
});

// ChunkProbe.chunkFrom with java.util.Random, for the world lookup chunks.
function probeChunk(k, cx, cz, seed, fill) {
  const r = new JavaRandom(seed), blocks = new Int16Array(256 * k), meta = new Uint8Array(256 * k), reg = ORIGINAL_BLOCK_IDS;
  for (let i = 0; i < blocks.length; i++) {
    const y = i % k, solid = r.nextDouble() < fill * (y < 20 ? 1 : 0.15);
    let id = solid ? reg[1 + r.nextInt(reg.length - 1)] : 0;
    if (solid && ORIGINAL_CONTAINERS.includes(id)) id = 1;
    blocks[i] = r.nextInt(50) === 0 ? -1 : id;
    meta[i] = r.nextInt(16);
  }
  return Chunk.fromGeneration(blocks, meta, cx, cz);
}

test("World.getBlock/getBlockMetadata coordinates: negatives, height and the border", () => {
  const w = records("world")[0], store = new ChunkStore();
  for (let cx = -2; cx <= 1; cx++) for (let cz = -2; cz <= 1; cz++) store.addChunk(probeChunk(64, cx, cz, 7000 + (cx + 2) * 4 + (cz + 2), 0.6));
  assert.equal(w.lookups.length, 2312);
  let solid = 0;
  for (const [x, y, z, id, meta, request] of w.lookups) {
    assert.deepEqual([store.getBlock(x, y, z), store.getMeta(x, y, z)], [id, meta], `${x},${y},${z}`);
    if (request) assert.deepEqual(request, [x >> 4, z >> 4]);
    if (id) solid++;
  }
  assert.ok(solid > 100, "lookups reach stored blocks");
});

test("ChunkCoordIntPair keys and hashes", () => {
  const { keys } = records("keys")[0];
  for (const [x, z, key, hash] of keys) {
    assert.equal(chunkXZ2Int(x, z).toString(), key);
    assert.equal(chunkHash(x, z), hash);
  }
  assert.throws(() => chunkKey(1875000 * 2, 0), RangeError);
  assert.notEqual(chunkKey(-1, 0), chunkKey(0, -1));
});

test("ChunkStore storage writes follow World.setBlock bounds and section creation", () => {
  const s = new ChunkStore();
  assert.equal(s.setBlockState(-1, 255, -1, 1, 0), true);
  assert.equal(s.getBlock(-1, 255, -1), 1);
  assert.equal(s.getChunk(-1, -1).topFilledSegment(), 240);
  assert.equal(s.setBlockState(-1, 255, -1, 1, 0), false, "unchanged");
  assert.equal(s.setBlockState(-1, 256, -1, 1), false);
  assert.equal(s.setBlockState(-1, -1, -1, 1), false);
  assert.equal(s.setBlockState(30000000, 5, 0, 1), false);
  assert.equal(s.setBlockState(-30000000, 5, 0, 1), true);
  assert.equal(s.setBlockState(-17, 3, 40, 0), false, "air into a missing chunk");
  assert.equal(s.setBlockState(-1, 16, -1, 0), false, "air into a missing section");
  assert.equal(s.getChunk(-1, -1).sections[1], null);
  assert.equal(s.setBlockState(-1, 255, -1, 0), true);
  assert.equal(s.getChunk(-1, -1).sections[15].isEmpty(), true, "emptied sections stay allocated");
  assert.equal(s.setMeta(-1, 255, -1, 3), true);
  assert.equal(s.getMeta(-1, 255, -1), 3);
});

test("legacy 128 x 128 x 64 worlds migrate to chunks and back without moving or changing cells", () => {
  const world = new World("chunk-migration", "meadow", 8), row = HEIGHT - 2;
  // Every internal block with every metadata value in one row above the terrain.
  const at = (id, meta) => { const n = (id - 1) * 16 + meta; return [n % SIZE, row, Math.floor(n / SIZE)]; };
  for (let id = 1; id < BLOCKS.length; id++) for (let meta = 0; meta < 16; meta++) world.put(...at(id, meta), id, meta);
  // Side state the registry carries: a flowing water cell, moist farmland at 4, an east-facing chest.
  const side = new Map([[at(10, 3).join(), { flowing: true }], [at(30, 0).join(), { moisture: 4 }], [at(41, 0).join(), { facing: 5 }]]);
  const store = fromLegacyWorld(world, { stateAt: (x, y, z) => side.get([x, y, z].join()) });
  assert.equal(store.chunks.size, (SIZE / 16) ** 2);
  assert.deepEqual([store.getBlock(...at(10, 3)), store.getMeta(...at(10, 3))], [8, 3]);
  assert.deepEqual([store.getBlock(...at(10, 4)), store.getMeta(...at(10, 4))], [9, 4]);
  assert.deepEqual([store.getBlock(...at(30, 0)), store.getMeta(...at(30, 0))], [60, 4]);
  assert.deepEqual([store.getBlock(...at(41, 0)), store.getMeta(...at(41, 0))], [54, 5]);
  assert.deepEqual([store.getBlock(...at(20, 0)), store.getMeta(...at(20, 0))], [50, 5]);
  assert.equal(world.get(5, 0, 5), 11);
  assert.equal(store.getBlock(5, 0, 5), 7, "bedrock floor at y 0");
  assert.equal(store.getBlock(5, -1, 5), 0, "the port's virtual bedrock below y 0 is not a stored cell");
  assert.equal(store.getBlock(-1, 20, 5), 0, "nothing outside the legacy area");
  // A differently seeded world: every cell is overwritten.
  const into = new World("chunk-migration-back", "alpine", 8);
  const { inexact, state } = toLegacyWorld(store, into);
  const back = into.snapshot(), cells = world.snapshot();
  assert.deepEqual(inexact, [], "every stored cell is an exact original state");
  // Only stray metadata on blocks whose original state is fixed (stone meta 3, say) is dropped.
  for (let i = 0; i < cells.data.length; i++) {
    if (back.data[i] === cells.data[i] && back.meta[i] === cells.meta[i]) continue;
    assert.equal(i % HEIGHT, row);
    assert.equal(back.data[i], cells.data[i]);
    assert.ok(cells.meta[i] !== 0 && back.meta[i] === 0);
  }
  for (let id = 1; id < BLOCKS.length; id++) {
    const i = ((p) => (p[0] * SIZE + p[2]) * HEIGHT + p[1])(at(id, 0));
    assert.deepEqual([back.data[i], back.meta[i]], [id, 0], `internal ${id} meta 0`);
  }
  assert.deepEqual(state.get(at(10, 3).join()), { flowing: true });
  assert.deepEqual(state.get(at(30, 0).join()), { moisture: 4 });
  assert.deepEqual(state.get(at(41, 0).join()), { facing: 5 });
  assert.deepEqual(state.get(at(41, 1).join()), { facing: 3 });
});
