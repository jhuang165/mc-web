// Batch 82 mpcmd82: an optional model of which server Overworld chunks native 1.7.10 keeps loaded, for scheduled block ticks only (DedicatedSimulation option `residency: true`;
// off by default, where every column of the finite window ticks as before).
//
// Native (chunk-provider-reference.json, executed replay of ChunkProviderServer / PlayerManager / PlayerInstance; WorldServer.tickUpdates bytecode-read b0 = 0):
//   * a chunk leaves memory only through the unload queue. PlayerInstance.removePlayer (the last watcher left) and WorldServer.saveAllChunks (every autosave, for loaded chunks nobody
//     watches) call ChunkProviderServer.unloadChunksIfNotNearSpawn: in a dimension players respawn in, a chunk whose centre (x * 16 + 8, z * 16 + 8) is within 128 blocks of the
//     WorldInfo spawn on both axes is never queued. unloadQueuedChunks drains the queue (100 per tick) at the start of the next WorldServer.tick, before tickUpdates.
//   * WorldServer.tickUpdates runs a due entry only when its own chunk is loaded; the entry of an unloaded chunk was saved with the chunk (TileTicks, its delay kept) and runs again after a reload.
//   * PlayerManager watches the square of radius view-distance (3..20) around each player's MANAGED chunk (moved only after 8 blocks, server-chunk-view.js ChunkWatch).
// So a column here is resident when its centre is within 128 blocks of the spawn, or it lies in some Overworld player's watched square. Consequences for the port's 128 x 128 window:
// with the spawn anywhere inside the window every chunk centre (8..120) is within 128 of it, so nothing ever unloads natively and this model changes nothing. Only a spawn moved by
// /setworldspawn at least 9 blocks outside the window (or a small view distance with such a spawn) leaves columns that native would unload once no player watches them.
// Not modelled (documented in the b82 note): chunks loaded on demand (World.getBlock / setBlock through provideChunk load an unloaded chunk; redstone, block events and pistons reaching into
// one), the startup load of the 25 x 25 spawn chunks beyond 128 (they linger until the first autosave queues them), the autosave queue itself (900 ticks), and the frozen delay: here a due
// redstone entry runs on the first tick its column is resident again (LiveRedstone.deferred), while fluid, fire and falling entries keep their delay (pauseUnloadedTicks bumps their time).
// Tile entities (hoppers, furnaces, beacons), entities and random ticks are not gated by this model (random ticks already follow the players' chunks, server-chunks.js).
export const SPAWN_KEEP = 128; // ChunkProviderServer.unloadChunksIfNotNearSpawn: short 128

// The WorldInfo spawn in local coordinates: /setworldspawn, else a native world's own spawn, else the port's spawn placement (deterministic for a finite world).
export function worldInfoSpawn(sim) {
  if (sim.worldSpawn) return sim.worldSpawn;
  const w = sim.world;
  if (w.nativeSpawn) return [w.nativeSpawn[0] - (w.originX ?? 0), w.nativeSpawn[1], w.nativeSpawn[2] - (w.originZ ?? 0)];
  if (!sim.residencySpawn) { const at = w.spawn(); sim.residencySpawn = [Math.floor(at.x), Math.floor(at.y), Math.floor(at.z)]; }
  return sim.residencySpawn;
}

// unloadChunksIfNotNearSpawn's test for local column (cx, cz); the local grid lines up with the native one when the origin is a multiple of 16 (the Overworld).
export function spawnKeeps(spawn, cx, cz) {
  const dx = cx * 16 + 8 - spawn[0], dz = cz * 16 + 8 - spawn[2];
  return !(dx < -SPAWN_KEEP || dx > SPAWN_KEEP || dz < -SPAWN_KEEP || dz > SPAWN_KEEP);
}

// The resident local columns of the Overworld this tick, as "cx,cz" keys.
export function residentColumns(sim) {
  const world = sim.world, ox = world.originX ?? 0, oz = world.originZ ?? 0, spawn = worldInfoSpawn(sim), out = new Set();
  const n = Math.ceil((world.size ?? 128) / 16), r = sim.rules?.chunkRadius ?? 10;
  const squares = [];
  for (const [id, p] of sim.players) {
    if ((p.dimension | 0) !== 0) continue;
    const watch = sim.chunkViews?.watches?.get(id);
    const nx = watch && watch.world === world ? watch.watch.mx : p.position.x + ox, nz = watch && watch.world === world ? watch.watch.mz : p.position.z + oz; // the managed position (native)
    squares.push([(Math.trunc(nx) >> 4) - ox / 16, (Math.trunc(nz) >> 4) - oz / 16, watch && watch.world === world ? watch.watch.radius : r]);
  }
  for (let cx = 0; cx < n; cx++) for (let cz = 0; cz < n; cz++)
    if (spawnKeeps(spawn, cx, cz) || squares.some(([sx, sz, sr]) => Math.abs(cx - sx) <= sr && Math.abs(cz - sz) <= sr)) out.add(`${cx},${cz}`);
  return out;
}

// Installs World.tickResident(x, z) on the Overworld: redstone (LiveRedstone.tickable), fluids and fire (pauseUnloadedTicks) and falling blocks (ringTickActive) read it.
// The set is rebuilt once per simulation tick (`sim.ticks`).
export function installResidency(sim) {
  let at = null, set = null;
  sim.world.tickResident = (x, z) => {
    if (at !== sim.ticks || !set) { at = sim.ticks; set = residentColumns(sim); }
    return set.has(`${x >> 4},${z >> 4}`);
  };
  return sim.world.tickResident;
}
