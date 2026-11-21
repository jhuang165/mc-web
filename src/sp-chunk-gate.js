// Batch 94 spcopy94: the integrated server's sent-column gate for the entity trackers.
//
// Natively (executed in spcopy93 / chunk-view probes, bytecode-read mq/mr/mw/mn) EntityTrackerEntry.tryStartWachingThis needs PlayerManager.isPlayerWatchingChunk: the column was SENT to the player
// and not unloaded. Tracking an entity (at login, at a portal arrival, at a spawn) sends nothing for an unsent column; EntityPlayerMP.onUpdate sends the nearest five columns of loadedChunks
// per tick, spiral order from the player's chunk, and each sent column re-tests the entities in it (EntityTracker.func_85172_a). The dedicated server already does this (multiplayer/server-chunk-view.js);
// this class reuses its ChunkWatch (queue, spiral, move, five per tick) for the single-player trackers behind a narrow interface:
//   restart()                      the player joined this world (login, arrival, respawn): the next `step` queues the square again and forgets what was sent
//   step(x, z, radius)             one tick of PlayerManager.updatePlayerInstances + EntityPlayerMP.onUpdate for the player at (x, z) (block coordinates, native chunk = trunc >> 4)
//   sees(cx, cz)                   PlayerManager.isPlayerWatchingChunk; true while no view exists (nothing to gate)
//   takeFresh(who)                 true once per consumer ('mobs' | 'objects') after columns were sent or unloaded: the tracker re-lists its entries (func_85172_a)
// The world is infinite here: every column exists. An unload does not remove tracked entities (the tracking range ends them as before).
import { ChunkWatch, chunkOf } from './multiplayer/server-chunk-view.js';

export class SpChunkGate {
  constructor() { this.pending = false; this.watch = null; this.sent = new Set(); this.fresh = new Set(); this.lastSent = []; }
  restart() { this.watch = null; this.sent.clear(); this.fresh.clear(); this.lastSent = []; this.pending = true; } // until the first step nothing was sent
  step(x, z, radius) {
    this.lastSent = [];
    if (!this.watch) { this.watch = new ChunkWatch(radius, x, z); this.pending = false; this.sent.clear(); } // PlayerManager.addPlayer: the square is queued, nothing is sent yet
    else {
      this.watch.radius = radius;
      for (const [cx, cz] of this.watch.move(x, z)) { this.sent.delete(`${cx},${cz}`); this.mark(); }
    }
    const taken = this.watch.take(); // EntityPlayerMP.onUpdate: at most five columns
    for (const [cx, cz] of taken) this.sent.add(`${cx},${cz}`);
    if (taken.length) { this.lastSent = taken; this.mark(); }
    return taken;
  }
  mark() { this.fresh.add('mobs'); this.fresh.add('objects'); }
  sees(cx, cz) { return this.watch ? this.sent.has(`${cx},${cz}`) : !this.pending; }
  takeFresh(who) { return this.fresh.delete(who); }
}
export { chunkOf };

// Switch: the game (main.js) turns it on; the unit tests of the trackers keep every column of the square visible at once, as before.
export const spGateConfig = { enabled: false };
export const newMobTracker = (MobTracker, viewChunks) => { const t = new MobTracker(viewChunks); if (spGateConfig.enabled) t.setChunkGate(new SpChunkGate()); return t; };
