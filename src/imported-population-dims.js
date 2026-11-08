// Nether and End population of imported chunks (batch 28 interchange5). The same native trigger as the Overworld
// (Chunk.populateChunk: a chunk populates once it and its +x, +z, +x+z neighbours are loaded, imported-population.js populationPlan),
// with the ported ChunkProviderHell.populate / ChunkProviderEnd.populate over the stored cells.
//
//   Nether: ONE ChunkProviderHell for the whole import; its hellRNG is the constructor state (a server that just started, no
//   provideChunk has reseeded it) and carries over every populate call, as natively. Fortress starts are searched with
//   MapGenNetherBridge.generate for the four chunks of the populate window (natively provideChunk of the stored chunks finds them
//   and Fortress.dat keeps them). World.rand is one JavaRandom(0) for the import (natively time-seeded; it only draws fire tick delays).
//   End: ChunkProviderEnd.populate draws from World.rand (natively time-seeded); the model is the per-chunk seed
//   seed ^ (x * 341873128712 + z * 132897987541) that dimension-world.js already uses.
// Terrain a populate reads from a chunk that is not stored is the generator's own (a lazily generated halo; writes are dropped).
//
// A runner is { window(x, z) -> [[x, z]] stored chunks the call needs, run(x, z, terrain) -> pass }; terrain(a, b) returns
// {blocks, metadata} (original ids, (lx * 16 + lz) * 256 + y) of a stored chunk, null for a chunk that is not stored, and may throw to ask
// for a stored chunk the cache does not hold yet. pass = { world, chunks: Map "x,z" -> {x, z, blocks, metadata}, entities, pending }.
import { JavaRandom } from "./java-random.js";
import { ChunkProviderHell, NetherGenWorld, hellChunkSeed } from "./nether-generator.js";
import { EndTerrain, EndWorld, populateEndChunk } from "./end-generator.js";

const key = (x, z) => `${x},${z}`;
const popSeed = (seed, cx, cz) => BigInt.asIntN(64, seed ^ (BigInt(cx) * 341873128712n + BigInt(cz) * 132897987541n));
const windowOf = (x, z) => [[x, z], [x + 1, z], [x, z + 1], [x + 1, z + 1]];

class ImportNetherWorld extends NetherGenWorld {
  constructor({ terrain, halo, rand }) { super({ rand, halo }); this.terrain = terrain; }
  chunk(x, z) {
    const c = this.chunks.get(key(x, z));
    if (c) return c;
    const t = this.terrain(x, z);
    if (t) { const blocks = new Uint16Array(65536); blocks.set(t.blocks); return this.addChunk(x, z, blocks, Uint8Array.from(t.metadata)); }
    return this.addNetherChunk(this.halo.generateChunk(x, z));
  }
}

// GenChunk sections (16 slots {blocks: Uint16Array(4096), meta}, index (y & 15) << 8 | z << 4 | x) as flat original arrays.
function flatOfGen(c) {
  const blocks = new Uint8Array(65536), metadata = new Uint8Array(65536);
  for (let s = 0; s < 16; s++) {
    const sec = c.sections[s];
    if (!sec) continue;
    for (let ly = 0; ly < 16; ly++) for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const j = ly << 8 | lz << 4 | lx, i = (lx * 16 + lz) * 256 + s * 16 + ly;
      blocks[i] = sec.blocks[j]; metadata[i] = sec.meta[j];
    }
  }
  return { blocks, metadata };
}

export function netherRunner(seed) {
  seed = BigInt(seed);
  const provider = new ChunkProviderHell(seed), haloProvider = new ChunkProviderHell(seed), rand = new JavaRandom(0);
  haloProvider.bridge = { generate() {} }; // halo terrain never needs the fortress search
  return {
    window: windowOf,
    // A run that needs a stored chunk the cache does not hold is retried: the shared generators go back to their state before it.
    mark() { return [provider.hellRNG.save(), rand.save()]; },
    reset([h, r]) { provider.hellRNG.restore(h); rand.restore(r); },
    run(x, z, terrain) {
      const world = new ImportNetherWorld({ terrain, halo: haloProvider, rand });
      for (const [a, b] of windowOf(x, z)) { world.chunk(a, b); provider.bridge.generate(a, b); }
      provider.populate(world, x, z);
      const chunks = new Map();
      for (const c of world.chunks.values()) chunks.set(key(c.x, c.z), { x: c.x, z: c.z, ...flatOfGen(c) });
      return { world, chunks, entities: [], pending: world.pending };
    },
  };
}

export function endRunner(seed) {
  seed = BigInt(seed);
  const terrain = new EndTerrain(seed);
  return {
    window: windowOf,
    mark() { return null; },
    reset() {},
    run(x, z, source) {
      const world = new EndWorld(0, new JavaRandom(1));
      world.terrain = terrain;
      const real = world.chunk.bind(world), stored = new Set();
      world.chunk = (cx, cz) => {
        const k = key(cx, cz);
        let c = world.chunks.get(k);
        if (c) return c;
        const t = source(cx, cz);
        if (!t) return real(cx, cz);
        c = { cx, cz, ids: Uint8Array.from(t.blocks), meta: Uint8Array.from(t.metadata) };
        world.chunks.set(k, c); stored.add(k);
        return c;
      };
      for (const [a, b] of windowOf(x, z)) world.chunk(a, b);
      populateEndChunk(world, new JavaRandom(popSeed(seed, x, z)), x, z);
      const chunks = new Map();
      for (const k of stored) { const c = world.chunks.get(k); chunks.set(k, { x: c.cx, z: c.cz, blocks: c.ids, metadata: c.meta }); }
      return { world, chunks, entities: world.entities, pending: [] };
    },
  };
}

export const dimensionRunner = (dimension, seed) => (dimension === -1 ? netherRunner(seed) : endRunner(seed));
export { hellChunkSeed };

/**
 * Stored-column generator of a dimension for tests and tools: the ported provideChunk of chunk (x, z) as original-id arrays
 * {blocks, metadata} in the (lx * 16 + lz) * 256 + y layout the stored columns and populate use.
 */
export function dimensionTerrain(dimension, seed) {
  seed = BigInt(seed);
  if (dimension === -1) {
    const provider = new ChunkProviderHell(seed);
    return (x, z) => {
      const { blocks } = provider.generateChunk(x, z), out = new Uint8Array(65536);
      for (let i = 0; i < 32768; i++) out[(i >> 7) * 256 + (i & 127)] = blocks[i];
      return { blocks: out, metadata: new Uint8Array(65536) };
    };
  }
  const terrain = new EndTerrain(seed);
  return (x, z) => {
    const base = terrain.blocks(x, z), out = new Uint8Array(65536);
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y < 128; y++) out[(lx * 16 + lz) * 256 + y] = base[lx << 11 | lz << 7 | y];
    return { blocks: out, metadata: new Uint8Array(65536) };
  };
}
