// The client half of the dedicated world's minecarts and boats (batch 61 mpvehicles). The server (server-vehicles.js) sends `vehicles { set, del }`; each vehicle here is a stand-in record
// made by the single-player Minecarts / Boats (every field MinecartRenderer and BoatRenderer read exists) that is never ticked: it only moves to the newest state, one step per client
// tick, with the previous position kept so the renderers' partial-tick interpolation works. The renderers are injected by main.js (they need three.js), `renderers.minecart` and `.boat`.
import { Minecarts } from '../minecarts.js';
import { Boats } from '../boats.js';
import { pickMinecart } from '../structure-simulation.js';
import { ClientHanging } from './client-hanging.js'; // b68 mppaintings
import { waterAcceleration, entityWaterBox } from '../fluids.js';

// b70 carts70: EntityMinecart.setPositionAndRotation2 (xl.a(DDDFFI)V, bytecode-read): the client copy stores the target (minecartX/Y/Z, yaw, pitch) and
// turnProgress = increments + 2; NetHandlerPlayClient passes 3 for the move and teleport packets of an entity (bjb.a(ik) and a(hf)), so 5 ticks.
// EntityMinecart.onUpdate on the client (xl.h): while turnProgress > 0 the position moves (target - pos) / turnProgress, yaw by wrapAngleTo180(target - yaw)
// / turnProgress and pitch likewise, then turnProgress--; otherwise it only re-sets its position. The server tracker (EntityTrackerEntry) sends a minecart
// every 3 ticks (EntityTracker.addEntityToTracker(EntityMinecart, 80, 3, true)), so the newest server state is taken at most that often.
export const CART_TURN_INCREMENTS = 3, CART_TURN_EXTRA = 2, CART_SEND_INTERVAL = 3;
const wrap180 = (a) => { a %= 360; if (a >= 180) a -= 360; if (a < -180) a += 360; return a; }; // MathHelper.wrapAngleTo180_double (qh.g(D))
const fl = Math.fround;
export function cartSetPositionAndRotation2(c, s, increments = CART_TURN_INCREMENTS) {
  c.mx = s.x; c.my = s.y; c.mz = s.z; c.myaw = fl(s.yaw); c.mpitch = fl(s.pitch);
  c.turn = increments + CART_TURN_EXTRA;
}
// One client tick of a cart copy's onUpdate (remote branch). `place(v, x, y, z)` is Minecarts.setPosition.
export function cartClientStep(c, place) {
  const v = c.v;
  v.px = v.x; v.py = v.posY; v.pz = v.z; v.prevYaw = v.yaw; v.prevPitch = v.pitch; // World.updateEntityWithOptionalForce: lastTickPos and prevRotation
  if (c.turn > 0) {
    const t = c.turn, x = v.x + (c.mx - v.x) / t, y = v.posY + (c.my - v.posY) / t, z = v.z + (c.mz - v.z) / t;
    v.yaw = fl(v.yaw + wrap180(c.myaw - v.yaw) / t);
    v.pitch = fl(v.pitch + (c.mpitch - v.pitch) / t);
    c.turn--;
    place(v, x, y, z);
  } else place(v, v.x, v.posY, v.z);
}

