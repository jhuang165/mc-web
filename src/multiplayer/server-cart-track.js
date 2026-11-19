// b71 mpreach71: the minecart half of EntityTracker on the dedicated server. EntityTracker.addEntityToTracker(EntityMinecart, 80, 3, true): range 80, update frequency 3,
// velocity updates. Each cart has one EntityTrackerEntry (entity-tracker.js `TrackerEntry`, executed against the unchanged `my` by tools/probes/TrackerVehiclesProbe.java) that
// runs once per server tick and sends a position packet only when ticks % 3 == 0 (or the entity is airborne / its data changed) AND the encoded position moved 4/32 block,
// the rotation 4/256 turn, on every 60th tick, or as a teleport after 400 ticks (or a jump over 4 blocks). Nothing is sent between those ticks, so a cart that creeps less than
// 0.125 block in a window stays where the client last saw it.
// The port's wire is one `vehicles` state per cart, not Java's relative packets, so the entry only decides WHEN the position fields go out: `sent` is the state the entry last
// released. Data-watcher fields (hit, damage, display, lit, fuse) are sent at once (sendMetadataToAllAssociatedPlayers runs every tick) with the old position and the `cartMeta`
// flag, so the client applies them without re-aiming. A player that starts tracking a cart gets the position the entry last released (the spawn packet's lastScaledPosition).
// b83 tracker83: boats too (EntityTracker.addEntityToTracker(EntityBoat, 80, 3, true), bytecode-read mn.a(sa): `xi` 80 / 3 / iconst_1, `xl` likewise), and the released state is now
// what the client entity holds after the entry's packets, not the server's exact position (NetHandlerPlayClient, bytecode-read and executed in tracker-vehicles-reference.json):
//   * the S0E puts serverPos at floor(pos * 32); S15 / S17 add the deltas, S18 sets it; every position packet (S16 too) calls setPositionAndRotation2(serverPos / 32, ...),
//     S18 with y + 1/64 (0.015625). So a cart or boat that got the 400-tick teleport sits 1/64 high on the client until its next move or look packet.
//   * S16 / S17 / S18 carry the angle bytes ((float)(byte * 360) / 256); S15 keeps the client's rotation (the last released here).
//   * EntityBoat(world, x, y, z) (the S0E constructor) calls setPosition(x, y + yOffset, z): a new boat copy is 0.3 above the S0E position until a position packet (yOff in object-tracker.js).
//   * Boats: the entry's S12 (sendVelocityUpdates over 0.02 squared, and the velocityChanged tail of my.a(List): a blast, a hit) is released as `motion` with a running count `vs`;
//     the client copy coasts on it (remote-vehicles.js). A cart copy never moves by its motion (EntityMinecart.onUpdate's remote branch only interpolates or re-sets its position,
//     bytecode-read xl.h), so a cart's S12 has nothing to show and is not released.
import { TrackerEntry, sizeClass, angleByteOf, velocityInt } from '../entity-tracker.js';

export const CART_RANGE = 80, CART_FREQUENCY = 3, CART_WIDTH = Math.fround(0.98);
const POS = ['x', 'y', 'z', 'yaw', 'pitch'];

// The stand-in entity the entry reads (Java field names; y is posY).
function standIn(v, p = {}) {
  p.x = v.x; p.y = v.posY; p.z = v.z; p.vx = v.vx ?? 0; p.vy = v.vy ?? 0; p.vz = v.vz ?? 0; p.rotationYaw = v.yaw ?? 0; p.rotationPitch = v.pitch ?? 0;
  p.airBorne = v.airBorne === true; p.velocityChanged = !!v.velocityChanged; p.health = 0; p.type = v.boat ? 'boat' : 'minecart'; p.id = v.id;
  return p;
}
const f = Math.fround;
const idiv = (a, b) => Math.trunc(a / b); // Java int division
const angleOfByte = (b) => f(f(b * 360) / 256); // (float)(byte * 360) / 256.0F
export const BOAT_WIDTH = f(1.5), BOAT_LIFT = f(0.3), TELEPORT_LIFT = 0.015625;

