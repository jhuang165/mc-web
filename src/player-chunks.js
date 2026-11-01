// PlayerManager and PlayerInstance from 1.7.10: which chunks each player keeps loaded (a square of
// side 2 * viewRadius + 1 around its chunk), the order chunks are queued for sending (a spiral from
// the player's chunk), when a moving player's square shifts, and inhabited time. Chunks come from a
// ChunkProviderServer (chunk-provider.js). Block-change batching (flagChunkForUpdate and
// sendChunkUpdate) is not ported. Replayed against public/research/chunk-provider-reference.json.
//
// A player is { posX, posZ, managedPosX, managedPosZ, loadedChunks } where loadedChunks (the
// original EntityPlayerMP.loadedChunks) is the send queue of { x, z } locations.
import { chunkKey } from "./chunk-store.js";

const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
// Java's (int) cast of a double, then >> 4.
const toInt = (d) => (d >= 2147483647 ? 2147483647 : d <= -2147483648 ? -2147483648 : Math.trunc(d) | 0);
const chunkOf = (d) => toInt(d) >> 4;
const removeLocation = (list, x, z) => {
  const i = list.findIndex((c) => c.x === x && c.z === z);
  if (i >= 0) list.splice(i, 1);
};

export class PlayerInstance {
  constructor(manager, x, z) {
    this.manager = manager;
    this.players = [];
    this.location = { x, z };
    this.previousWorldTime = 0;
    manager.provider.loadChunk(x, z);
  }
  addPlayer(player) {
    if (this.players.includes(player)) return;
    if (this.players.length === 0) this.previousWorldTime = this.manager.world.totalTime;
    this.players.push(player);
    player.loadedChunks.push(this.location);
  }
  // A player leaving the last watcher of a chunk queues it for unloading. getChunkFromChunkCoords
  // may load the chunk again first.
  removePlayer(player) {
    if (!this.players.includes(player)) return;
    const { x, z } = this.location, m = this.manager, chunk = m.provider.provideChunk(x, z);
    if (chunk.isReadyToSend()) m.onChunkUnwatched?.(player, chunk);
    this.players.splice(this.players.indexOf(player), 1);
    removeLocation(player.loadedChunks, x, z);
    if (this.players.length === 0) {
      this.increaseInhabitedTime(chunk);
      m.instances.delete(chunkKey(x, z));
      m.playerInstanceList.splice(m.playerInstanceList.indexOf(this), 1);
      m.provider.unloadChunksIfNotNearSpawn(x, z);
    }
  }
  processChunk() {
    this.increaseInhabitedTime(this.manager.provider.provideChunk(this.location.x, this.location.z));
  }
  increaseInhabitedTime(chunk) {
    const t = this.manager.world.totalTime;
    chunk.inhabitedTime += t - this.previousWorldTime;
    this.previousWorldTime = t;
  }
}