// b83 tracker83: a boat state with `bc` comes from the boat's tracker entry (server-cart-track.js): its position is the client entity's serverPos, `vs` counts the S12s and
// `mx/my/mz` is the last one. EntityBoat on a client world with isBoatEmpty true (every boat but the client player's own, bytecode-read bjb.a(S1B)):
//   * setVelocity (S12): motion and velocityX/Y/Z = the packet; setPositionAndRotation2 (a position packet): the target, boatPosRotationIncrements = 3 + 5, motion = velocityX/Y/Z.
//   * onUpdate (xi.h, executed for the numbers in tracker-vehicles-reference.json `boatGlide`): handleWaterMovement first (the flow push into the motion), then with increments left
//     the step towards the target (position by (target - pos) / n, yaw by wrapAngleTo180(target - yaw) / n, pitch likewise, then % 360), else the coast on the motion
//     (pos += motion, then 0.99F / 0.95F / 0.99F). So a boat a blast throws flies on its S12 between the 3-tick position packets.
// Not modelled here: the copy's splash sound draws and particles (ObjectClient.waterMovement / splash in single player), onGround's halving (the copy never runs moveEntity).
export const BOAT_TURN_EXTRA = 5;
const DRAG_H = fl(0.99), DRAG_V = fl(0.95);
export function boatSetVelocity(c, s) { c.cv = [s.mx ?? 0, s.my ?? 0, s.mz ?? 0]; c.vs = s.vs; [c.v.vx, c.v.vy, c.v.vz] = c.cv; }
export function boatSetPositionAndRotation2(c, s, increments = CART_TURN_INCREMENTS) {
  c.bt = { x: s.x, y: s.y, z: s.z, yaw: fl(s.yaw), pitch: fl(s.pitch), inc: increments + BOAT_TURN_EXTRA };
  [c.v.vx, c.v.vy, c.v.vz] = c.cv ?? [0, 0, 0];
}
// One client tick of a tracked boat copy. `place(v, x, y, z)` is Boats.setPosition; `world` gives the water push (null: none).
export function boatClientStep(c, place, world = null) {
  const v = c.v;
  v.px = v.x; v.py = v.posY; v.pz = v.z; v.prevYaw = v.yaw; v.prevPitch = v.pitch;
  v.vx ??= 0; v.vy ??= 0; v.vz ??= 0;
  if (world && v.bb) { const w = waterAcceleration(world, entityWaterBox(v.bb)); if (w.wet) { v.vx += w.push[0]; v.vy += w.push[1]; v.vz += w.push[2]; } }
  const t = c.bt;
  if (t && t.inc > 0) {
    const n = t.inc;
    const x = v.x + (t.x - v.x) / n, y = v.posY + (t.y - v.posY) / n, z = v.z + (t.z - v.z) / n;
    v.yaw = fl(fl(v.yaw + wrap180(t.yaw - v.yaw) / n) % 360);
    v.pitch = fl(fl(v.pitch + (t.pitch - v.pitch) / n) % 360);
    t.inc--;
    place(v, x, y, z);
    return;
  }
  place(v, v.x + v.vx, v.posY + v.vy, v.z + v.vz);
  v.vx *= DRAG_H; v.vy *= DRAG_V; v.vz *= DRAG_H;
}

