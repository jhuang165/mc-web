// Batch 71 mpchunks: the dedicated server's per-player chunk columns follow the view distance (PlayerManager, EntityPlayerMP.onUpdate).
//
// Before: a join sent every column of the finite world (8 x 8) and the client ignored the welcome `viewDistance`; nothing was ever unloaded.
// Native (executed with tools/probes/ChunkViewProbe.java on the unchanged PlayerManager `mq`, PlayerInstance `mr`, S21 `gx`; reference in public/research/chunk-view-reference.json):
//   * addPlayer (mq.a(mw)): the player's chunk is trunc(posX) >> 4 (d2i, then an arithmetic shift: -0.5 is chunk 0, not -1). The square [-r, r]^2 around it (x outer, z inner) goes
//     into EntityPlayerMP.loadedChunks, then func_72691_b (mq.b(mw)) reorders what is pending into a square spiral from the player's chunk (below). r = PlayerManager radius =
//     clamp(view-distance, 3, 20) (`ServerRules.chunkRadius`). The managed position (mw.d / mw.e) is set to the player's position.
//   * updatePlayerInstances (mq.d(mw), called through ServerConfigurationManager.func_72358_d after a move; call site recalled): nothing happens until the player is at least 8 blocks
//     (dx^2 + dz^2 >= 64) from the managed position, and nothing again while the chunk is still the managed chunk (the managed position is NOT updated then). Otherwise, for each (x, z) of the
//     new square (x outer, z inner) that is outside the old square the chunk is added to loadedChunks, and the old cell (x - dChunkX, z - dChunkZ) that is outside the new square is removed:
//     removal sends S21 with ground-up true and mask 0 (an unload; even for a chunk never sent) and drops it from loadedChunks. Then the spiral reorder, then the managed position is set.
//   * the spiral (bytecode-read and executed): the player's own chunk first, then steps along (+1,0), (0,+1) twice 1, then (-1,0), (0,-1) twice 2, ... (k steps twice, directions in turn,
//     k = 1..2r), then 2r more steps in the next direction; a chunk of the old pending list is kept only when the walk reaches it (all do). Chunks already sent are not in the list.
//   * EntityPlayerMP.onUpdate (mw.h, bytecode-read): each tick walks loadedChunks in order and takes populated chunks while fewer than gz.c() = 5 are taken: one S26 bulk packet with up to
//     FIVE columns (the brief's 10 is a later version; executed: gz.c() returns 5), then S35 for each tile entity, then the entity tracker's spawn packets for the column.
// Here:
//   * the world is finite (8 x 8 columns), so a square cell outside it never exists: it is not queued (native leaves a missing chunk waiting; the effect is the same). View distance 8 and up
//     covers the whole world from anywhere, so only view-distance 3..7 changes anything.
//   * the welcome snapshot (and a `dimRespawn` snapshot) carries the player's first square at once instead of streaming it over ticks (the replica is built from the snapshot): found different.
//   * wire (all prefixed `chunk`): `chunkBulk` { columns: [{ x, z, runs }], tiles? } (S26 and the S35 that follow; x / z are LOCAL column coordinates) and `chunkUnload` { columns: [[x, z]] } (S21 empty).
//   * a world whose native origin is not a multiple of 16 (the legacy End window) is never limited: every column is sent in the snapshot and no view is kept.
import { encodeColumn } from './protocol.js';
import { describeTiles } from '../tile-sync.js';

export const CHUNK_BULK_MAX = 5; // gz.c()
export const CHUNK_MOVE_SQ = 64; // mq.d: less than 8 blocks from the managed position changes nothing
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const chunkOf = v => Math.trunc(v) >> 4; // d2i, then ishr 4
const inSquare = (x, z, cx, cz, r) => x - cx >= -r && x - cx <= r && z - cz >= -r && z - cz <= r; // mq.a(IIIII)

