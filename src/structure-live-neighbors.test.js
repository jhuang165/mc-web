// The live PopulationArea in neighbours mode (generation-time onBlockAdded / onNeighborBlockChange chains: doors, redstone, tripwire, buttons,
// plates, dispenser markDirty) over the native default-world structure areas (tools/verify-structure-area.mjs, structure-area-reference.json):
// ordered World calls and writes, Random states, final chunks, tiles, carts and pending ticks, every chunk of every area including the
// jungle temple (the batch 14 non-temple decoration divergence no longer reproduces: batch 16's mutated-biome rule fixed it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ChunkProviderGenerate, BiomeTerrainState } from './terrain-generator.js';
import { MapGenCaves, MapGenRavine } from './mapgen.js';
import { PopulationArea, populationBlockMapperReady } from './population-world.js';
import { structureChunkSha1 } from './structure-population-area.js';
import { randomLong } from './structure-framework.js';
await populationBlockMapperReady;

const reference = JSON.parse(readFileSync(new URL('../public/research/structure-area-reference.json', import.meta.url)));
const ints = (values) => Buffer.from(values.flatMap((v) => [v & 255, v >> 8 & 255, v >> 16 & 255, v >> 24 & 255]));
function terrainSource(seed) {
  const state = new BiomeTerrainState(), gen = new ChunkProviderGenerate(seed, 'default', state), manager = gen.manager;
  const top = (x, z) => state.topBlock(manager.biomeAt(x, z));
  const caves = new MapGenCaves(seed, manager, top), ravines = new MapGenRavine(seed, manager, top), cache = new Map();
  const terrain = (x, z) => {
    const k = `${x},${z}`; let chunk = cache.get(k);
    if (!chunk) {
      const c = gen.provideChunk(x, z); caves.generate(x, z, c.blocks); ravines.generate(x, z, c.blocks);
      chunk = { blocks: c.blocks.slice(), metadata: c.metadata.slice() }; cache.set(k, chunk);
    }
    return chunk;
  };
  return { terrain, manager };
}
const stack = (s) => (s ? [s[0], s[1], s[2], (s[3] ?? []).map(([id, level]) => [id, level])] : null);

for (const rec of reference.records) {
  test(`live PopulationArea (neighbours) replays native area ${rec.label} call by call`, () => {
    const [cx, cz] = rec.origin, { terrain, manager } = terrainSource(BigInt(rec.seed)), steps = [];
    let calls, writes, callCount, writeCount;
    const placed = [];
    const area = new PopulationArea({ seed: BigInt(rec.seed), chunkX: cx, chunkZ: cz, size: rec.size, terrain, biomeAt: (x, z) => manager.biomeAt(x, z), structures: true, manager, neighbors: true });
    const w = area.world;
    area.run({
      beforePopulate() {
        calls = createHash('sha1'); writes = createHash('sha1'); callCount = 0; writeCount = 0;
        w.onCall = (...a) => { callCount++; calls.update(ints(a)); };
        w.onWrite = (...a) => { writeCount++; writes.update(ints(a)); if (a[3] === 94 || a[3] === 75 || a[3] === 76 || a[3] === 69 || a[3] === 77) placed.push(a); };
      },
      afterPopulate(x, z, random) {
        w.onCall = null; w.onWrite = null;
        steps.push({ chunk: [x, z], callCount, callsSha1: calls.digest('hex'), writeCount, writesSha1: writes.digest('hex'), nextLong: randomLong(random).toString(), worldNextLong: randomLong(w.rand).toString() });
      },
    });
    // Vanilla generation never leaves a repeater, torch, lever or button powered: no id 94 (powered repeater is 94 with meta bit, 75/76 torch
    // swap) or lever (69) / button (77) with the powered bit 8 is written, in native or in the replay.
    for (const [x, y, z, id, meta] of placed) {
      if (id === 69 || id === 77) assert.equal(meta & 8, 0, `${rec.label} ${id} powered at ${x},${y},${z}`);
      if (id === 75) assert.fail(`${rec.label} unlit torch written at ${x},${y},${z}`);
    }
    steps.forEach((row, i) => {
      const native = rec.steps[i], at = `${rec.label} chunk ${native.chunk}`;
      assert.equal(row.writeCount, native.writeCount, `ordered writes ${at}`);
      assert.equal(row.writesSha1, native.writesSha1, `ordered write hash ${at}`);
      assert.equal(row.nextLong, native.providerNextLong, `provider Random ${at}`);
      assert.equal(row.worldNextLong, native.worldNextLong, `World.rand ${at}`);
      assert.equal(row.callCount, native.callCount, `ordered world calls ${at}`);
      assert.equal(row.callsSha1, native.callsSha1, `ordered call hash ${at}`);
    });
    for (const native of rec.chunks) assert.equal(structureChunkSha1(w.chunk(...native.chunk)), native.sha1, `final chunk hash ${native.chunk}`);
    assert.deepEqual(w.carts.map((e) => [e.x, e.y, e.z, e.slots.map(stack)]), rec.carts, 'carts');
    assert.deepEqual(w.pending, rec.pending, 'pending ticks');
  });
}
