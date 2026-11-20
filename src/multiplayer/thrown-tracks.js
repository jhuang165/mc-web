// Batch 84 mpthrown84: tracker cadence for thrown entities on the dedicated server (the model batch 81 used for fireballs, fireball-copy.js, and batch 72 for items, server-object-tracker.js).
//
// Bytecode-read (javap -c -p, 1.7.10 jar):
//   * EntityTracker.addEntityToTracker (mn.a(sa)): EntityArrow (zc) 64/20/false; EntitySnowball (zj), EntityEgg (zl), EntityEnderPearl (zm), EntityPotion (zo) and EntityExpBottle (zn)
//     64/10/TRUE (batch 83's "balls 64/10/false" was the fireballs' line); EntityEnderEye (zd) 64/4/true; EntityFireworkRocket (zf) 64/10/true; EntityFishHook (xe) 64/5/true.
//   * EntityTrackerEntry.func_151260_c (my.c): S0E type and data: arrow 60 with the shooter's id (its own id with no shooter), snowball 61 / egg 62 / pearl 65 / eye 72 / rocket 76 with
//     data 0, potion 73 with the potion damage (zo.k()), exp bottle 75 with 0, hook 90 with the angler's id. fw(sa, int, int) carries the motion only when data > 0 (arrows).
//   * NetHandlerPlayClient.handleSpawnObject (bjb.a(fw)): builds the client class from the packet position; for 73, 75, 90 it zeroes the data (no motion from the S0E, the S12 after it
//     sets it); an arrow keeps data > 0, so its S0E motion is read (setVelocity).
//   * Minecraft.runTick (bao): WorldClient.updateEntities runs before NetworkManager.processReceivedPackets, so a copy updates first, then takes the message's packets (thrown-copy.js).
// The entry and the client copy are object-tracker.js's ObjectEntry / ObjectClient (executed against the unchanged classes: tracker-items-reference.json, tracker-hits-reference.json,
// tracker-extras-reference.json).
// Wire: `dispEnts` messages carry `trk: [{ i, k, p: [packets] }]` (k an OBJECT_KINDS key) and are sent each tick while the player tracks anything, so every copy updates once per tick.
// Every S13 goes out one tick later (EntityPlayerMP.func_152339_d queues it in destroyedItemsNetCache, flushed by the player's next onUpdate), so the copy takes two more updates.
//
// b86 lanes86: ONE shared entry per entity, as native EntityTracker holds one EntityTrackerEntry per entity with the set of players tracking it (batch 84 kept one per (player, entity),
// so a viewer who arrived late, or came back from another dimension, started its own baseline, or got nothing at all). Bytecode-read:
//   * mn.a(sa, int, int, boolean) (addEntityToTracker) 37..85: `new my(...)`, then my.b(world.playerEntities) (sendEventsToPlayers -> tryStartWachingThis for every player): the players
//     in range when the entity joins get the S0E at once, built from the JOIN state (the state `birth` copied before the entity pass). Batch 85's note had the S0E at the flush state.
//   * my.b(mw) (tryStartWachingThis): the range test on the shared lastScaled / 32; the S0E (my.c) is built from the entity's CURRENT position, rotation and motion, then
//     `j/k/l = entity motion` (the shared last-sent motion every watcher's later S12 test reads) and the S12. Position packets after it are deltas from the one shared baseline.
//     Out of range: removed from the set, mw.d(sa) queues the S13.
//   * mn.a() (updateTrackedEntities): every entry's my.a(List) (sendLocationToAllClients) first, then each player whose own entry re-evaluated (my.n: moved more than 4 blocks, or new)
//     re-tests every entry. mn.a(sa) for a player (trackEntity): every existing entry tries the joining player at once.
//   * mn.b(sa) for a player (untrackEntity: World.removePlayerEntityDangerously, ahb.f, on a dimension change (oi.a(mw, int) 78..86), World.removeEntity on a logout): my.a(mw) drops the
//     player from every set; its S13s go to the player's next world, whose client never had the copies (main.js builds a new RemoteDispense with the trip), so none is sent here.
import { ObjectTracker as ObjectReader, ObjectEntry, Watcher, metaValues, OBJECT_KINDS } from '../object-tracker.js';
import { TrackerEntry, sizeClass } from '../entity-tracker.js';

export const THROWN = Object.freeze(['arrow', 'snowball', 'egg', 'enderPearl', 'potion', 'expBottle', 'eyeOfEnder', 'firework', 'fishHook']);
const everywhere = () => true;
const NO_VIEW = Object.freeze({ player: null, watches: () => false, log: null });

