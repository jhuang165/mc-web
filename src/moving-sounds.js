// MovingSoundMinecart (bsm.a) and MovingSoundMinecartRiding (bsn.a), the two ITickableSound classes of 1.7.10, replayed against
// audio3-reference.json (tools/probes/AudioProbe3.java, the unchanged classes on Unsafe-allocated carts). Both loop
// (repeat true, delay 0) and are tickable: SoundManager.update calls update() each tick and then hands the sound's volume to
// the sound system. The clips are in the manifest since batch 20, and cart-sounds.js starts these
// classes the way WorldClient.spawnEntityInWorld and EntityClientPlayerMP.mountEntity do (SoundBank.playMoving loops the source).
const f = Math.fround;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const speedOf = (cart) => f(Math.sqrt(cart.mx * cart.mx + cart.mz * cart.mz));

// minecraft:minecart.base, started when a minecart entity appears. cart: { dead, x, y, z, mx, mz }.
export class MovingSoundMinecart {
  constructor(cart) {
    this.cart = cart;
    this.event = "minecart.base";
    this.volume = 1;
    this.distance = 0;
    this.done = false;
    this.canRepeat = true;
    this.repeatDelay = 0;
    this.x = this.y = this.z = 0;
    this.tickable = { update: () => this.update(), donePlaying: () => this.done };
  }
  update() {
    const c = this.cart;
    if (c.dead) { this.done = true; return; }
    this.x = f(c.x); this.y = f(c.y); this.z = f(c.z);
    const speed = speedOf(c);
    if (speed >= 0.01) { // the float speed against the double 0.01
      this.distance = clamp(f(this.distance + f(0.0025)), 0, 1);
      this.volume = f(0 + f(clamp(speed, 0, 0.5) * f(0.7)));
    } else {
      this.distance = 0;
      this.volume = 0;
    }
  }
}
// minecraft:minecart.inside, started when the player mounts a minecart (position stays 0,0,0: NONE attenuation).
// player: { riding: the cart or null }.
export class MovingSoundMinecartRiding {
  constructor(player, cart) {
    this.player = player;
    this.cart = cart;
    this.event = "minecart.inside";
    this.volume = 1;
    this.done = false;
    this.canRepeat = true;
    this.repeatDelay = 0;
    this.tickable = { update: () => this.update(), donePlaying: () => this.done };
  }
  update() {
    const c = this.cart;
    if (c.dead || !this.player.riding || this.player.riding !== c) { this.done = true; return; }
    const speed = speedOf(c);
    this.volume = speed >= 0.01 ? f(0 + f(clamp(speed, 0, 1) * f(0.75))) : 0;
  }
}
