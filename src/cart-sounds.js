// Starts the minecart moving sounds (moving-sounds.js) from the port's minecart list. 1.7.10 does it in two places, read from
// the bytecode of the unchanged client: WorldClient.spawnEntityInWorld (bjf.d) plays a MovingSoundMinecart when an EntityMinecart
// (xl) was added to a loaded world, and EntityClientPlayerMP.mountEntity (bjk.a) plays a MovingSoundMinecartRiding when the entity
// it mounts is an EntityMinecart. Here both are detected once per tick: a cart seen for the first time, and the player's vehicle
// becoming a cart. Boats and horses are not EntityMinecart. `sounds` is the SoundBank (playMoving, epoch).
import { MovingSoundMinecart, MovingSoundMinecartRiding } from "./moving-sounds.js";

// The probed classes read x, y, z, mx, mz and dead of the entity; the port keeps its motion as vx / vz and its position as posY.
const asEntity = (c) => ({
  get dead() { return c.dead; },
  get x() { return c.x; }, get y() { return c.posY; }, get z() { return c.z; },
  get mx() { return c.vx; }, get mz() { return c.vz; },
});

export class CartSounds {
  constructor(sounds) {
    this.sounds = sounds;
    this.seen = new WeakMap(); // cart -> its entity view
    this.riding = null; // the cart the riding sound was started for
    this.epoch = sounds.epoch ?? 0;
  }
  // carts: the live minecart entities; rider: the player's rider state (rider.vehicle is the mount or null).
  tick(carts, rider) {
    const vehicle = rider.vehicle;
    if (this.epoch !== (this.sounds.epoch ?? 0)) { // stopAllSounds: the sounds are gone, entities not yet seen again
      this.epoch = this.sounds.epoch ?? 0;
      this.seen = new WeakMap();
      this.riding = null;
    }
    for (const c of carts) {
      if (c.dead || this.seen.has(c)) continue;
      const entity = asEntity(c);
      this.seen.set(c, entity);
      this.sounds.playMoving(new MovingSoundMinecart(entity));
    }
    const cart = vehicle && !vehicle.boat && !vehicle.horse && this.seen.has(vehicle) ? vehicle : null;
    if (cart !== this.riding) {
      this.riding = cart;
      if (cart) {
        const entity = this.seen.get(cart);
        this.sounds.playMoving(new MovingSoundMinecartRiding({ get riding() { return rider.vehicle === cart ? entity : null; } }, entity));
      }
    }
  }
}
