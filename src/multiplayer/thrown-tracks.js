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
// tracker-extras-reference.json). One entry per (player, entity), as the cadence item lane does; every entry starts at the entity's own tick count so all viewers share one beat.
// Wire: `dispEnts` messages carry `trk: [{ i, k, p: [packets] }]` (k an OBJECT_KINDS key) and are sent each tick while the player tracks anything, so every copy updates once per tick.
// The S13 of a dead entity goes out one tick later (EntityPlayerMP's destroyedItemsNetCache), so the copy takes two more updates (fireball-copy.js, same port-read).
import { ObjectTracker as ObjectReader, ObjectEntry, Watcher, metaValues, OBJECT_KINDS } from '../object-tracker.js';
import { sizeClass } from '../entity-tracker.js';

export const THROWN = Object.freeze(['arrow', 'snowball', 'egg', 'enderPearl', 'potion', 'expBottle', 'eyeOfEnder', 'firework']);
const everywhere = () => true;

export class ThrownTracks {
  // `limit()`: the tracker range limit; `watches(pid, cx, cz)`: the chunk gate; `fresh(pid)`: true when columns changed (re-list); `idOf(e)`: the entity's numeric id.
  constructor({ limit = () => 144, watches = everywhere, fresh = () => false, idOf }) {
    this.limit = limit; this.watches = watches; this.fresh = fresh; this.idOf = idOf;
    this.reader = new ObjectReader(10, Math.random, null); // only its `read` is used: the live entity -> the stand-in the entry reads
    this.objs = new Map(); this.views = new Map();
    this.late = []; // destroys held back one tick: { pid, id, k, packet }
  }
  get active() { return this.objs.size > 0 || this.late.length > 0; }
  // Once per tick after the entity pass. `list`: [{ e, kind }]; `players`: Map pid -> player of this dimension. Returns Map pid -> rows [{ i, k, p }].
  update(list, players) {
    const sendOut = new Map();
    const push = (pid, o, packets) => { if (!packets.length) return; let l = sendOut.get(pid); if (!l) sendOut.set(pid, l = []); l.push({ i: o.p.id, k: o.kind, p: packets }); };
    // last tick's held destroys go out now (before this tick's packets: the S13 of the previous tick's player update)
    const held = this.late.splice(0);
    for (const h of held) if (players.has(h.pid)) push(h.pid, h, [h.packet]);
    const alive = new Set(list.map((x) => x.e));
    for (const [e, o] of [...this.objs]) if (!alive.has(e)) {
      for (const [pid, en] of o.entries) {
        if (e.exploded && o.kind === 'firework') en.send({ type: 'status', id: o.p.id, status: 17 }); // World.setEntityState(rocket, 17), then setDead
        en.remove();
        const out = en.packets.splice(0), last = out.findIndex((p) => p.type === 'destroy');
        if (players.has(pid)) { push(pid, o, last < 0 ? out : out.slice(0, last)); if (last >= 0) this.late.push({ pid, p: o.p, kind: o.kind, packet: out[last] }); }
      }
      this.objs.delete(e);
    }
    for (const { e, kind } of list) {
      let o = this.objs.get(e);
      if (!o) this.objs.set(e, o = { kind, p: { id: this.idOf(e) }, entries: new Map(), ticks: 0 });
      this.reader.read(kind, e, o.p);
      o.vc = !!e.velocityChanged; o.air = e.airBorne === true;
      e.velocityChanged = false;
    }
    const limit = this.limit();
    for (const [pid, player] of players) {
      let v = this.views.get(pid);
      const pos = player.position;
      let moved = false;
      if (!v) { this.views.set(pid, v = { ref: { x: pos.x, y: pos.y, z: pos.z }, view: { player: pos, watches: (cx, cz) => this.watches(pid, cx, cz), log: null } }); moved = true; }
      else if (this.fresh(pid)) moved = true;
      else { const dx = pos.x - v.ref.x, dy = pos.y - v.ref.y, dz = pos.z - v.ref.z; if (dx * dx + dy * dy + dz * dz > 16) { v.ref = { x: pos.x, y: pos.y, z: pos.z }; moved = true; } }
      v.view.player = pos;
      for (const o of this.objs.values()) {
        let en = o.entries.get(pid);
        const spec = OBJECT_KINDS[o.kind];
        if (!en) {
          const object = { kind: o.kind, data: spec.data(o.p), objectType: spec.type };
          o.entries.set(pid, en = new ObjectEntry(o.p, { range: spec.range, frequency: spec.frequency, velocity: spec.velocity, size: sizeClass(spec.width), arrow: !!spec.arrow, object, limit }, v.view, new Watcher(metaValues(o.kind, o.p), o.kind === 'arrow' && o.p.crit)));
          en.ticks = o.ticks;
        } else if (moved) en.tryStart();
        en.watcher.update(metaValues(o.kind, o.p));
        o.p.velocityChanged = o.vc; // every entry sends the tail S12 (ObjectEntry clears the shared stand-in's flag)
        en.sendLocation(o.air, en.watcher.hasChanges());
        push(pid, o, en.packets.splice(0));
      }
    }
    for (const o of this.objs.values()) o.ticks++;
    for (const pid of [...this.views.keys()]) if (!players.has(pid)) this.views.delete(pid);
    return sendOut;
  }
  // Players that must get a message this tick: they track an entry, or a held destroy is pending for them.
  tracking(pid) {
    for (const o of this.objs.values()) if (o.entries.get(pid)?.tracked) return true;
    return this.late.some((h) => h.pid === pid);
  }
}
