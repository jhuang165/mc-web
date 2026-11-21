// One tracker entry per mob for every watcher of the dedicated world (batch 61 mpmobtypes).
// Native EntityTracker holds ONE EntityTrackerEntry per entity (bytecode-read for the walk in batch 49, `trackeridle-b59` for the world loop): its `ticks` counter, its last sent
// position and motion, and its flags belong to the entity, not to a player, and `updatePlayerList` runs once per entity per tick; the entry keeps a set of the players tracking it
// and sends each packet to all of them (sendPacketToAllTrackingPlayers), the spawn packet to the one player that starts watching (tryStartWachingThis).
// Batches 59 and 60 gave every player an own MobTracker: each watcher's entries ticked their own phase (an entry made while a player was elsewhere sent its first update on that
// player's own count). `SharedEntry` is the TrackerEntry with a watcher set; `SharedMobTracker` is the MobTracker whose entries are SharedEntry and whose tick runs once.
import { MobTracker, TrackerEntry, PlayerWatch, nextPacketSeq, stampPacketSeq, packetSeq } from '../entity-tracker.js';
import { fast85, fail85, SIZE_SCRATCH } from '../mpperf85-fast.js'; // b85 mpperf85
import { fast86, fail86 } from '../mpperf86-fast.js'; // b86 mpperf86
import { fast87, EntryStamps } from '../mpperf87-fast.js'; // b87 mpperf87
import { releaseWatcher88 } from '../mpperf88-fast.js'; // b88 mpperf88

// A TrackerEntry whose `tracked` is "somebody tracks me" for the packets sent to everyone (send), and "this watcher tracks me" while `cur` is set (the range test of one player).
// `dest` maps each emitted packet to the watchers it goes to, decided when it was emitted (a watcher that joins later gets the spawn instead).
export class SharedEntry extends TrackerEntry {
  constructor(e, options, view, owner) {
    super(e, options, view);
    this.owner = owner; this.set = new Set(); this.cur = null; this.dest = new WeakMap();
    this.stamps = null; // b87 mpperf87: EntryStamps (the sequence number and destinations of each packet) once the entry emits with the flag on
  }
  // b87 mpperf87: the stamp and destinations of one of this entry's packets (the WeakMaps when it emitted with the flag off).
  seqOf(p) { const s = this.stamps; return s !== null && s.at(p) >= 0 ? s.seqOf(p) : packetSeq(p); }
  destOf(p) { const s = this.stamps, k = s === null ? -1 : s.at(p); return k >= 0 ? s.dest[k] : this.dest.get(p); }
  get tracked() { return this.cur ? this.set.has(this.cur) : this.set.size > 0; }
  set tracked(v) { if (this.cur) { if (v) this.set.add(this.cur); else this.set.delete(this.cur); } }
  emit(packet) {
    if (fast87.mode !== 'off' && fast85.mode !== 'off') { this.emit87(packet); return; }
    super.emit(packet);
    if (fast85.mode === 'off') { this.dest.set(packet, this.cur ? [this.cur] : [...this.set]); return; }
    // b85 mpperf85: one shared (never written) destination array while the watcher set is what it was
    const d = this.cur ? (this.cur.solo ??= [this.cur]) : this.destinations();
    if (fast85.mode === 'verify') { const r = this.cur ? [this.cur] : [...this.set]; if (r.length !== d.length || r.some((w, i) => w !== d[i])) fail85('emit dest'); }
    this.dest.set(packet, d);
  }
  // b87 mpperf87: TrackerEntry.emit with the stamp and destinations kept in EntryStamps beside `packets` (no WeakMap write per packet); verify also writes the
  // WeakMaps and track() compares the two.
  emit87(packet) {
    const s = nextPacketSeq(), d = this.cur ? (this.cur.solo ??= [this.cur]) : this.destinations();
    if (fast85.mode === 'verify') { const r = this.cur ? [this.cur] : [...this.set]; if (r.length !== d.length || r.some((w, i) => w !== d[i])) fail85('emit dest'); }
    this.packets.push(packet);
    (this.stamps ??= new EntryStamps()).put(this.packets, packet, s, d);
    if (fast87.mode === 'verify') { stampPacketSeq(packet, s); this.dest.set(packet, d); }
    this.view.log?.(packet);
  }
  destinations() {
    const s = this.snap, set = this.set;
    if (s !== undefined && s.length === set.size) { let i = 0; for (const w of set) if (s[i++] !== w) { i = -1; break; } if (i >= 0) return s; }
    return (this.snap = [...set]);
  }
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
    made.entry = new SharedEntry(e, { range: o.range, limit: this.limit, frequency: o.frequency, velocity: o.velocity, size: o.size }, this.view, this);
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
    releaseWatcher88(this.entries, w); // b88 mpperf88: the stale stamp slots (and a destination snapshot) naming the watcher are cleared
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
    const fast = fast85.mode !== 'off', tick = this.tick;
    let alive = null;
    if (fast) { for (let i = 0; i < mobs.length; i++) { const en = this.entries.get(mobs[i]); if (en !== undefined) en.seen85 = tick; } } // b85 mpperf85: a stamp, not a Set of every mob
    if (!fast || fast85.mode === 'verify') alive = new Set(mobs);
    const sweep = (en, e) => {
      const dead = fast ? en.seen85 !== tick : !alive.has(e);
      if (fast && alive && alive.has(e) === dead) fail85('alive');
      if (dead) { en.entry.remove(); this.entries.delete(e); this.forget(e); this.dying.push(en); }
    };
    const m86 = fast86.mode;
    if (m86 === 'off') for (const [e, en] of this.entries) sweep(en, e);
    else this.entries.forEach(sweep); // b86 mpperf86: no [key, value] pair per entry (forEach visits in the same order and skips the deleted ones alike)
    for (const w of this.watchers.values()) if (w.joining) { w.joining = false; for (const e of this.walk()) this.entries.get(e).entry.tryStartFor(w); }
    if (!fast) for (const e of mobs) { const [width, height] = size(e); this.entryOf(e, width, height); }
    else for (let i = 0; i < mobs.length; i++) { // b85 mpperf85: an existing entry needs no size (entryOf only reads it for a new entry)
      const e = mobs[i];
      if (this.entries.has(e)) continue;
      if (size.into) { size.into(e, SIZE_SCRATCH); this.entryOf(e, SIZE_SCRATCH[0], SIZE_SCRATCH[1]); } else { const [width, height] = size(e); this.entryOf(e, width, height); }
    }
    const order = this.walk(); // b86 mpperf86: the one walk list of this pass (stepEntry and tryStartFor add or remove no entry)
    for (const e of order) this.stepEntry(e);
    for (const w of this.watchers.values()) {
      const p = w.view.player, g = w.flag, dx = p.x - g.x, dy = (p.y ?? 0) - g.y, dz = p.z - g.z;
      w.flagged = false;
      if (w.fresh?.()) g.initialised = false; // b72 mpstream72: columns sent / unloaded this tick: re-evaluate every entry
      if (!g.initialised || dx * dx + dy * dy + dz * dz > 16) { g.x = p.x; g.y = p.y ?? 0; g.z = p.z; g.initialised = true; w.flagged = true; }
      if (!w.flagged) continue;
      const list = m86 === 'off' ? this.walk() : order;
      if (m86 === 'verify') { const r = this.walk(); if (r.length !== list.length || r.some((e, k) => e !== list[k])) fail86('flagged walk'); }
      for (const e of list) this.entries.get(e).entry.tryStartFor(w);
    }
  }
}
