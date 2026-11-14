import { TrackerEntry } from '../entity-tracker.js';

// Batch 73 streamfix73: remote players are tracked per viewer on the dedicated server, as EntityTracker does for EntityPlayerMP.
// Bytecode-read (javap -c -p on `mn` = EntityTracker and `my` = EntityTrackerEntry, the unchanged 1.7.10 jar): `mn.a(sa)` for an `mw` (EntityPlayerMP) calls
// `a(entity, 512, 2)`, i.e. addEntityToTracker(player, 512, 2, false): range 512, update frequency 2, no velocity packets; `a(sa, int, int, boolean)` first
// clamps the range to the tracker limit `e` (view-distance * 16 - 16); then every existing entry gets `my.b(player)` (updatePlayerEntity), which returns at once
// for the entry of the player itself and otherwise runs the square test on lastScaledPosition / 32 plus isPlayerWatchingChunk (tryStartWachingThis). The entry
// code is the same TrackerEntry the other trackers use (executed: public/research/tracker-reference.json). One entry per (viewer, other player).
//
// Wire (no new message name): the tick's `players` rows are the presence list. A viewer gets the full row of himself and of every player he tracks; every other
// player is reduced to `{ id, name, far: true }`, which is only the S38 player-list entry (the tab list is global natively) and creates no entity on the client
// (`RemotePlayers.sync` skips far rows, so leaving the tracked set is the S13 destroy and entering it the S0C spawn).
// Deviations (honest): positions still go out every tick in the row, not at the entry's frequency 2 with S14/S18 packets, because the client player copy
// (`PlayerBody.tick`) is fed whole rows and has no packet interpolation; the entry's own cadence only decides membership. And a player whose column the viewer
// no longer holds is untracked at once (natively the entry keeps the entity until the range test fails; the client copy is dropped with the column anyway).
export const PLAYER_RANGE = 512, PLAYER_FREQUENCY = 2;
const everywhere = () => true;

export class ServerPlayerTracker {
  // `host`: { players: Map, rules } (the Simulation). `watches(pid, cx, cz)`: isPlayerWatchingChunk for viewer `pid` (the chunk view's `sees`). `fresh(pid)`: true once after the viewer's columns changed.
  constructor(host, watches = everywhere, fresh = () => false) { this.host = host; this.watches = watches; this.fresh = fresh; this.dims = new Map(); this.done = new WeakMap(); }
  get limit() { return this.host.rules?.trackerLimit ?? 144; }
  state(dim) { let s = this.dims.get(dim); if (!s) this.dims.set(dim, s = new Map()); return s; }

  // The tracker pass of one tick for dimension `dim` (once per `key`): pid -> Set of tracked player ids.
  update(dim, key) {
    if (this.done.has(key)) return this.done.get(key);
    const s = this.state(dim), here = new Map(), out = new Map();
    for (const [id, p] of this.host.players) if ((p.dimension | 0) === dim) here.set(id, p);
    for (const id of [...s.keys()]) if (!here.has(id)) s.delete(id); // left the dimension or the server: the client rebuilt its world
    for (const [vid, viewer] of here) {
      let v = s.get(vid);
      const pos = viewer.position;
      let moved = false;
      if (!v) { s.set(vid, v = { ref: { x: pos.x, y: pos.y, z: pos.z }, entries: new Map(), view: { player: pos, watches: (cx, cz) => this.watches(vid, cx, cz), log: null } }); moved = true; }
      else if (this.fresh(vid)) moved = true; // a column was sent or unloaded: PlayerManager calls the tracker for the chunk
      else { const dx = pos.x - v.ref.x, dy = pos.y - v.ref.y, dz = pos.z - v.ref.z; if (dx * dx + dy * dy + dz * dz > 16) { v.ref = { x: pos.x, y: pos.y, z: pos.z }; moved = true; } }
      v.view.player = pos;
      for (const id of [...v.entries.keys()]) if (!here.has(id)) v.entries.delete(id);
      const tracked = new Set();
      for (const [tid, target] of here) {
        if (tid === vid) continue; // my.b(player) returns for the player's own entry
        const e = { id: tid, x: target.position.x, y: target.position.y, z: target.position.z, rotationYaw: target.yaw ?? 0, rotationPitch: target.pitch ?? 0, type: 'player' };
        let en = v.entries.get(tid);
        if (!en) { v.entries.set(tid, en = new TrackerEntry(e, { range: PLAYER_RANGE, frequency: PLAYER_FREQUENCY, velocity: false, limit: this.limit }, v.view)); en.ticks = this.host.ticks ?? 0; }
        else { en.e = e; if (moved) en.tryStart(); }
        en.sendLocation(false, false); en.packets.length = 0; // membership only: the rows carry the positions
        if (en.tracked && !this.watches(vid, Math.floor(e.x / 16), Math.floor(e.z / 16))) { en.tracked = false; en.packets.length = 0; }
        if (en.tracked) tracked.add(tid);
      }
      out.set(vid, tracked);
    }
    this.done.set(key, out);
    return out;
  }

  // The rows of `message.players` as viewer `pid` gets them: himself and the tracked players in full, the rest as player-list entries.
  rowsFor(pid, rows, tracked) { return rows.map(r => r.id === pid || tracked?.has(r.id) ? r : { id: r.id, name: r.name, far: true }); }
  messageFor(pid, message, dim = 0, key = message) {
    if (!message?.players) return message;
    const tracked = this.update(dim, key).get(pid);
    if (!tracked) return message;
    return { ...message, players: this.rowsFor(pid, message.players, tracked) };
  }

  // The welcome snapshot: the same square test at the joining position (his columns are not sent yet, so a streaming join sees nobody until the first tick).
  snapshot(pid, world) {
    const me = this.host.players.get(pid);
    if (!me || !world?.players) return world;
    const range = Math.min(PLAYER_RANGE, this.limit);
    const near = r => Math.abs(r.x - me.position.x) <= range && Math.abs(r.z - me.position.z) <= range && this.watches(pid, Math.floor(r.x / 16), Math.floor(r.z / 16));
    return { ...world, players: world.players.map(r => r.id === pid || near(r) ? r : { id: r.id, name: r.name, far: true }) };
  }
}
