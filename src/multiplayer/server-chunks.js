// Batch 67 serverchunks: the dedicated server's per-player active chunks (World.activeChunkSet).
//
// Before: the server ticked every chunk of its finite world from the world centre (Weather.activeChunks(64, 64), radius 10 reaches all of 8 x 8 chunks), so a chunk far from every player
// still got lightning rolls, ice and snow rolls and random block ticks, and a world with nobody in it kept ticking.
// Native (bytecode-read, ahb.C = setActivePlayerChunksAndCheckLight, mt.g = WorldServer.func_147456_g):
//   * `F` (activeChunkSet, a java.util.HashSet<agu> = ChunkCoordIntPair) is cleared, then for EVERY player of the dimension (ahb.h, in list order) the square
//     [-r, r] x [-r, r] around the player's chunk (qh.c(posX / 16), qh.c(posZ / 16)) is added, x outer loop, z inner. r = ahb.p(): WorldServer.p() returns
//     ServerConfigurationManager.getViewDistance (oi.s), 10 by default. (The brief's 7 is World.p's client-side constant in other versions; the server's own is the view distance.)
//   * mt.g then iterates `F` itself, so the chunks are visited in HashSet bucket order: ChunkCoordIntPair.hashCode (agu.hashCode: 1664525 * x + 1013904223 xor
//     1664525 * (z ^ -559038737) + 1013904223) through HashMap's hash spreading. java-hashset-order.js models that (the batch 49 tracker order).
//   * HashSet.clear() keeps the table, so the bucket count only ever grows; ChunkSet below keeps that high-water capacity.
//   * With no player in the dimension the set is empty: nothing is ticked there (a chunk outside every radius gets no random tick).
// A chunk of the set that is outside the server's finite window is skipped (the real world has no such limit); its place in the order is still the native one.
// `world.originX/originZ` is native - local for the End window (END_OFFSET); the native chunk is the local chunk plus floor(origin / 16) (exact when the origin is a multiple of 16: the
// 256 End and the Overworld and Nether; approximate for the legacy 128 End window, whose x origin is 25).
import { JavaHashSetOrder } from '../java-hashset-order.js';
import { chunkHash } from '../chunk-store.js';

export const VIEW_DISTANCE = 10;

export class ChunkSet {
  constructor(mode = 'java8') {
    this.mode = mode;
    this.capacity = 16; // HashMap table size, kept across clear()
    this.lastKey = null;
    this.last = [];
  }
  // The whole set in HashSet order (local chunk coordinates, not clipped): one ahb.C fill of the retained table from the player chunks `centres`.
  order(centres, radius = VIEW_DISTANCE, bx = 0, bz = 0) {
    const set = new JavaHashSetOrder(this.mode);
    if (this.capacity > set.capacity) set.table = new Array(this.capacity).fill(null).map(() => []);
    for (const [cx, cz] of centres) for (let i = -radius; i <= radius; i++) for (let j = -radius; j <= radius; j++) {
      const x = cx + i, z = cz + j;
      set.add(`${x},${z}`, chunkHash(x + bx, z + bz));
    }
    this.capacity = Math.max(this.capacity, set.capacity);
    return set.keys().map(k => k.split(',').map(Number));
  }
  // players: [{ x, z }] in the world's local coordinates, in the native player-list order. Returns [[localCx, localCz]] in HashSet order, clipped to the world.
  chunks(players, world, radius = VIEW_DISTANCE) {
    const size = (world?.size ?? 128) / 16, bx = Math.floor((world?.originX ?? 0) / 16), bz = Math.floor((world?.originZ ?? 0) / 16);
    const centres = players.map(p => [Math.floor(p.x / 16), Math.floor(p.z / 16)]);
    const key = `${radius}|${size}|${bx},${bz}|${centres.join(';')}`;
    if (key === this.lastKey) return this.last;
    const out = this.order(centres, radius, bx, bz).filter(([x, z]) => x >= 0 && z >= 0 && x < size && z < size);
    this.lastKey = key; this.last = out;
    return out;
  }
}

// The simulation's sets, one per dimension (Overworld 0, Nether -1, End 1). `sim.players` entries are { position, dimension }.
export class ServerChunkSets {
  constructor(sim, radius = VIEW_DISTANCE) {
    this.sim = sim; this.radius = radius; this.sets = new Map();
  }
  chunks(dim, world) {
    let s = this.sets.get(dim);
    if (!s) this.sets.set(dim, (s = new ChunkSet()));
    const here = [];
    for (const p of this.sim.players.values()) if ((p.dimension | 0) === dim) here.push({ x: p.position.x, z: p.position.z });
    return s.chunks(here, world, this.radius);
  }
  // Weather.activeChunkSource for one dimension
  sourceFor(dim) { return world => this.chunks(dim, world); }
}
