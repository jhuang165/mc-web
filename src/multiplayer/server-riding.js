// Riding a saddled pig on the dedicated server (batch 62 mpriding2). The single-player rules are reused: EntityPig.interact's mount (EntityWorld.pigMount, pig-saddle-live.js), the
// seat system `horseSeats` (horse-live.js: updateRiderPosition, dismount), the steering task `ControlledByPlayer` (ai.js, carrot on a stick, boost) and the stick wear
// (`stickUse` / `wearStick`, a broken stick turns into a fishing rod). The player's record is the one ServerVehicles keeps (`riderOf`); its `vehicle` is the pig's seat entry.
//
// ServerVehicles holds `p.mount = { key: 'm<wire id>', mob, rider }` for a pig rider, so presence (`riding`), the sneak dismount and the seat copy are the cart code's.
// No new wire message: the ride is the rider's position, `riding` in presence, and the pig's own `mobs` packets (remote-mobs.js).
//
// Native facts: EntityPig.interact mounts a saddled pig after EntityAnimal.interact (feeding) declined, and only while the seat is free; Entity.fall passes the fall on to the rider
// (entities.js fall: EntityPig); `flyPig` is awarded when a pig with a rider lands from more than 5 blocks (achievements-live.js pigFall, main.js onLand).
import { pigFall } from '../achievements-live.js';
import { CARROT_ON_A_STICK } from '../pig-saddle.js';

export class ServerRiding {
  // `host`: the DedicatedSimulation. `vehicles`: ServerVehicles (riderOf, seat).
  constructor(host, vehicles) {
    this.host = host; this.vehicles = vehicles;
    const mobs = host.mobs.mobs, prev = mobs.onLand;
    mobs.onLand = (e, distance) => { // flyPig: a pig with a rider lands from more than 5 blocks (the rider is the player who mounted it)
      prev?.call(mobs, e, distance);
      const rider = e.type === 'pig' && e.rider?.ref;
      if (rider && pigFall(distance, true)) host.achievements?.award(rider, 'flyPig');
    };
  }
  get mobs() { return this.host.mobs.mobs; }
  // The mob a player rides, or null.
  mobOf(p) { return p.mount?.mob ?? null; }
  // EntityPig.interact after the feed declined: true when the pig took (or already holds) the player.
  mount(p, e) {
    const sv = this.vehicles;
    if (p.mount && p.mount.mob !== e) return false;
    const rider = sv.riderOf(p), seats = this.mobs.horseSeats;
    seats.player = rider;
    if (!this.mobs.pigMount(e, seats)) return false;
    if (!p.mount) { p.mount = { key: 'm' + String(e.id).replace(/^mob-/, ''), mob: e, rider }; sv.seat(p); }
    return true;
  }
  // The pig is alive and still holds this rider.
  keeps(p) { const m = p.mount, e = m.mob; return e.health > 0 && this.mobs.entities.includes(e) && e.rider === m.rider; }
  // After the mobs' tick: the seat follows the pig.
  follow(p) { this.mobs.horseSeats.updateRiderPosition(p.mount.rider.vehicle); }
  leave(p) { this.mobs.horseSeats.dismount(this.host.world, p.mount.rider, true); }
  // ItemCarrotOnAStick.onItemRightClick: the boost (7 durability), true when the stick was used. The hotbar change reaches the client through ServerItems.settle.
  stick(p) {
    if (!p.mount?.mob || p.survival.held?.id !== CARROT_ON_A_STICK) return false;
    return !!this.mobs.stickUse(p.survival, p.mount.rider);
  }
}