// b86 lanes86: an ObjectEntry with a watcher set. `tracked` is "somebody tracks me" for the packets sent to everyone, and "this watcher tracks me" while `cur` is set (the range test of
// one player, multiplayer/server-mob-entries.js SharedEntry's pattern). Every packet is routed to its watchers as it is emitted (the owner's `route`).
export class ThrownEntry extends ObjectEntry {
  constructor(p, options, watcher, owner, o) { super(p, options, NO_VIEW, watcher); this.owner = owner; this.o = o; this.set = new Set(); this.cur = null; }
  get tracked() { return this.cur ? this.set.has(this.cur) : !!this.set && this.set.size > 0; }
  set tracked(v) { if (this.cur) { if (v) this.set.add(this.cur); else this.set.delete(this.cur); } }
  emit(packet) {
    const to = this.cur ? [this.cur] : [...this.set];
    for (const w of to) this.owner.route(this.o, w, packet);
    if (packet.type === 'spawn') { const meta = { type: 'meta', id: packet.id, list: this.watcher.all() }; for (const w of to) this.owner.route(this.o, w, meta); } // the S1C after the spawn (ObjectEntry.emit)
  }
  // EntityTrackerEntry.sendEventsToPlayers / updatePlayerList: every player of the world, in list order.
  updatePlayerList() { for (const w of this.owner.watchers.values()) this.tryStartFor(w); }
  tryStartFor(w) { this.cur = w; this.view = w.view; try { TrackerEntry.prototype.tryStart.call(this); } finally { this.cur = null; this.view = NO_VIEW; } }
  // removeEntityFromAllTrackingPlayers: the S13 to each tracking watcher.
  remove() { for (const w of [...this.set]) { this.cur = w; try { TrackerEntry.prototype.remove.call(this); } finally { this.cur = null; } } }
  drop(w) { this.set.delete(w); }
}

