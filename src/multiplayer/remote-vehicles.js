// The client half of the dedicated world's minecarts and boats (batch 61 mpvehicles). The server (server-vehicles.js) sends `vehicles { set, del }`; each vehicle here is a stand-in record
// made by the single-player Minecarts / Boats (every field MinecartRenderer and BoatRenderer read exists) that is never ticked: it only moves to the newest state, one step per client
// tick, with the previous position kept so the renderers' partial-tick interpolation works. The renderers are injected by main.js (they need three.js), `renderers.minecart` and `.boat`.
import { Minecarts } from '../minecarts.js';
import { Boats } from '../boats.js';
import { pickMinecart } from '../structure-simulation.js';

export class RemoteVehicles {
  constructor(world) {
    this.world = world;
    this.carts = new Minecarts();
    this.boats = new Boats();
    this.copies = new Map(); // key -> { v (record), target (state) }
    this.renderers = null;
  }
  // The `vehicles` message: the newest state of each vehicle in range, and the keys that left.
  apply(message) {
    for (const s of message.set ?? []) {
      if (typeof s?.v !== 'string' || ![s.x, s.y, s.z, s.yaw, s.pitch].every(Number.isFinite)) continue;
      let c = this.copies.get(s.v);
      if (!c) {
        const boat = s.v[0] === 'b';
        const v = boat ? this.boats.spawnBoat({ x: s.x, y: s.y, z: s.z, yaw: s.yaw }) : this.carts.spawnCart(Number.isInteger(s.t) ? s.t : 0, { x: s.x, y: s.y, z: s.z, items: [] });
        (boat ? this.boats : this.carts).setPosition(v, s.x, s.y, s.z);
        Object.assign(v, { px: s.x, py: s.y, pz: s.z, yaw: s.yaw, pitch: s.pitch, prevYaw: s.yaw, prevPitch: s.pitch });
        c = { v, target: s };
        this.copies.set(s.v, c);
      }
      c.target = s;
      const v = c.v;
      if (v.boat) { v.timeSinceHit = s.th ?? 0; v.damage = s.dm ?? 0; v.forwardDir = s.fd ?? 1; } else {
        v.rolling = s.rl ?? 0; v.rollingDir = s.rd ?? 1; v.damage = s.dm ?? 0; v.lit = !!s.lit; v.fuse = s.fuse ?? -1;
      }
    }
    for (const key of message.del ?? []) {
      const c = this.copies.get(key);
      if (!c) continue;
      c.v.dead = true;
      this.copies.delete(key);
    }
    this.carts.reap(); this.boats.reap();
  }
  // One client tick: the previous state is kept, the copy moves to the newest.
  tick() {
    for (const { v, target: s } of this.copies.values()) {
      v.px = v.x; v.py = v.posY; v.pz = v.z; v.prevYaw = v.yaw; v.prevPitch = v.pitch;
      (v.boat ? this.boats : this.carts).setPosition(v, s.x, s.y, s.z);
      v.yaw = s.yaw; v.pitch = s.pitch;
    }
  }
  keyOf(v) { for (const [k, c] of this.copies) if (c.v === v) return k; return null; }
  // EntityRenderer.getMouseOver on the copies' boxes: the nearest vehicle the ray reaches (the 0.1 border included). Returns { key, vehicle, distance } or null.
  pick(origin, dir, reach, wall = reach, ignore = null) { // `ignore`: the key of the vehicle the player sits in
    const skip = ignore && this.copies.get(ignore)?.v, a = pickMinecart(this.carts, origin, dir, reach, wall, skip), b = pickMinecart(this.boats, origin, dir, reach, wall, skip), best = a && (!b || a.distance <= b.distance) ? a : b;
    return best ? { key: this.keyOf(best.cart), vehicle: best.cart, distance: best.distance } : null;
  }
  draw(partial, hidden = false) {
    if (!this.renderers) return;
    this.renderers.minecart.update(hidden ? [] : this.carts.carts, partial, this.world);
    this.renderers.boat.update(hidden ? [] : this.boats.carts, partial, this.world);
  }
  clear() {
    this.renderers?.minecart.clear(); this.renderers?.boat.clear();
    this.copies.clear(); this.carts.carts.length = 0; this.boats.carts.length = 0;
  }
}
