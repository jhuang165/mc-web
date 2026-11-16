// b77 mpvelocity77: where a remote rider's copy sits, from the mount's own client copy.
// Natively the viewer's copy of a riding player is attached (S1B(0), `ridingEntity`) and EntityOtherPlayerMP is carried by Entity.updateRidden -> updateRiderPosition:
// position = (mount.x, mount.posY + mount.getMountedYOffset() + rider.getYOffset(), mount.z) every client tick, whatever the position packets say (bytecode-read in b61/b70/b54 for the
// boat, cart and horse seats; the helpers below are the ones the single-player riders use). The row's `riding` is the key of the attached mount: 'b<id>' boat, 'c<id>' cart (remote-vehicles.js
// copies, key -> { v }), 'm<wire id>' a pig or horse (remote-mobs.js copies, wire id -> { client, mob }).
// The feet seat: the rider's getYOffset (yOffset - 0.5) is the port's -0.5 (vehicle-seat.js vehicleSeat, horse-copy.js copySeat).
import { vehicleSeat } from '../vehicle-seat.js';
import { copySeat } from '../horse-copy.js';

// `vehicles`: RemoteVehicles, `mobs`: RemoteMobs (either may be null). Returns the rider's feet { x, y, z } or null when the mount copy is not known (the row's own position is used).
export function mountSeat(key, { vehicles = null, mobs = null } = {}) {
  if (typeof key !== 'string' || key.length < 2) return null;
  if (key[0] === 'b' || key[0] === 'c') {
    const c = vehicles?.copies.get(key);
    return c && !c.v.dead ? vehicleSeat(c.v, -0.5) : null;
  }
  if (key[0] === 'm') {
    const id = Number(key.slice(1)), c = mobs?.copies.get(id) ?? mobs?.copies.get(key.slice(1));
    return c && c.client && (c.mob.type === 'pig' || c.mob.type === 'horse') ? copySeat(c.client, c.mob) : null;
  }
  return null;
}
