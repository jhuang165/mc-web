// b71 mpreach71: the minecart half of EntityTracker on the dedicated server. EntityTracker.addEntityToTracker(EntityMinecart, 80, 3, true): range 80, update frequency 3,
// velocity updates. Each cart has one EntityTrackerEntry (entity-tracker.js `TrackerEntry`, executed against the unchanged `my` by tools/probes/TrackerVehiclesProbe.java) that
// runs once per server tick and sends a position packet only when ticks % 3 == 0 (or the entity is airborne / its data changed) AND the encoded position moved 4/32 block,
// the rotation 4/256 turn, on every 60th tick, or as a teleport after 400 ticks (or a jump over 4 blocks). Nothing is sent between those ticks, so a cart that creeps less than
// 0.125 block in a window stays where the client last saw it.
// The port's wire is one `vehicles` state per cart, not Java's relative packets, so the entry only decides WHEN the position fields go out: `sent` is the state the entry last
// released. Data-watcher fields (hit, damage, display, lit, fuse) are sent at once (sendMetadataToAllAssociatedPlayers runs every tick) with the old position and the `cartMeta`
// flag, so the client applies them without re-aiming. A player that starts tracking a cart gets the position the entry last released (the spawn packet's lastScaledPosition).
import { TrackerEntry, sizeClass } from '../entity-tracker.js';

export const CART_RANGE = 80, CART_FREQUENCY = 3, CART_WIDTH = Math.fround(0.98);
const POS = ['x', 'y', 'z', 'yaw', 'pitch'];

// The stand-in entity the entry reads (Java field names; y is posY).
function standIn(v, p = {}) {
  p.x = v.x; p.y = v.posY; p.z = v.z; p.vx = v.vx ?? 0; p.vy = v.vy ?? 0; p.vz = v.vz ?? 0; p.rotationYaw = v.yaw ?? 0; p.rotationPitch = v.pitch ?? 0;
  p.airBorne = v.airBorne === true; p.velocityChanged = !!v.velocityChanged; p.health = 0; p.type = 'minecart'; p.id = v.id;
  return p;
}

export class CartTracker {
  constructor() { this.entries = new Map(); } // cart -> { entry, e, sent }
  /** One server tick for a live cart with its current wire state `state`; returns the state whose position fields the clients may hold (the last released). */
  tick(v, state) {
    let en = this.entries.get(v);
    if (!en) {
      const e = standIn(v), entry = new TrackerEntry(e, { range: CART_RANGE, frequency: CART_FREQUENCY, velocity: true, size: sizeClass(CART_WIDTH), limit: CART_RANGE }, { player: null, watches: () => false });
      entry.tracked = true; entry.lastVX = e.vx; entry.lastVY = e.vy; entry.lastVZ = e.vz;
      en = { entry, e, sent: Object.fromEntries(POS.map(k => [k, state[k]])), released: true };
      this.entries.set(v, en); // the first sendLocation (ticks 0) runs below: it sends no position packet, as the executed entry at tick 0
    }
    standIn(v, en.e);
    en.entry.packets.length = 0;
    // DataWatcher.hasChanges (the hit, damage, display, lit, fuse fields) also makes the entry run its location block off the 3 tick beat
    const meta = JSON.stringify(Object.fromEntries(Object.entries(state).filter(([k]) => !POS.includes(k)))), dataChanged = en.meta !== undefined && en.meta !== meta;
    en.meta = meta;
    en.entry.sendLocation(en.e.airBorne, dataChanged);
    en.released = en.entry.packets.some(p => p.type === 'move' || p.type === 'moveLook' || p.type === 'look' || p.type === 'teleport');
    en.entry.packets.length = 0;
    if (v.airBorne) v.airBorne = false; // Entity.isAirBorne is reset by the tracker after the send
    if (v.velocityChanged) v.velocityChanged = false; // and velocityChanged once its S12 went out
    if (en.released) for (const k of POS) en.sent[k] = state[k];
    return en.sent;
  }
  /** Drops the entries of carts that are gone. */
  prune(live) { for (const v of this.entries.keys()) if (!live.has(v)) this.entries.delete(v); }
}
