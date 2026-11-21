// b92 console92: the EntityTrackerEntry of a primed TNT, run beside the dispense lane so /netstat can count what the native tracker sends for it (the wire still carries the port's
// per-tick `ents` snapshot rows; this adds no wire field).
// Bytecode-read (mn.a(sa) 1.7.10): EntityTNTPrimed (xw) is tracked 160 / 10 / sendVelocityUpdates true; my.c builds `fw(sa, 50)` for it (data 0: no motion shorts). xw has no data of its
// own (sa's flags byte and air short only). One entry per TNT shared by every viewer, as BallTracks does for the fireballs (fireball-copy.js): the entry runs once per tick after the entity
// pass, and its packets of that tick go to every viewer that has the row.
import { TrackerEntry, sizeClass } from '../entity-tracker.js';
import { TNT_SIZE, TNT_Y_OFFSET } from '../explosion.js';
import { ObjectTracker as ObjectReader, OBJECT_KINDS } from '../object-tracker.js'; // b93 console93

export const TNT_TRACK = Object.freeze({ range: 160, frequency: 10, velocity: true });
class TntEntry extends TrackerEntry {
  constructor(o) { super(o, { ...TNT_TRACK, size: sizeClass(TNT_SIZE) }, { log: null }); this.tracked = true; this.initialised = true; }
  updatePlayerList() {}
}
export class TntTracks {
  constructor() { this.map = new Map(); }
  /** After the tick's entity pass: each live TNT's entry runs sendLocationToAllClients. */
  update(list) {
    const live = new Set();
    for (const e of list) {
      if (!e || e.fuse <= 0) continue;
      live.add(e);
      let t = this.map.get(e);
      if (!t) { const o = { type: 'tnt', x: e.x, y: e.y + TNT_Y_OFFSET, z: e.z, vx: 0, vy: 0, vz: 0, rotationYaw: 0, rotationPitch: 0 }; t = { o, en: new TntEntry(o), packets: [], flag: false }; this.map.set(e, t); }
      const vc = !!e.velocityChanged;
      Object.assign(t.o, { x: e.x, y: e.y + TNT_Y_OFFSET, z: e.z, vx: e.vx ?? 0, vy: e.vy ?? 0, vz: e.vz ?? 0, velocityChanged: vc });
      e.velocityChanged = false;
      const burning = e.fire > 0, changed = burning !== t.flag; // Entity.onEntityUpdate's setFlag(0, fire > 0): a changed watcher forces the location block and sends an S1C
      t.en.sendLocation(false, changed);
      const out = t.en.packets.splice(0).map((p) => ({ type: p.type }));
      if (changed) { t.flag = burning; out.splice(vc ? out.length - 1 : out.length, 0, { type: 'meta' }); } // my.a(List): the S1C comes before the tail's velocityChanged S12
      t.packets = out;
    }
    for (const e of [...this.map.keys()]) if (!live.has(e)) this.map.delete(e);
  }
  /** This tick's native packet kinds for `e` ([] when none). */
  kinds(e) { return this.map.get(e)?.packets ?? []; }
}

// b93 console93: the same for a snow golem's snowball (`k: 'b'` rows of dispEnts that came from `mobs._golemBalls`). Bytecode-read (mn.a(sa), thrown-tracks.js): EntitySnowball is tracked
// 64 / 10 / sendVelocityUpdates TRUE; my.c builds S0E type 61 with data 0. The stand-in comes from ObjectTracker.read('snowball') (the same read the thrown tracker uses for a player's
// snowball), so a golem ball and a thrown one have the same entry. Nothing here goes on the wire: the packet kinds feed `/netstat` through the row's info.
class BallEntry extends TrackerEntry {
  constructor(o, spec) { super(o, { range: spec.range, frequency: spec.frequency, velocity: spec.velocity, size: sizeClass(spec.width) }, { log: null }); this.tracked = true; this.initialised = true; }
  updatePlayerList() {}
}
export class GolemTracks {
  constructor() { this.map = new Map(); this.reader = new ObjectReader(10, Math.random, null); }
  /** After the tick's entity pass: each live ball's entry runs sendLocationToAllClients. */
  update(list) {
    const live = new Set();
    for (const e of list) {
      if (!e || e.dead) continue;
      live.add(e);
      let t = this.map.get(e);
      if (!t) { const o = { id: 0 }; this.reader.read('snowball', e, o); t = { o, en: new BallEntry(o, OBJECT_KINDS.snowball), packets: [] }; this.map.set(e, t); }
      this.reader.read('snowball', e, t.o);
      t.o.velocityChanged = false;
      t.en.sendLocation(t.o.airBorne === true, false);
      t.packets = t.en.packets.splice(0).map((p) => ({ type: p.type }));
    }
    for (const e of [...this.map.keys()]) if (!live.has(e)) this.map.delete(e);
  }
  kinds(e) { return this.map.get(e)?.packets ?? []; }
}
