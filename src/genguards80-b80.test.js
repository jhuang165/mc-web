// Batch 80 genguards80: which world-generation "unported" guards natural generation reaches (none, over the surveyed seeds and world types;
// see .shared-memory/notes/genguards80-b80-track.md), what the jungle temple's generation-time block updates change (executed against the
// native jungleTemple671 area of structure-area-reference.json, which structure-live-neighbors.test.js replays call for call), and the
// streamed retry path that still catches a guard if one ever fires.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChunkProviderGenerate, BiomeTerrainState } from './terrain-generator.js';
import { MapGenCaves, MapGenRavine } from './mapgen.js';
import { PopulationArea, populationBlockMapperReady } from './population-world.js';
import { StreamingPopulation } from './streaming-population.js';
import { streamedSource } from './java-world.js';
import { GenWorld } from './gen-world.js';
import { mineshaftGenWorldClass } from './mineshaft-world.js';
import { JavaRandom } from './java-random.js';
await populationBlockMapperReady;

function jungleArea(neighbors) {
  const seed = 671n, state = new BiomeTerrainState(), gen = new ChunkProviderGenerate(seed, 'default', state), manager = gen.manager;
  const top = (x, z) => state.topBlock(manager.biomeAt(x, z)), caves = new MapGenCaves(seed, manager, top), ravines = new MapGenRavine(seed, manager, top);
  const terrain = (x, z) => { const c = gen.provideChunk(x, z); caves.generate(x, z, c.blocks); ravines.generate(x, z, c.blocks); return c; };
  return new PopulationArea({ seed, chunkX: 0, chunkZ: 13, size: 4, terrain, biomeAt: (x, z) => manager.biomeAt(x, z), structures: true, manager, neighbors }).run().world;
}

test('the jungle temple callbacks clear the bit-4 metadata of two tripwire strings and queue two hook ticks, nothing else', () => {
  const on = jungleArea(true), off = jungleArea(false), diff = [];
  for (let cx = 0; cx < 4; cx++) for (let cz = 13; cz < 17; cz++) {
    const a = on.chunk(cx, cz), b = off.chunk(cx, cz);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++)
      if (a.getBlock(x, y, z) !== b.getBlock(x, y, z) || a.getMeta(x, y, z) !== b.getMeta(x, y, z))
        diff.push([cx * 16 + x, y, cz * 16 + z, b.getBlock(x, y, z), b.getMeta(x, y, z), a.getBlock(x, y, z), a.getMeta(x, y, z)]);
  }
  assert.deepEqual(diff, [[40, 64, 242, 132, 4, 132, 0], [40, 64, 243, 132, 4, 132, 0]]);
  // The hooks keep their attached bit (131:4 facing south, 131:6 facing north).
  assert.deepEqual([on.getBlockMetadata(40, 64, 241), on.getBlockMetadata(40, 64, 244)], [4, 6]);
  const quiet = new Set(off.pending.map((p) => p.join(',')));
  assert.deepEqual(on.pending.filter((p) => !quiet.has(p.join(','))), [[33, 64, 247, 131, 10, 0], [40, 64, 244, 131, 10, 0]]);
  assert.equal(on.pending.length, off.pending.length + 2);
});

test('generation-20 streamed cells over temples, villages and a stronghold build without a neighbour retry or a fallback', () => {
  const warn = console.warn, error = console.error, said = [];
  console.warn = (m) => said.push(`warn ${m}`); console.error = (m) => said.push(`error ${m}`);
  try {
    // seed 12: a jungle temple; seed 9: a desert temple and a village; seed 10: a village and a stronghold (structure summaries checked below).
    for (const [seed, cx, cz, want] of [[12n, -7, -8, 'jungle'], [9n, -6, -8, 'desert'], [10n, -7, 5, 'stronghold']]) {
      const cell = streamedSource({ seed, generationVersion: 20, originX: 0, originZ: 0 }).population.cell(cx, cz);
      assert.equal(cell.failed, null);
      if (want === 'stronghold') assert.ok(cell.strongholds.length && cell.villages.length);
      else assert.ok(cell.temples.some((t) => t.kind === want));
    }
  } finally { console.warn = warn; console.error = error; }
  assert.deepEqual(said, []);
});

test('a guard thrown in neighbours mode retries the cell with the quiet callbacks; a quiet throw falls back to terrain', () => {
  const terrainOnly = () => ({ blocks: new Uint8Array(65536), metadata: new Uint8Array(65536) });
  class Probe extends StreamingPopulation {
    generate(cellX, cellZ, neighbors = this.neighbors) {
      if (neighbors || this.quietThrows) throw new Error('gen-world: unported onNeighborBlockChange for block 65');
      return { cellX, cellZ, columns: new Map(), records: new Map(), mineshafts: [], populates: 81, failed: null, quiet: true };
    }
  }
  const warn = console.warn, error = console.error, said = [];
  console.warn = (m) => said.push(['warn', m]); console.error = (m) => said.push(['error', m]);
  try {
    const p = new Probe({ seed: 1, originX: 0, originZ: 0, terrain: null, biomeAt: null, terrainOnly, neighbors: true });
    assert.equal(p.cell(0, 0).quiet, true);
    p.quietThrows = true;
    assert.match(p.cell(1, 0).failed, /unported onNeighborBlockChange for block 65/);
    assert.equal(p.cell(1, 0).columns.size, 64);
  } finally { console.warn = warn; console.error = error; }
  assert.deepEqual(said.map(([k, m]) => [k, m.replace(/: .*/, '')]),
    [['warn', 'streaming-population'], ['warn', 'streaming-population'], ['error', 'streaming-population']]);
});

test('the unreached guards still throw instead of guessing', () => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < 64; y++) blocks[(x * 16 + z) * 256 + y] = 1;
  const w = new GenWorld({ rand: new JavaRandom(0n) });
  w.addChunk(0, 0, blocks, meta);
  // Ladder neighbour change, crop drops (a spring flowing into a village farm), a redstone comparator beside a filled chest.
  assert.throws(() => w.neighborChanged(65, 4, 64, 4, 1), /unported onNeighborBlockChange for block 65/);
  assert.throws(() => w.dropBlockAsItem(59, 4, 64, 4, 7, 0), /unported drops for block 59/);
  w.chunk(0, 0).sections[3].blocks[(63 & 15) << 8 | 4 << 4 | 5] = 149;
  assert.throws(() => w.notifyComparators(4, 63, 4, 54), /unported comparator neighbour for block 149/);
  // A rail told by a power provider (BlockRailBase.onNeighborBlockChange's power branch).
  const M = mineshaftGenWorldClass(), m = new M({ rand: new JavaRandom(0n), terrain: () => ({ blocks, metadata: meta }) });
  m.load(0, 0);
  assert.throws(() => m.railNeighbor(4, 64, 4, 55), /unported rail power update for block 55/);
});
