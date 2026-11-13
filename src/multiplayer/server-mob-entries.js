// One tracker entry per mob for every watcher of the dedicated world (batch 61 mpmobtypes).
// Native EntityTracker holds ONE EntityTrackerEntry per entity (bytecode-read for the walk in batch 49, `trackeridle-b59` for the world loop): its `ticks` counter, its last sent
// position and motion, and its flags belong to the entity, not to a player, and `updatePlayerList` runs once per entity per tick; the entry keeps a set of the players tracking it
// and sends each packet to all of them (sendPacketToAllTrackingPlayers), the spawn packet to the one player that starts watching (tryStartWachingThis).
// Batches 59 and 60 gave every player an own MobTracker: each watcher's entries ticked their own phase (an entry made while a player was elsewhere sent its first update on that
// player's own count). `SharedEntry` is the TrackerEntry with a watcher set; `SharedMobTracker` is the MobTracker whose entries are SharedEntry and whose tick runs once.
import { MobTracker, TrackerEntry, PlayerWatch } from '../entity-tracker.js';

// A TrackerEntry whose `tracked` is "somebody tracks me" for the packets sent to everyone (send), and "this watcher tracks me" while `cur` is set (the range test of one player).
// `dest` maps each emitted packet to the watchers it goes to, decided when it was emitted (a watcher that joins later gets the spawn instead).
export class SharedEntry extends TrackerEntry {
  constructor(e, options, view, owner) {
    super(e, options, view);
    this.owner = owner; this.set = new Set(); this.cur = null; this.dest = new WeakMap();
  }
  get tracked() { return this.cur ? this.set.has(this.cur) : this.set.size > 0; }
  set tracked(v) { if (this.cur) { if (v) this.set.add(this.cur); else this.set.delete(this.cur); } }
  emit(packet) { super.emit(packet); this.dest.set(packet, this.cur ? [this.cur] : [...this.set]); }
  // EntityTrackerEntry.updatePlayerList: every player of the world, in list order (a flagged entry re-evaluates all of them).
  updatePlayerList() { for (const w of this.owner.watchers.values()) this.tryStartFor(w); }
  tryStartFor(w) {
    this.cur = w; this.view = w.view;
    try { TrackerEntry.prototype.tryStart.call(this); } finally { this.cur = null; }
  }
  // removeEntityFromAllTrackingPlayers: the destroy goes to each tracking watcher.
  remove() { for (const w of [...this.set]) { this.cur = w; try { super.remove(); } finally { this.cur = null; } } }
}

export class SharedMobTracker extends MobTracker {
  constructor(viewChunks = 10) {
    super(viewChunks);
    this.viewChunks = viewChunks;
    this.watchers = new Map(); // id -> { id, view, watch, flag, joining, pos }
    this.view.player = { shared: true }; // entryOf runs updatePlayerList for a new entry when a player exists; the real players are the watchers
  }
  flush() {} // the server half only: the packets leave through `queued()`
  create(e, size) {
    const made = super.create(e, size), o = made.entry;
    made.entry = new SharedEntry(e, { range: o.range, frequency: o.frequency, velocity: o.velocity, size: o.size }, this.view, this);
    return made;
  }
  // EntityTracker.addEntityToTracker for a player: it is sent every entry in range at the next tick, in set order. `pos()` is the player's position.
  addWatcher(id, pos) {
    const w = { id, pos, view: { player: null, watches: (cx, cz) => w.watch.watches(cx, cz), log: null }, watch: new PlayerWatch(this.viewChunks), flag: { initialised: false, x: 0, y: 0, z: 0 }, joining: true, flagged: false };
    this.watchers.set(id, w);
    return w;
  }
  removeWatcher(id) {
    const w = this.watchers.get(id);
    if (!w) return;
    this.watchers.delete(id);
    for (const en of this.entries.values()) en.entry.set.delete(w);
  }
  // EntityTracker.updateTrackedEntities once for the world: the removals, the joiners, the new entries, every entry's location once (one `ticks` for all watchers), then each
  // flagged player (moved more than 4 blocks) re-evaluates every entry in set order.
  serverStep(mobs, size) {
    this.tick++;
    this.sizeOf = size;
    for (const w of this.watchers.values()) {
      const p = w.pos();
      w.view.player = { x: p.x, y: p.y, z: p.z };
      w.watch.update(w.view.player);
    }
    const alive = new Set(mobs);
    for (const [e, en] of this.entries) if (!alive.has(e)) { en.entry.remove(); this.entries.delete(e); this.forget(e); this.dying.push(en); }
    for (const w of this.watchers.values()) if (w.joining) { w.joining = false; for (const e of this.walk()) this.entries.get(e).entry.tryStartFor(w); }
    for (const e of mobs) { const [width, height] = size(e); this.entryOf(e, width, height); }
    for (const e of this.walk()) this.stepEntry(e);
    for (const w of this.watchers.values()) {
      const p = w.view.player, g = w.flag, dx = p.x - g.x, dy = (p.y ?? 0) - g.y, dz = p.z - g.z;
      w.flagged = false;
      if (!g.initialised || dx * dx + dy * dy + dz * dz > 16) { g.x = p.x; g.y = p.y ?? 0; g.z = p.z; g.initialised = true; w.flagged = true; }
      if (w.flagged) for (const e of this.walk()) this.entries.get(e).entry.tryStartFor(w);
    }
  }
}
