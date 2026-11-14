import { TrackerEntry, sizeClass } from '../entity-tracker.js';
import { ObjectEntry, Watcher, metaValues, OBJECT_KINDS } from '../object-tracker.js'; // b72 mpcadence72: the single-player object entry (spawn + S1C), also the packet source of the cadence mode

// Batch 71 (mptrackers71): dropped items and experience orbs are tracked per player on the dedicated server, as EntityTracker does.
// Bytecode-read (javap -c on mn.a(sa), the unchanged 1.7.10 jar): EntityItem (xk) -> addEntityToTracker(e, 64, 20, true), EntityXPOrb (sq) -> (e, 160, 20, true);
// mn.a(sa, int, int, boolean) first clamps the range to the tracker limit `e` (view-distance * 16 - 16). The entry test, its 4-block re-evaluation of the
// tracking list and the square range are EntityTrackerEntry's, run here by the same TrackerEntry the single-player object tracker is built on (executed:
// public/research/tracker-items-reference.json). One entry exists per (player, object); `entry.tracked` is "the player is in trackingPlayers".
//
// Wire: the dedicated server sends the item and orb lists as snapshots (every tick, positions included), so a tracked object rides in the player's own
// `items` / `xp` list and the S0F-like spawn / S13-like destroy of an entry is the object entering / leaving that list (the client's list diff creates and
// removes the copy). The packet cadence of an entry (frequency 20) is not applied to those positions: the client has no item physics to cover the gaps.
// b72 mpcadence72 (cadence mode, on in the Simulation): the entry's packets themselves now go out, as `itrack` rows `{ i, k: 'item'|'orb', p: [packets] }` in the player's tick (spawn, S1C meta, S12
// velocity, S14/S15/S17 moves, S18 teleport, S13 destroy), at the entry's update frequency 20 with its movement thresholds. The tick's `items` / `xp` lists are then not sent;
// the client (client-itrack.js) moves each copy between packets with the client EntityItem / EntityXPOrb physics (ObjectClient.step, executed in tracker-items-reference.json).
// One entry per (player, object) still: each entry starts at the object's own tick count, so every player sees the same 20-tick beat (natively one shared entry).
// S0D collect (`taken`) goes to the players that tracked the item (EntityTracker.func_151247_a on the item), plus the collector.
export const ITEM_RANGE = 64, ORB_RANGE = 160;
const KINDS = {
  item: { range: ITEM_RANGE, frequency: 20, velocity: true, object: { kind: 'item', objectType: 2, data: 1 }, field: 'items' },
  orb: { range: ORB_RANGE, frequency: 20, velocity: true, object: { orb: true, data: 0 }, field: 'xp' }, // b72: the spawn packet carries `value` (set per orb)
};
const everywhere = () => true;

export class ObjectTracker {
  // `host`: { players: Map, rules } (the Simulation). `watches(pid, cx, cz)`: the chunk gate of tryStartWachingThis (view-distance chunk streaming plugs in here).
  constructor(host, watches = everywhere, cadence = false) { this.host = host; this.watches = watches; this.cadence = cadence; this.dims = new Map(); this.done = new WeakMap(); }
  get limit() { return this.host.rules?.trackerLimit ?? 144; }
  state(dim) { let s = this.dims.get(dim); if (!s) this.dims.set(dim, s = { objs: new Map(), views: new Map() }); return s; }