export class RemoteVehicles {
  constructor(world) {
    this.world = world;
    this.carts = new Minecarts();
    this.boats = new Boats();
    this.copies = new Map(); // key -> { v (record), target (state) }
    this.renderers = null;
    this.hanging = new ClientHanging(); // b68 mppaintings: paintings, item frames and knots (the message's hset / hdel)
  }
  // The `vehicles` message: the newest state of each vehicle in range, and the keys that left.
  apply(message) {
    this.hanging.apply(message); // b68 mppaintings
    for (const s of message.set ?? []) {
      if (typeof s?.v !== 'string' || ![s.x, s.y, s.z, s.yaw, s.pitch].every(Number.isFinite)) continue;
      let c = this.copies.get(s.v);
      const fresh = !c;
      if (!c) {
        const boat = s.v[0] === 'b';
        const v = boat ? this.boats.spawnBoat({ x: s.x, y: s.y, z: s.z, yaw: s.yaw }) : this.carts.spawnCart(Number.isInteger(s.t) ? s.t : 0, { x: s.x, y: s.y, z: s.z, items: [] });
        (boat ? this.boats : this.carts).setPosition(v, s.x, s.y, s.z);
        Object.assign(v, { px: s.x, py: s.y, pz: s.z, yaw: s.yaw, pitch: s.pitch, prevYaw: s.yaw, prevPitch: s.pitch });
        c = { v, target: s, turn: 0, since: CART_SEND_INTERVAL, pending: null };
        this.copies.set(s.v, c);
        if (boat && s.bc === 1) { boatSetVelocity(c, s); c.bt = null; } // b83 tracker83: the S0E (data 0: no motion), then the spawn's S12
      }
      c.target = s;
      // b70: a cart takes the state through cartSetPositionAndRotation2 on the tracker's cadence (tick). b71 mpreach71: a server that sends `cartCadence` already released it at the
      // tracker cadence (take it at once), and `cartMeta` states carry no new position (only the data fields below)
      if (!c.v.boat && !(message.cartCadence && s.cartMeta)) { c.pending = s; if (message.cartCadence) c.since = CART_SEND_INTERVAL; }
      const v = c.v;
      if (v.boat) { // b83 tracker83: a tracked boat takes the S12 when its count moved, then the position packet (cartMeta: none this time); a plain state (an older server, or the boat this player rides) snaps in tick
        c.tracked = s.bc === 1;
        if (c.tracked && !fresh) { if (s.vs !== c.vs) boatSetVelocity(c, s); if (!s.cartMeta) boatSetPositionAndRotation2(c, s); } else if (!c.tracked) c.bt = null;
      }
      if (v.boat) { v.timeSinceHit = s.th ?? 0; v.damage = s.dm ?? 0; v.forwardDir = s.fd ?? 1; } else {
        if (v.type === 6 && v.command && typeof s.cmd === 'string') v.command.command = s.cmd; // b63: watcher 23, what the command cart's GUI shows
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
    for (const c of this.copies.values()) {
      const { v, target: s } = c;
      if (!v.boat) { // b70 carts70: the native client copy interpolates over turnProgress ticks
        c.since++;
        if (c.pending && c.since >= CART_SEND_INTERVAL) { cartSetPositionAndRotation2(c, c.pending); c.pending = null; c.since = 0; }
        cartClientStep(c, (cv, x, y, z) => this.carts.setPosition(cv, x, y, z));
        continue;
      }
      if (c.tracked) { boatClientStep(c, (bv, x, y, z) => this.boats.setPosition(bv, x, y, z), this.world); continue; } // b83 tracker83
      v.px = v.x; v.py = v.posY; v.pz = v.z; v.prevYaw = v.yaw; v.prevPitch = v.pitch;
      (v.boat ? this.boats : this.carts).setPosition(v, s.x, s.y, s.z);
      v.yaw = s.yaw; v.pitch = s.pitch;
    }
  }
  // b72 mpstream72: the carts and boats standing in an unloaded column (keys `cx,cz`) leave the client world (Chunk.onChunkUnload).
  dropColumns(columns) { const del = []; for (const [k, c] of this.copies) if (columns.has(`${Math.floor(c.v.x / 16)},${Math.floor(c.v.z / 16)}`)) del.push(k); if (del.length) this.apply({ del }); }
  keyOf(v) { for (const [k, c] of this.copies) if (c.v === v) return k; return null; }
  // EntityRenderer.getMouseOver on the copies' boxes: the nearest vehicle the ray reaches (the 0.1 border included). Returns { key, vehicle, distance } or null.
  pick(origin, dir, reach, wall = reach, ignore = null) { // `ignore`: the key of the vehicle the player sits in
    const skip = ignore && this.copies.get(ignore)?.v, a = pickMinecart(this.carts, origin, dir, reach, wall, skip), b = pickMinecart(this.boats, origin, dir, reach, wall, skip), best = a && (!b || a.distance <= b.distance) ? a : b;
    const veh = best ? { key: this.keyOf(best.cart), vehicle: best.cart, distance: best.distance } : null, hang = this.hanging.pick(origin, dir, reach, wall); // b68 mppaintings
    return hang && (!veh || hang.distance < veh.distance) ? hang : veh;
  }
  draw(partial, hidden = false) {
    if (!this.renderers) return;
    this.renderers.minecart.update(hidden ? [] : this.carts.carts, partial, this.world);
    this.renderers.boat.update(hidden ? [] : this.boats.carts, partial, this.world);
    this.renderers.hanging?.update(hidden ? [] : this.hanging.list()); // b68 mppaintings
  }
  clear() {
    this.renderers?.minecart.clear(); this.renderers?.boat.clear(); this.renderers?.hanging?.clear(); this.hanging.clear();
    this.copies.clear(); this.carts.carts.length = 0; this.boats.carts.length = 0;
  }
}