export class CartTracker {
  constructor() { this.entries = new Map(); } // vehicle -> { entry, e, sent, m (the client's serverPos), vs, motion }
  /** One server tick for a live cart or boat with its current wire state `state`; returns the state fields the clients hold (the position and angles last released, and for a boat the last S12). */
  tick(v, state) {
    let en = this.entries.get(v);
    if (!en) {
      const e = standIn(v), entry = new TrackerEntry(e, { range: CART_RANGE, frequency: CART_FREQUENCY, velocity: true, size: sizeClass(v.boat ? BOAT_WIDTH : CART_WIDTH), limit: CART_RANGE }, { player: null, watches: () => false });
      entry.tracked = true; entry.lastVX = e.vx; entry.lastVY = e.vy; entry.lastVZ = e.vz;
      // the S0E: serverPos = floor(pos * 32), the copy at serverPos / 32 (a boat 0.3 higher), the server's angles as bytes, then the spawn's S12 with the current motion
      const m = { sx: Math.floor(e.x * 32), sy: Math.floor(e.y * 32), sz: Math.floor(e.z * 32) };
      const sent = { x: m.sx / 32, y: m.sy / 32 + (v.boat ? BOAT_LIFT : 0), z: m.sz / 32, yaw: angleOfByte(angleByteOf(e.rotationYaw)), pitch: angleOfByte(angleByteOf(e.rotationPitch)) };
      en = { entry, e, m, sent, released: true, vs: 0, rs: 0, pc: 0, tc: 0, rc: 0, motion: v.boat ? [e.vx, e.vy, e.vz].map(q => velocityInt(q) / 8000) : null };
      this.entries.set(v, en); // the first sendLocation (ticks 0) runs below: it sends no position packet, as the executed entry at tick 0
    }
    standIn(v, en.e);
    en.entry.packets.length = 0;
    // DataWatcher.hasChanges (the hit, damage, display, lit, fuse fields) also makes the entry run its location block off the 3 tick beat
    const meta = JSON.stringify(Object.fromEntries(Object.entries(state).filter(([k]) => !POS.includes(k)))), dataChanged = en.meta !== undefined && en.meta !== meta;
    en.meta = meta;
    // b83 tracker83: my.a(List) re-tests the players (tryStartWachingThis) only when the entity moved more than 4 blocks from where it last did (and at its first update), and
    // before this tick's packets: the square test reads lastScaledPosition / 32 (int division) as it was then. ServerVehicles.track applies it per viewer.
    en.pre = [idiv(en.entry.lastX, 32), idiv(en.entry.lastZ, 32)];
    en.snapPre = this.snap(en); // b84 mpboat84: the spawn packet of a viewer this entry's own re-list finds (before this tick's packets)
    en.entry.sendLocation(en.e.airBorne, dataChanged);
    en.recheck = en.entry.updated;
    // b72 mpcadence72 / b83 tracker83: each position packet re-aims the client entity at serverPos / 32 (S18: + 1/64); S16 / S17 / S18 also turn it to the bytes
    let place = false;
    const { m, sent } = en;
    for (const p of en.entry.packets) {
      if (p.type === 'velocity') { if (en.motion) { en.motion = [p.vx / 8000, p.vy / 8000, p.vz / 8000]; en.vs++; } continue; }
      if (p.type !== 'move' && p.type !== 'moveLook' && p.type !== 'look' && p.type !== 'teleport') continue;
      if (p.type === 'teleport') en.tc++; // b84 mpboat84: counts of S18, of the packets that carry angle bytes (S16 / S17 / S18) and of every position packet, for a late viewer's own serverPos
      if (p.type !== 'move') en.rc++;
      en.pc++;
      if (p.type === 'teleport') { m.sx = p.x; m.sy = p.y; m.sz = p.z; } else if (p.type !== 'look') { m.sx += p.dx; m.sy += p.dy; m.sz += p.dz; }
      sent.x = m.sx / 32; sent.y = m.sy / 32 + (p.type === 'teleport' ? TELEPORT_LIFT : 0); sent.z = m.sz / 32;
      if (p.type !== 'move') { sent.yaw = angleOfByte(p.yaw); sent.pitch = angleOfByte(p.pitch); }
      place = true;
    }
    en.released = place;
    if (place && en.motion) en.rs++; // a boat's release count: every position packet re-aims the copy (8 increments), even at the same serverPos
    en.entry.packets.length = 0;
    en.snapPost = this.snap(en); // b84 mpboat84: ... and the one a viewer's own re-list finds (EntityTracker runs it after every entry's update)
    if (v.airBorne) v.airBorne = false; // Entity.isAirBorne is reset by the tracker after the send
    if (v.velocityChanged) v.velocityChanged = false; // and velocityChanged once its S12 went out
    return en.motion ? { ...sent, bc: 1, vs: en.vs, rs: en.rs, mx: en.motion[0], my: en.motion[1], mz: en.motion[2] } : { ...sent };
  }
  /** b84 mpboat84: what a spawn packet carries now (EntityTrackerEntry.func_151260_c builds the S0E from the entity: floor(pos * 32), the angle bytes, the S12 with the motion). */
  snap(en) {
    const e = en.e, m = en.m;
    return { sx: Math.floor(e.x * 32), sy: Math.floor(e.y * 32), sz: Math.floor(e.z * 32), msx: m.sx, msy: m.sy, msz: m.sz,
      yaw: angleOfByte(angleByteOf(e.rotationYaw)), pitch: angleOfByte(angleByteOf(e.rotationPitch)), pc: en.pc, tc: en.tc, rc: en.rc, vs: en.vs,
      motion: en.motion ? [e.vx, e.vy, e.vz].map(q => velocityInt(q) / 8000) : null };
  }
  /** The spawn record for a viewer that starts tracking `v` now: `afterPackets` false when the entry's own re-list found it (before this tick's packets). Null for an unknown vehicle. */
  join(v, entryRelist) { const en = this.entries.get(v); return en ? (entryRelist ? en.snapPre : en.snapPost) : null; }
  /**
   * b84 mpboat84: the state field a viewer's client holds. Its entity was made by the S0E at floor(pos * 32) (a boat 0.3 high) with the entity's rotation bytes and the spawn's S12, so
   * until the entry releases a position, a look or a velocity packet the viewer holds those, and after one the entry's later deltas (S15 / S17) land on the viewer's own serverPos:
   * the difference to the entry's lastScaledPosition stays until an S18 sets it absolutely. `base` is the entry's own released state.
   */
  forViewer(v, j, base) {
    const en = this.entries.get(v);
    if (!en || !j) return base;
    const out = { ...base };
    if (en.pc === j.pc) { out.x = j.sx / 32; out.y = j.sy / 32 + (v.boat ? BOAT_LIFT : 0); out.z = j.sz / 32; }
    else if (en.tc === j.tc) { out.x = (en.m.sx + j.sx - j.msx) / 32; out.y = (en.m.sy + j.sy - j.msy) / 32; out.z = (en.m.sz + j.sz - j.msz) / 32; }
    if (en.rc === j.rc) { out.yaw = j.yaw; out.pitch = j.pitch; }
    if (j.motion && en.vs === j.vs) [out.mx, out.my, out.mz] = j.motion;
    return out;
  }
  /** The entry's lastScaledPosition / 32 (int division) now, for a viewer's own re-list (EntityTracker.updateTrackedEntities runs it after every entry's update). */
  scaled(v) { const en = this.entries.get(v); return en ? [idiv(en.entry.lastX, 32), idiv(en.entry.lastZ, 32)] : null; }
  /** Drops the entries of carts that are gone. */
  prune(live) { for (const v of this.entries.keys()) if (!live.has(v)) this.entries.delete(v); }
}