  // Runs the tracker pass of one tick message for dimension `dim` (once per message object); returns the per-player tracked key sets.
  update(message, dim, key = message) { // `key`: the message object shared by every player (the chunk-expanded copy differs per client kind)
    if (this.done.has(key)) return this.done.get(key);
    const s = this.state(dim), here = new Map();
    for (const [id, p] of this.host.players) if ((p.dimension | 0) === dim) here.set(id, p);
    // players that left the dimension forget their entries (the client rebuilt its world)
    for (const id of [...s.views.keys()]) if (!here.has(id)) s.views.delete(id);
    const rows = new Map();
    for (const [kind, spec] of Object.entries(KINDS)) for (const r of message[spec.field] ?? []) rows.set(`${kind}:${r.i}`, [kind, r]);
    const sendOut = new Map(); // b72: pid -> itrack rows of this pass
    const push = (pid, o, en) => { if (en.packets.length) { if (this.cadence) { let l = sendOut.get(pid); if (!l) sendOut.set(pid, l = []); l.push({ i: o.e.id, k: o.kind, p: en.packets.splice(0) }); } else en.packets.length = 0; } };
    for (const [key, o] of s.objs) if (!rows.has(key)) { for (const [pid, en] of o.entries) { en.remove(); if (here.has(pid)) push(pid, o, en); } s.objs.delete(key); } // untrackEntity (b72: its S13 goes out in cadence mode)
    for (const [key, [kind, r]] of rows) {
      let o = s.objs.get(key);
      if (!o) s.objs.set(key, o = { kind, e: { id: r.i, x: r.x, y: r.y, z: r.z, rotationYaw: 0, rotationPitch: 0, vx: 0, vy: 0, vz: 0, fire: 0, type: kind }, entries: new Map(), ticks: 0 });
      // cadence mode: posY (box bottom + yOffset) and the motion, which the rows carry (mx/my/mz for items, vx/vy/vz for orbs)
      const off = this.cadence ? OBJECT_KINDS[kind].yOff : 0;
      o.e.x = r.x; o.e.y = r.y + off; o.e.z = r.z; o.e.stack = r.stack; o.value = r.v;
      o.e.vx = r.mx ?? r.vx ?? 0; o.e.vy = r.my ?? r.vy ?? 0; o.e.vz = r.mz ?? r.vz ?? 0;
    }
    const limit = this.limit, out = new Map();
    for (const [pid, p] of here) {
      let v = s.views.get(pid);
      const pos = p.position;
      // EntityTracker.updateTrackedEntities: the player's own entry re-lists every entity when the player moved more than 4 blocks from where it last did (and at the join)
      let moved = false;
      if (!v) { s.views.set(pid, v = { ref: { x: pos.x, y: pos.y, z: pos.z }, tracked: new Set(), view: { player: pos, watches: (cx, cz) => this.watches(pid, cx, cz), log: null } }); moved = true; }
      else if (this.host.chunkViews?.takeFresh(pid, 'objects')) moved = true; // b72 mpstream72: a column was sent or unloaded: re-list (PlayerManager's tracker call after S26)
      else { const dx = pos.x - v.ref.x, dy = pos.y - v.ref.y, dz = pos.z - v.ref.z; if (dx * dx + dy * dy + dz * dz > 16) { v.ref = { x: pos.x, y: pos.y, z: pos.z }; moved = true; } }
      v.view.player = pos;
      const next = new Set();
      for (const [key, o] of s.objs) {
        let en = o.entries.get(pid);
        if (!en) {
          const spec = KINDS[o.kind], opts = { range: spec.range, frequency: spec.frequency, velocity: spec.velocity, object: o.kind === 'orb' ? { ...spec.object, value: o.value } : spec.object, limit };
          o.entries.set(pid, en = this.cadence
            ? new ObjectEntry(o.e, { ...opts, size: sizeClass(OBJECT_KINDS[o.kind].width) }, v.view, new Watcher(metaValues(o.kind, o.e), o.kind === 'item'))
            : new TrackerEntry(o.e, opts, v.view));
          en.ticks = this.cadence ? o.ticks : 0;
        } else if (moved) en.tryStart();
        if (this.cadence && en.watcher) en.watcher.update(metaValues(o.kind, o.e)); // a merged stack changes the S1C
        en.sendLocation(false, false); push(pid, o, en); // the first pass lists the players; later ones re-list when the object moved over 4 blocks
        if (en.tracked) next.add(key);
      }
      v.prev = v.tracked; v.tracked = next; v.itrack = sendOut.get(pid) ?? []; out.set(pid, v);
    }
    for (const o of s.objs.values()) o.ticks++;
    this.done.set(key, out);
    return out;
  }

  // The tick message of player `pid` (dimension `dim`): the item and orb lists cut to what the player tracks, `taken` to the pickups of tracked items.
  messageFor(pid, message, dim = 0, key = message) {
    if (!message || (!message.items && !message.xp && !message.taken && !this.state(dim).objs.size)) return message;
    const v = this.update(message, dim, key).get(pid);
    if (!v) return message;
    const out = { ...message };
    if (this.cadence) { // b72: the packets replace the lists
      delete out.items; delete out.xp;
      if (v.itrack.length) out.itrack = v.itrack;
    }
    else for (const [kind, spec] of Object.entries(KINDS)) {
      if (!message[spec.field]) continue;
      const list = message[spec.field].filter(r => v.tracked.has(`${kind}:${r.i}`));
      if (list.length) out[spec.field] = list; else delete out[spec.field]; // an absent list clears the client's copies (applyMultiplayerTick)
    }
    if (message.taken) {
      const taken = message.taken.filter(t => t.by === pid || v.prev.has(`item:${t.i}`) || v.tracked.has(`item:${t.i}`));
      if (taken.length) out.taken = taken; else delete out.taken;
    }
    return out;
  }

  // The welcome / respawn snapshot's `items`, cut by the same square test at the joining player's position.
  snapshot(pid, world) {
    const p = this.host.players.get(pid);
    if (!p || !world?.items) return world;
    const range = Math.min(ITEM_RANGE, this.limit);
    return { ...world, items: world.items.filter(r => Math.abs(r.x - p.position.x) <= range && Math.abs(r.z - p.position.z) <= range) };
  }
}
