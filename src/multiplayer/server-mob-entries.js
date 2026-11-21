// One tracker entry per mob for every watcher of the dedicated world (batch 61 mpmobtypes).
// Native EntityTracker holds ONE EntityTrackerEntry per entity (bytecode-read for the walk in batch 49, `trackeridle-b59` for the world loop): its `ticks` counter, its last sent
// position and motion, and its flags belong to the entity, not to a player, and `updatePlayerList` runs once per entity per tick; the entry keeps a set of the players tracking it
// and sends each packet to all of them (sendPacketToAllTrackingPlayers), the spawn packet to the one player that starts watching (tryStartWachingThis).
// Batches 59 and 60 gave every player an own MobTracker: each watcher's entries ticked their own phase (an entry made while a player was elsewhere sent its first update on that
// player's own count). `SharedEntry` is the TrackerEntry with a watcher set; `SharedMobTracker` is the MobTracker whose entries are SharedEntry and whose tick runs once.
import { MobTracker, TrackerEntry, PlayerWatch, nextPacketSeq, stampPacketSeq, packetSeq, velocityInt } from '../entity-tracker.js';
import { watchedAttributes, firstDirty, rowKey } from '../mob-tracked-attributes.js'; // b89 mobpackets89
import { effectsInMapOrder } from '../mob-effects.js'; // b89 mobpackets89
import { fast85, fail85, SIZE_SCRATCH } from '../mpperf85-fast.js'; // b85 mpperf85
import { fast86, fail86 } from '../mpperf86-fast.js'; // b86 mpperf86
import { fast87, EntryStamps } from '../mpperf87-fast.js'; // b87 mpperf87
import { releaseWatcher88 } from '../mpperf88-fast.js'; // b88 mpperf88

// b88 track88: the watched values of an S0F (the spawn packet minus its own fields), the S1C after it repeats them.
const SPAWN_KEYS = new Set(['type', 'x', 'y', 'z', 'yaw', 'pitch', 'head', 'vx', 'vy', 'vz']);
const watchedOf = (spawn) => { const out = {}; for (const k in spawn) if (!SPAWN_KEYS.has(k)) out[k] = spawn[k]; return out; };
const stackCopy = (s) => JSON.parse(JSON.stringify(s));
const extraKey = (s) => { let o = null; for (const k in s) if (k !== 'id' && k !== 'count' && k !== 'damage') (o ??= {})[k] = s[k]; return o ? JSON.stringify(o) : ''; };
// ItemStack.areItemStacksEqual (add.b): both null, or the same size, item, damage and tag
const sameStack = (a, b) => a === b || (!!a && !!b && a.id === b.id && (a.count ?? 1) === (b.count ?? 1) && (a.damage ?? 0) === (b.damage ?? 0) && extraKey(a) === extraKey(b));
// b89 mobpackets89: a mob's fields at one moment (the equipment slots and the effects copied: the entity pass replaces stacks and counts effect durations down in place).
const snapOf = (e) => ({ ...e, ...(e.equipment ? { equipment: e.equipment.slice() } : {}), ...(e.effects ? { effects: e.effects.map((x) => ({ ...x })) } : {}) });
// b89 mobpackets89: S1D (in(int, rw), bytecode-read): the effect id and the amplifier as bytes (& 255, read back signed), the duration clamped to 32767 as a short.
const sbyte = (v) => ((v & 255) << 24) >> 24;
export const effectPacket = (x) => ({ type: 'effect', effect: sbyte(x.id), amplifier: sbyte(x.amplifier | 0), duration: (Math.min(x.duration | 0, 32767) << 16) >> 16 });