export class PlayerManager {
  constructor(provider, viewDistance) {
    this.provider = provider;
    this.world = provider.world;
    this.players = [];
    this.instances = new Map();
    this.playerInstanceList = [];
    this.playerViewRadius = 0;
    this.previousTotalWorldTime = 0;
    this.onChunkUnwatched = null; // (player, chunk) for the unload packet of a sent chunk
    this.setViewDistance(viewDistance);
  }
  // updatePlayerInstances: every 8000 ticks each watched chunk adds its inhabited time. A dimension
  // players cannot respawn in unloads every chunk while it has no players.
  updatePlayerInstances() {
    const t = this.world.totalTime;
    if (t - this.previousTotalWorldTime > 8000) {
      this.previousTotalWorldTime = t;
      for (let i = 0; i < this.playerInstanceList.length; i++) this.playerInstanceList[i].processChunk();
    }
    if (this.players.length === 0 && !this.world.canRespawnHere) this.provider.unloadAllChunks();
  }
  hasWatcher(x, z) { return this.instances.has(chunkKey(x, z)); }
  getOrCreateChunkWatcher(x, z, create) {
    const key = chunkKey(x, z);
    let inst = this.instances.get(key);
    if (!inst && create) {
      inst = new PlayerInstance(this, x, z);
      this.instances.set(key, inst);
      this.playerInstanceList.push(inst);
    }
    return inst || null;
  }
  addPlayer(player) {
    const cx = chunkOf(player.posX), cz = chunkOf(player.posZ), r = this.playerViewRadius;
    player.managedPosX = player.posX;
    player.managedPosZ = player.posZ;
    for (let x = cx - r; x <= cx + r; x++) for (let z = cz - r; z <= cz + r; z++) this.getOrCreateChunkWatcher(x, z, true).addPlayer(player);
    this.players.push(player);
    this.filterChunkLoadQueue(player);
  }
  // filterChunkLoadQueue: reorders the player's send queue as a spiral out from its chunk, keeping
  // only chunks already queued. Every visited chunk gets a watcher (and is loaded).
  filterChunkLoadQueue(player) {
    const queued = new Set(player.loadedChunks.map((c) => chunkKey(c.x, c.z)));
    const r = this.playerViewRadius, cx = chunkOf(player.posX), cz = chunkOf(player.posZ), out = [];
    const visit = (x, z) => {
      const loc = this.getOrCreateChunkWatcher(x, z, true).location;
      if (queued.has(chunkKey(loc.x, loc.z))) out.push(loc);
    };
    let dir = 0, dx = 0, dz = 0;
    visit(cx, cz);
    for (let len = 1; len <= r * 2; len++)
      for (let leg = 0; leg < 2; leg++) {
        const d = DIRECTIONS[dir++ % 4];
        for (let s = 0; s < len; s++) {
          dx += d[0];
          dz += d[1];
          visit(cx + dx, cz + dz);
        }
      }
    dir %= 4;
    for (let s = 0; s < r * 2; s++) {
      dx += DIRECTIONS[dir][0];
      dz += DIRECTIONS[dir][1];
      visit(cx + dx, cz + dz);
    }
    player.loadedChunks.length = 0;
    player.loadedChunks.push(...out);
  }
  removePlayer(player) {
    const cx = chunkOf(player.managedPosX), cz = chunkOf(player.managedPosZ), r = this.playerViewRadius;
    for (let x = cx - r; x <= cx + r; x++) for (let z = cz - r; z <= cz + r; z++) this.getOrCreateChunkWatcher(x, z, false)?.removePlayer(player);
    const i = this.players.indexOf(player);
    if (i >= 0) this.players.splice(i, 1);
  }
  overlaps(x1, z1, x2, z2, r) {
    const dx = x1 - x2, dz = z1 - z2;
    return dx >= -r && dx <= r && dz >= -r && dz <= r;
  }
  // updatePlayerPertinentChunks: after 8 blocks of movement into another chunk, the square shifts:
  // new columns are watched, then the columns left behind are released, in one pass.
  updatePlayerPertinentChunks(player) {
    const cx = chunkOf(player.posX), cz = chunkOf(player.posZ);
    const ddx = player.managedPosX - player.posX, ddz = player.managedPosZ - player.posZ;
    if (ddx * ddx + ddz * ddz < 64) return;
    const ox = chunkOf(player.managedPosX), oz = chunkOf(player.managedPosZ), r = this.playerViewRadius, mx = cx - ox, mz = cz - oz;
    if (mx === 0 && mz === 0) return;
    for (let x = cx - r; x <= cx + r; x++)
      for (let z = cz - r; z <= cz + r; z++) {
        if (!this.overlaps(x, z, ox, oz, r)) this.getOrCreateChunkWatcher(x, z, true).addPlayer(player);
        if (!this.overlaps(x - mx, z - mz, cx, cz, r)) this.getOrCreateChunkWatcher(x - mx, z - mz, false)?.removePlayer(player);
      }
    this.filterChunkLoadQueue(player);
    player.managedPosX = player.posX;
    player.managedPosZ = player.posZ;
  }
  // isPlayerWatchingChunk: watched and already sent (no longer in the send queue).
  isPlayerWatchingChunk(player, x, z) {
    const inst = this.getOrCreateChunkWatcher(x, z, false);
    return !!inst && inst.players.includes(player) && !player.loadedChunks.some((c) => c.x === x && c.z === z);
  }
  // func_152622_a: view distance clamped to 3-20. Growing adds the player to the new square;
  // shrinking walks the old square and creates (loading its chunk) a watcher for every chunk outside
  // the new one before removing the player from it.
  setViewDistance(distance) {
    const v = Math.max(3, Math.min(20, distance | 0));
    if (v === this.playerViewRadius) return;
    const grow = v - this.playerViewRadius > 0, r = this.playerViewRadius;
    for (const player of this.players) {
      const cx = chunkOf(player.posX), cz = chunkOf(player.posZ);
      if (grow) {
        for (let x = cx - v; x <= cx + v; x++)
          for (let z = cz - v; z <= cz + v; z++) {
            const inst = this.getOrCreateChunkWatcher(x, z, true);
            if (!inst.players.includes(player)) inst.addPlayer(player);
          }
      } else {
        for (let x = cx - r; x <= cx + r; x++)
          for (let z = cz - r; z <= cz + r; z++) if (!this.overlaps(x, z, cx, cz, v)) this.getOrCreateChunkWatcher(x, z, true).removePlayer(player);
      }
    }
    this.playerViewRadius = v;
  }
}

// getFurthestViewableBlock
export const furthestViewableBlock = (distance) => distance * 16 - 16;

export const createChunkViewer = (posX, posZ) => ({ posX, posZ, managedPosX: posX, managedPosZ: posZ, loadedChunks: [] });