export class ThrownTracks {
  // `limit()`: the tracker range limit; `watches(pid, cx, cz)`: the chunk gate; `fresh(pid)`: true when columns changed (re-test); `idOf(e)`: the entity's numeric id.
  // b85 mphook85: `shooterOf(e)` -> { p: playerId } | { m: mobWireId } | null, the entity the S0E data names for an arrow or a hook (the wire carries it as the row's `sh`).
  constructor({ limit = () => 144, watches = everywhere, fresh = () => false, idOf, shooterOf = () => null }) {
    this.limit = limit; this.watches = watches; this.fresh = fresh; this.idOf = idOf; this.shooterOf = shooterOf;
    this.births = new WeakMap(); // b85 mphook85: an entity's state at its join (see `birth`)
    this.reader = new ObjectReader(10, Math.random, null); // only its `read` is used: the live entity -> the stand-in the entry reads
    this.objs = new Map(); // live entity -> { kind, p, en, sh }
    this.watchers = new Map(); // pid -> { pid, view, ref, joining } (b86 lanes86: the players of this tracker's dimension, in join order)
    this.late = []; // destroys held back one tick: { pid, o, packet }
    this.out = null;
  }
  get active() { return this.objs.size > 0 || this.late.length > 0; }
  // b85 mphook85: called before the entity pass (ServerDispense.tick): copies the state of every listed entity not seen yet. The use / dispense / action pass has spawned them, so this is
  // the state World.spawnEntityInWorld had (b86 lanes86: the state of the S0E the join sends, mn.a(sa, int, int, boolean)).
  birth(list) { for (const { e } of list) if (!this.objs.has(e) && !this.births.has(e)) this.births.set(e, { ...e }); }
  // b86 lanes86: where an entry's packet goes. A destroy waits for the next tick (destroyedItemsNetCache).
  route(o, w, packet) {
    if (packet.type === 'destroy') { this.late.push({ pid: w.pid, o: { p: { id: o.p.id }, kind: o.kind, sh: o.sh }, packet }); return; }
    this.push(w.pid, o, packet);
  }
  push(pid, o, packet) {
    let rows = this.out.get(pid);
    if (!rows) this.out.set(pid, rows = new Map());
    let row = rows.get(o);
    if (!row) rows.set(o, row = { i: o.p.id, k: o.kind, p: [], ...(o.sh ? { sh: o.sh } : {}) });
    row.p.push(packet);
  }
  entryFor(e, kind) {
    const o = { kind, p: { id: e.entityId ?? this.idOf(e) }, en: null, sh: null }; // (a fishing hook's id is its own entityId, the one the server's mob ids gave)
    if (kind === 'fishHook') o.sh = e.anglerId !== undefined ? { p: e.anglerId } : null; // the hook's S0E data is its angler
    else if (kind === 'arrow') o.sh = this.shooterOf(e, kind) ?? null;
    const b = this.births.get(e); this.births.delete(e);
    this.reader.read(kind, b ?? e, o.p); // the join state: the entry's baseline (my.<init>) and the S0E of the viewers already there
    const spec = OBJECT_KINDS[kind], object = { kind, data: spec.data(o.p), objectType: spec.type };
    o.en = new ThrownEntry(o.p, { range: spec.range, frequency: spec.frequency, velocity: spec.velocity, size: sizeClass(spec.width), arrow: !!spec.arrow, object, limit: this.limit() }, new Watcher(metaValues(kind, o.p), kind === 'arrow' && o.p.crit), this, o);
    return o;
  }
  // Once per tick after the entity pass. `list`: [{ e, kind }]; `players`: Map pid -> player of this tracker's dimension. Returns Map pid -> rows [{ i, k, p, sh? }].
  update(list, players) {
    this.out = new Map();
    // last tick's held destroys go out first (the S13 of the player's update before this tracker pass); a player who left the dimension never gets them here
    for (const h of this.late.splice(0)) if (players.has(h.pid)) this.push(h.pid, h.o, h.packet);
    // untrackEntity: a player who left this dimension (or the server) leaves every set
    for (const [pid, w] of [...this.watchers]) if (!players.has(pid)) { this.watchers.delete(pid); for (const o of this.objs.values()) o.en.drop(w); }
    // trackEntity for a player: a new watcher is tried by every entry at once
    for (const [pid, player] of players) {
      let w = this.watchers.get(pid);
      if (!w) this.watchers.set(pid, w = { pid, view: { player: null, watches: (cx, cz) => this.watches(pid, cx, cz), log: null }, ref: null, joining: true });
      w.view.player = player.position;
    }
    for (const w of this.watchers.values()) if (w.joining) { w.joining = false; for (const o of this.objs.values()) o.en.tryStartFor(w); }
    // the entities that ended: a rocket's S1A 17, then the destroy to each tracking watcher
    const alive = new Set(list.map((x) => x.e));
    for (const [e, o] of [...this.objs]) if (!alive.has(e)) {
      if (e.exploded && o.kind === 'firework') o.en.send({ type: 'status', id: o.p.id, status: 17 }); // World.setEntityState(rocket, 17), then setDead
      o.en.remove();
      this.objs.delete(e);
    }
    // addEntityToTracker: the new entries, each sent at once to the players in range (from the join state)
    for (const { e, kind } of list) if (!this.objs.has(e)) { const o = this.entryFor(e, kind); this.objs.set(e, o); o.en.updatePlayerList(); }
    // sendLocationToAllClients, once per entry: the flush state
    for (const { e, kind } of list) {
      const o = this.objs.get(e), en = o.en;
      this.reader.read(kind, e, o.p);
      const air = e.airBorne === true;
      e.velocityChanged = false;
      en.watcher.update(metaValues(kind, o.p));
      en.sendLocation(air, en.watcher.hasChanges());
    }
    // the players whose own entry re-evaluated (moved more than 4 blocks, or new) or whose columns changed re-test every entry
    for (const w of this.watchers.values()) {
      const pos = w.view.player;
      let flagged = !!this.fresh(w.pid);
      if (!w.ref) flagged = true;
      else { const dx = pos.x - w.ref.x, dy = pos.y - w.ref.y, dz = pos.z - w.ref.z; if (dx * dx + dy * dy + dz * dz > 16) flagged = true; }
      if (flagged) { w.ref = { x: pos.x, y: pos.y, z: pos.z }; for (const o of this.objs.values()) o.en.tryStartFor(w); }
    }
    const sendOut = new Map();
    for (const [pid, rows] of this.out) sendOut.set(pid, [...rows.values()]);
    this.out = null;
    return sendOut;
  }
  // Players that must get a message this tick: they track an entry, or a held destroy is pending for them.
  tracking(pid) {
    const w = this.watchers.get(pid);
    if (w) for (const o of this.objs.values()) if (o.en.set.has(w)) return true;
    return this.late.some((h) => h.pid === pid);
  }
  // b86 lanes86: the entry of a live entity (tests and the stand-in lanes read it).
  entryOf(e) { return this.objs.get(e)?.en ?? null; }
}