// A TrackerEntry whose `tracked` is "somebody tracks me" for the packets sent to everyone (send), and "this watcher tracks me" while `cur` is set (the range test of one player).
// `dest` maps each emitted packet to the watchers it goes to, decided when it was emitted (a watcher that joins later gets the spawn instead).
export class SharedEntry extends TrackerEntry {
  constructor(e, options, view, owner) {
    super(e, options, view);
    this.owner = owner; this.set = new Set(); this.cur = null; this.dest = new WeakMap();
    this.stamps = null; // b87 mpperf87: EntryStamps (the sequence number and destinations of each packet) once the entry emits with the flag on
    this.held = null; // b88 track88: the packets startPackets emits, put back in my.b's order (startPackets below)
    this.gear = null; // b88 track88: EntityLivingBase.g, the equipment the last check saw (SharedMobTracker.create sets it: the port's entry follows the mob's first update)
    this.pre = null; // b88 track88: the state before this tick's entity pass, for a watcher whose slot comes before this entity (SharedMobTracker.beforePass)
    this.birth = null; // b89 mobpackets89: the mob's state at its spawn while the entry is being made (SharedMobTracker.create / entryOf)
    this.bumps = {}; // b90 mobpackets90: e.attrBumps as the last gated pass saw it
    this.attrKeys = null; // b89 mobpackets89: the watched attribute rows the last pass saw (name -> rowKey); null before the first pass
  }
  // b87 mpperf87: the stamp and destinations of one of this entry's packets (the WeakMaps when it emitted with the flag off).
  seqOf(p) { const s = this.stamps; return s !== null && s.at(p) >= 0 ? s.seqOf(p) : packetSeq(p); }
  destOf(p) { const s = this.stamps, k = s === null ? -1 : s.at(p); return k >= 0 ? s.dest[k] : this.dest.get(p); }
  get tracked() { return this.cur ? this.set.has(this.cur) : this.set.size > 0; }
  set tracked(v) { if (this.cur) { if (v) this.set.add(this.cur); else this.set.delete(this.cur); } }
  emit(packet) {
    if (this.held !== null) { this.held.push(packet); return; } // b88 track88
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
  // b89 mobpackets89: the try of addEntityToTracker (the entry made at the spawn) uses the spawn state; a player arriving in this server tick is not in the world yet natively (it is
  // tried after, at its own slot: serverStep's look loop).
  updatePlayerList() {
    const b = this.birth;
    for (const w of this.owner.watchers.values()) if (b === null) this.tryStartFor(w); else if (!w.late89) this.tryStartWith(w, b);
  }
  tryStartFor(w) {
    this.cur = w; this.view = w.view;
    try { TrackerEntry.prototype.tryStart.call(this); } finally { this.cur = null; }
  }
  // b88 track88: tryStartWachingThis with the entity's fields as `e` holds them (the copy made before the entity pass: the entity has not updated yet at the player's slot).
  tryStartWith(w, e) { const live = this.e; this.e = e; try { this.tryStartFor(w); } finally { this.e = live; } }
  // b88 track88: EntityTrackerEntry.tryStartWachingThis (my.b(mw), bytecode-read) sends, after the spawn (my.c): S1C with the whole data watcher (`hw(id, dw, true)` whenever the watcher is not
  // blank, every living entity), S20 the watched attributes, S12 only when the spawn is not an S0F, S1B(0) the vehicle, S1B(1) the leash holder, S04 for each of the five equipment slots
  // that holds a stack, then S1D for each active effect. TrackerEntry.startPackets emits the spawn, the bat's S1C and the two S1B; here the S1C carries every watched value the port models
  // and the S04 follow the S1B.
  // b89 mobpackets89: S20 `il(id, tq.c())` after the S1C, every watched attribute (mob-tracked-attributes.js), and S1D `in(id, rw)` after the S04, one per sv.aQ() effect in the
  // HashMap's order (mob-effects.js effectsInMapOrder). The S1D are the only effect packets a mob's watchers get: EntityLivingBase.onNewPotionEffect / onChangedPotionEffect /
  // onFinishedPotionEffect (sv.a(rw), sv.a(rw, Z), sv.b(rw)) only flag potionsNeedUpdate and move the attribute modifiers; EntityPlayerMP alone overrides them with S1D / S1E to its
  // own connection. The colour and the invisible flag still reach the copy as watched values (copy-meta.js); a modifier change goes out as S20 at the next gated pass.
  startPackets() {
    if (this.object) { super.startPackets(); return; }
    const held = this.held = [];
    try { super.startPackets(); } finally { this.held = null; }
    const e = this.e, [spawn, ...rest] = held, meta = rest.length && rest[0].type === 'meta' ? rest.shift() : null;
    this.emit(spawn);
    this.emit({ type: 'meta', ...watchedOf(spawn), ...(meta ? meta : {}), type: 'meta' });
    const attrs = watchedAttributes(e); // b89 mobpackets89
    if (attrs.length) this.emit({ type: 'attributes', list: attrs });
    for (const p of rest) this.emit(p);
    const g = e.equipment;
    if (g) for (let i = 0; i < 5; i++) if (g[i]) this.emit({ type: 'equipment', slot: i, item: stackCopy(g[i]) });
    if (e.effects?.length) for (const x of effectsInMapOrder(e)) this.emit(effectPacket(x)); // b89 mobpackets89
  }
  // b89 mobpackets89: EntityTrackerEntry.sendLocationToAllClients with func_111190_b (my.b(), bytecode-read): inside the gated branch (ticks % frequency, isAirBorne or a changed data
  // watcher), after the position packets, the S1C and then S20 of the dirty attribute set go to the tracking players and the set is cleared, whether anyone tracks or not. The port
  // has no attribute map: a row is dirty when its base, modifiers or value changed since the last gated pass (the first pass sends what the construction left, firstDirty). The
  // head S19 follows S1C / S20 (b90: entity-tracker.js holds it until this hook has run), and the S12 of velocityChanged comes after all three.
  sendAttributes() {
    if (this.object) return;
    const rows = watchedAttributes(this.e);
    if (!rows.length) return;
    let keys = this.attrKeys, out;
    if (keys === null) { out = firstDirty(this.e, rows); for (const r of rows) this.bumps[r.name] = this.e.attrBumps?.[r.name] ?? 0; keys = this.attrKeys = new Map(); for (const r of rows) keys.set(r.name, rowKey(r)); }
    else { out = null; for (const r of rows) { const k = rowKey(r), bump = this.e.attrBumps?.[r.name] ?? 0; if (keys.get(r.name) !== k || bump !== (this.bumps[r.name] ?? 0)) { keys.set(r.name, k); (out ??= []).push(r); } this.bumps[r.name] = bump; } }
    if (out !== null && out.length) this.send({ type: 'attributes', list: out });
  }
  // b88 track88: EntityLivingBase.onUpdate (sv.h 65..178, bytecode-read), at the start of each server update: every slot whose stack is not ItemStack.areItemStacksEqual (add.b) to the
  // one last seen goes out as S04 to the players tracking the entity (EntityTracker.func_151247_a, mn.a(sa, ft): not to the entity), and the copy is kept (add.m).
  checkGear() {
    const g = this.e.equipment;
    if (!g && !this.gear) return;
    const last = this.gear ??= [null, null, null, null, null];
    for (let i = 0; i < 5; i++) {
      const cur = g?.[i] ?? null;
      if (sameStack(cur, last[i])) continue;
      this.send({ type: 'equipment', slot: i, item: cur ? stackCopy(cur) : null });
      last[i] = cur ? stackCopy(cur) : null;
    }
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
    this.seq = 0; // b88 track88: join order of entries and watchers (World.loadedEntityList order)
    this.pres = []; // b88 track88: the entries holding a `pre` copy this tick
    this.births = new WeakMap(); // b89 mobpackets89: mob -> { s: its state when beforePass first saw it without an entry, t: the tick }
    this.birthList = null; // b89 mobpackets89: () => the world's mob list (ServerMobs sets it)
  }
  flush() {} // the server half only: the packets leave through `queued()`
  // b89 mobpackets89: World.spawnEntityInWorld -> onEntityAdded -> EntityTracker.addEntityToTracker makes the entry at the spawn, before the mob's first update (bytecode-read:
  // ahb.d(sa) appends to loadedEntityList and calls the world access's onEntityCreate, mn.a(sa) -> new my(...) and updatePlayerList). The port makes it in the tracker pass after the
  // entity pass, so a mob spawned before the pass (natural spawning, an egg, a dispenser, a spawner of the last tick) has updated already: its entry takes the state beforePass copied
  // (`births`) as its baseline (my.<init>: the last sent position, angles, health ...) and the S0F of the players in range, so this pass sends the first update's move as a delta.
  // A mob spawned during the pass has not updated yet in the port, so its live state is the spawn state. The equipment check (sv.h) of the first update sends every held slot again
  // (EntityLivingBase.g starts empty): right after the spawn try for a mob that has updated (entryOf), at the next beforePass for one that has not.
  create(e, size) {
    const b = this.births.get(e);
    if (b !== undefined) this.births.delete(e);
    const born = b !== undefined && b.t === this.tick - 1 ? b.s : null; // copied in this server tick's beforePass (serverStep has counted the tick since)
    const from = born ?? e, made = super.create(from, size), o = made.entry;
    made.entry = new SharedEntry(from, { range: o.range, limit: this.limit, frequency: o.frequency, velocity: o.velocity, size: o.size }, this.view, this);
    made.entry.e = e;
    made.entry.birth = born;
    made.seq = ++this.seq; // b88 track88
    return made;
  }
  entryOf(e, size, height, hold = false) {
    const had = this.entries.get(e);
    if (had !== undefined) return had;
    const en = super.entryOf(e, size, height, hold), entry = en.entry, born = entry.birth;
    if (born !== null) { entry.birth = null; entry.e = born; try { if (born.equipment) entry.checkGear(); } finally { entry.e = e; } } // b89 mobpackets89: the first update's equipment check
    return en;
  }
  // EntityTracker.addEntityToTracker for a player: it is sent every entry in range at the next tick, in set order. `pos()` is the player's position.
  addWatcher(id, pos) {
    const w = { id, pos, view: { player: null, watches: (cx, cz) => w.watch.watches(cx, cz), log: null }, watch: new PlayerWatch(this.viewChunks), flag: { initialised: false, x: 0, y: 0, z: 0 }, joining: true, flagged: false, seq: ++this.seq };
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
  // b88 track88: before the world's entity pass (ServerMobs.tick, before EntityWorld.tick). EntityLivingBase.onUpdate's equipment check runs at the start of each update, so a change
  // goes out before the tracker pass (an item picked up in onLivingUpdate goes out at the next update). And for a watcher whose columns go out this tick (`peek`: they were queued
  // by ServerChunkViews.tick, before this) or who arrives now, an entity AFTER the player in loadedEntityList has not updated yet at the player's slot (EntityPlayerMP.onUpdate, mw.h, tries
  // the entities of each chunk it sends, mn.a(mw, apx)): its fields are copied here, before the pass, and the S0F is built from the copy.
  beforePass() {
    const list = this.birthList?.(); // b89 mobpackets89: the spawn state of each mob without an entry (create)
    if (list) for (let i = 0; i < list.length; i++) { const e = list[i]; if (!this.entries.has(e) && !this.births.has(e)) this.births.set(e, { s: snapOf(e), t: this.tick }); }
    let look = null;
    for (const w of this.watchers.values()) if (w.joining || w.peek?.()) (look ??= []).push(w);
    for (const en of this.entries.values()) {
      const entry = en.entry;
      if (entry.e.equipment || entry.gear) entry.checkGear();
      if (look === null) continue;
      for (let k = 0; k < look.length; k++) if (en.seq > look[k].seq && !entry.set.has(look[k])) { entry.pre = snapOf(entry.e); /* b89 mobpackets89: the effects copied too (S1D) */ this.pres.push(entry); break; }
    }
  }
  // EntityTracker.updateTrackedEntities once for the world: the removals, the joiners, the new entries, every entry's location once (one `ticks` for all watchers), then each
  // flagged player (moved more than 4 blocks) re-evaluates every entry in set order.
  // b88 track88: a watcher who arrives (joining) or whose columns went out this tick (`fresh`) is tried at its slot of World.updateEntities, before this pass (EntityPlayerMP.onUpdate,
  // mw.h -> mn.a(mw, apx) -> my.b(mw), bytecode-read): an entry older than the watcher has updated already, so its S0F is this tick's state; a newer one has not, so its S0F is the copy
  // beforePass made (without one, it is tried after the pass, as before). Both then get this pass's packets: the location packets are deltas from the one shared baseline, so the
  // watcher's copy takes the move twice (the native double delta). Batch 61 to 87 tried a fresh watcher only after the pass (re-testing every entry), so the copy had no second move.
  // A watcher added during this same server tick (`sameTick`: the port's portal arrival comes after the Overworld's tick and before the Nether's and the End's) natively arrives in the
  // network tick after every world's pass (oi.a(mw, int), bytecode-read in batch 87), so the entities spawned in this pass come before it in the list: it takes its place after them.
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
    let look = null, late = null; // b88 track88
    for (const w of this.watchers.values()) {
      const fresh = !!w.fresh?.(); // b72 mpstream72: columns sent / unloaded this tick
      if (w.joining || fresh) (look ??= []).push(w);
      if (w.joining && w.sameTick?.()) { (late ??= []).push(w); w.late89 = true; } // b89 mobpackets89: not tried by the spawn try of this pass's new entries
      w.joining = false;
    }
    if (!fast) for (const e of mobs) { const [width, height] = size(e); this.entryOf(e, width, height); }
    else for (let i = 0; i < mobs.length; i++) { // b85 mpperf85: an existing entry needs no size (entryOf only reads it for a new entry)
      const e = mobs[i];
      if (this.entries.has(e)) continue;
      if (size.into) { size.into(e, SIZE_SCRATCH); this.entryOf(e, SIZE_SCRATCH[0], SIZE_SCRATCH[1]); } else { const [width, height] = size(e); this.entryOf(e, width, height); }
    }
    if (late !== null) for (const w of late) { w.seq = ++this.seq; w.late89 = false; } // b88 track88: after this pass's new entries
    const order = this.walk(); // b86 mpperf86: the one walk list of this pass (stepEntry and tryStartFor add or remove no entry)
    let after = null; // b88 track88: [entry, watcher] tried after the pass (a newer entry without a copy)
    if (look !== null) for (const e of order) {
      const en = this.entries.get(e), entry = en.entry;
      for (const w of look) {
        if (entry.set.has(w)) continue;
        if (en.seq < w.seq) entry.tryStartFor(w); else if (entry.pre !== null) entry.tryStartWith(w, entry.pre); else (after ??= []).push(entry, w);
      }
    }
    for (const entry of this.pres) entry.pre = null;
    this.pres.length = 0;
    for (const e of order) this.stepEntry(e);
    if (after !== null) for (let k = 0; k < after.length; k += 2) after[k].tryStartFor(after[k + 1]);
    for (const w of this.watchers.values()) {
      const p = w.view.player, g = w.flag, dx = p.x - g.x, dy = (p.y ?? 0) - g.y, dz = p.z - g.z;
      w.flagged = false;
      if (!g.initialised || dx * dx + dy * dy + dz * dz > 16) { g.x = p.x; g.y = p.y ?? 0; g.z = p.z; g.initialised = true; w.flagged = true; }
      if (!w.flagged) continue;
      const list = m86 === 'off' ? this.walk() : order;
      if (m86 === 'verify') { const r = this.walk(); if (r.length !== list.length || r.some((e, k) => e !== list[k])) fail86('flagged walk'); }
      for (const e of list) this.entries.get(e).entry.tryStartFor(w);
    }
  }
}