// One player's EntityPlayerMP.loadedChunks and managed position in one world. `exists(x, z)` tells whether a chunk (native coordinates) can ever be sent.
export class ChunkWatch {
  constructor(radius, x, z, exists = () => true, { sent = false } = {}) {
    this.radius = radius; this.exists = exists; this.queue = [];
    this.mx = x; this.mz = z; // mw.d / mw.e
    if (sent) return; // the chunks of the square were sent already (the snapshot)
    const cx = chunkOf(x), cz = chunkOf(z);
    for (let i = cx - radius; i <= cx + radius; i++) for (let j = cz - radius; j <= cz + radius; j++) if (exists(i, j)) this.queue.push([i, j]);
    this.reorder(x, z);
  }
  // mq.b(mw): the pending chunks again in spiral order from the player's managed chunk (it reads the player's current position, mw.s / mw.u).
  reorder(px, pz) {
    const old = new Set(this.queue.map(([x, z]) => `${x},${z}`)), cx = chunkOf(px), cz = chunkOf(pz), out = [], r = this.radius;
    const add = (x, z) => { if (old.has(`${x},${z}`)) out.push([x, z]); };
    add(cx, cz);
    let iter = 0, x = 0, z = 0;
    for (let k = 1; k <= r * 2; k++) for (let j = 0; j < 2; j++) {
      const d = DIRS[iter++ % 4];
      for (let m = 0; m < k; m++) { x += d[0]; z += d[1]; add(cx + x, cz + z); }
    }
    iter %= 4;
    for (let k = 0; k < r * 2; k++) { x += DIRS[iter][0]; z += DIRS[iter][1]; add(cx + x, cz + z); }
    this.queue = out;
  }
  // mq.d(mw) with the player now at (x, z) (native block coordinates). Returns the chunks to unload ([x, z], in S21 order).
  move(x, z) {
    const dx = this.mx - x, dz = this.mz - z;
    if (dx * dx + dz * dz < CHUNK_MOVE_SQ) return [];
    const ocx = chunkOf(this.mx), ocz = chunkOf(this.mz), cx = chunkOf(x), cz = chunkOf(z), r = this.radius, mx = cx - ocx, mz = cz - ocz;
    if (!mx && !mz) return [];
    const unload = [], gone = new Set();
    for (let i = cx - r; i <= cx + r; i++) for (let j = cz - r; j <= cz + r; j++) {
      if (!inSquare(i, j, ocx, ocz, r) && this.exists(i, j)) this.queue.push([i, j]); // PlayerInstance.addPlayer
      const oi = i - mx, oj = j - mz;
      if (!inSquare(oi, oj, cx, cz, r) && this.exists(oi, oj)) { unload.push([oi, oj]); gone.add(`${oi},${oj}`); } // PlayerInstance.removePlayer: S21 mask 0
    }
    if (gone.size) this.queue = this.queue.filter(([a, b]) => !gone.has(`${a},${b}`));
    this.reorder(x, z);
    this.mx = x; this.mz = z;
    return unload;
  }
  // EntityPlayerMP.onUpdate: up to CHUNK_BULK_MAX chunks from the front of the pending list (every existing chunk here is populated).
  take(max = CHUNK_BULK_MAX) { return this.queue.splice(0, max); }
}

// The simulation's side. `sim.chunkViews`; hooks: `columnsFor` in the two snapshots, `tick` once per tick after the players moved, `leave` in removePlayer.
export class ServerChunkViews {
  constructor(sim) { this.sim = sim; this.watches = new Map(); /* player id -> { world, watch } */ }
  get radius() { return this.sim.rules.chunkRadius; }
  worldOf(player) { return player.dimension ? this.sim.dimensions.state(player.dimension).world : this.sim.world; }
  storesOf(player) { return player.dimension ? this.sim.dimensions.state(player.dimension).tileEntities : this.sim.tileEntities; }
  // Native coordinates -> the local column of a world, or null when none lines up with the 16 grid.
  static limits(world) { const ox = world.originX ?? 0, oz = world.originZ ?? 0; return ox % 16 === 0 && oz % 16 === 0 ? { ox, oz } : null; }
  existsIn(world) {
    const { ox, oz } = ServerChunkViews.limits(world);
    return (x, z) => world.chunks.has(`${x - ox / 16},${z - oz / 16}`);
  }
  local(world, [x, z]) { const { ox, oz } = ServerChunkViews.limits(world); return [x - ox / 16, z - oz / 16]; }
  nativePos(world, p) { return [p.position.x + (world.originX ?? 0), p.position.z + (world.originZ ?? 0)]; }
  // A snapshot for a player: the first square (spiral order) of encoded columns, or every column for a world that cannot be limited. Resets the player's view.
  columnsFor(playerId, world) {
    const p = this.sim.players.get(playerId);
    if (!p || !ServerChunkViews.limits(world) || this.sim.rules.chunkView === false) { this.watches.delete(playerId); return [...world.chunks.values()].map(encodeColumn); }
    const [nx, nz] = this.nativePos(world, p), exists = this.existsIn(world), watch = new ChunkWatch(this.radius, nx, nz, exists);
    const first = watch.take(watch.queue.length); // the whole square is in the snapshot
    this.watches.set(playerId, { world, watch });
    return first.map(c => encodeColumn(world.chunks.get(this.local(world, c).join(','))));
  }
  leave(playerId) { this.watches.delete(playerId); }
  // After the players moved: per player (list order) updatePlayerInstances, then the onUpdate loop. Messages go to `player.chunkOut` (sent by server.js).
  tick() {
    for (const [id, p] of this.sim.players) {
      const world = this.worldOf(p);
      if (!ServerChunkViews.limits(world)) continue;
      let entry = this.watches.get(id);
      if (!entry || entry.world !== world) { // no snapshot went through here (a test, a dimension change): the client is taken to hold everything
        const [nx, nz] = this.nativePos(world, p);
        this.watches.set(id, entry = { world, watch: new ChunkWatch(this.radius, nx, nz, this.existsIn(world), { sent: true }) });
        continue;
      }
      const [nx, nz] = this.nativePos(world, p), out = [];
      const unload = entry.watch.move(nx, nz);
      if (unload.length) out.push({ type: 'chunkUnload', columns: unload.map(c => this.local(world, c)) });
      const taken = entry.watch.take();
      if (taken.length) {
        const locals = taken.map(c => this.local(world, c)), stores = this.storesOf(p), tiles = [];
        for (const [x, z] of locals) tiles.push(...describeTiles(stores, x, z, 0xffff));
        out.push({ type: 'chunkBulk', columns: locals.map(([x, z]) => encodeColumn(world.chunks.get(`${x},${z}`))), ...(tiles.length ? { tiles } : {}) });
      }
      if (out.length) (p.chunkOut ??= []).push(...out);
    }
  }
}
