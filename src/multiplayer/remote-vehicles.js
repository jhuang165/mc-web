// The client half of the dedicated world's minecarts and boats (batch 61 mpvehicles). The server (server-vehicles.js) sends `vehicles { set, del }`; each vehicle here is a stand-in record
// made by the single-player Minecarts / Boats (every field MinecartRenderer and BoatRenderer read exists) that is never ticked: it only moves to the newest state, one step per client
// tick, with the previous position kept so the renderers' partial-tick interpolation works. The renderers are injected by main.js (they need three.js), `renderers.minecart` and `.boat`.
import { Minecarts } from '../minecarts.js';
import { Boats, boatClearCell } from '../boats.js';
import { JavaRandom } from '../java-random.js';
import { pickMinecart } from '../structure-simulation.js';
import { ClientHanging } from './client-hanging.js'; // b68 mppaintings
import { waterAcceleration, entityWaterBox } from '../fluids.js';
import { enterWater } from '../fx.js';
import { moveInput } from '../player-movement.js';
import { vehicleSeat } from '../vehicle-seat.js';

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
// b84 mpboat84: the copy's own draws on its Entity.rand (xi.h and sa.C run on a client world too, bytecode-read):
//   * sa.N (handleWaterMovement, inside sa.h -> onEntityUpdate before xi.h's own code): entering water after the first update draws the splash sound's two floats (RenderGlobal.playSound is empty:
//     silent), then 1 + 1.5 * 20 "bubble" and as many "splash" over the width at floor(minY) + 1 (fx.js enterWater); firstUpdate clears after it.
//   * xi.h's loop before the isRemote test: with horizontal speed d > 0.2625, 1 + d * 60 "splash" (nextFloat, nextInt(2), nextBoolean per draw) at posY - 0.125 with the motion as velocity.
//   * Not modelled: onGround's halving in the coast (the copy never runs moveEntity).
// The rider's own boat (isBoatEmpty false after bjb.a(S1B) with the local player): see ownBoatStep.
export const BOAT_TURN_EXTRA = 5;
const DRAG_H = fl(0.99), DRAG_V = fl(0.95);
export function boatSetVelocity(c, s) { c.cv = [s.mx ?? 0, s.my ?? 0, s.mz ?? 0]; c.vs = s.vs; [c.v.vx, c.v.vy, c.v.vz] = c.cv; }
export function boatSetPositionAndRotation2(c, s, increments = CART_TURN_INCREMENTS) {
  c.bt = { x: s.x, y: s.y, z: s.z, yaw: fl(s.yaw), pitch: fl(s.pitch), inc: increments + BOAT_TURN_EXTRA };
  [c.v.vx, c.v.vy, c.v.vz] = c.cv ?? [0, 0, 0];
}
// One client tick of a tracked boat copy. `place(v, x, y, z)` is Boats.setPosition; `world` gives the water push (null: none).
export function boatClientStep(c, place, world = null, fx = null) {
  const v = c.v;
  v.px = v.x; v.py = v.posY; v.pz = v.z; v.prevYaw = v.yaw; v.prevPitch = v.pitch;
  v.vx ??= 0; v.vy ??= 0; v.vz ??= 0;
  v.random ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48)); // Entity.rand
  if (world && v.bb) {
    const w = waterAcceleration(world, entityWaterBox(v.bb));
    if (w.wet) { v.vx += w.push[0]; v.vy += w.push[1]; v.vz += w.push[2]; if (!v.inWater && !v.firstUpdate) enterWater(fx, { x: v.x, z: v.z, minY: v.bb[1], width: BOAT_W, mx: v.vx, my: v.vy, mz: v.vz }, v.random); }
    v.inWater = w.wet;
  }
  v.firstUpdate = false;
  boatWake(v, fx);
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

const BOAT_W = fl(1.5);
// xi.h's speed splash: the horizontal motion over 0.2625 throws 1 + d * 60 "splash" behind and beside the hull (the same draws as boats.js tickBoat).
function boatWake(v, fx) {
  const d = Math.sqrt(v.vx * v.vx + v.vz * v.vz);
  if (!(d > 0.26249999999999996)) return;
  const rad = v.yaw * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad), r = v.random;
  for (let j = 0; j < 1 + d * 60; j++) {
    const a = fl(fl(r.nextFloat() * 2) - 1), b = (r.nextInt(2) * 2 - 1) * 0.7;
    if (r.nextBoolean()) fx?.spawn('splash', v.x - cs * a * 0.8 + sn * b, v.posY - 0.125, v.z - sn * a * 0.8 - cs * b, v.vx, v.vy, v.vz);
    else fx?.spawn('splash', v.x + cs + sn * a * 0.7, v.posY - 0.125, v.z + sn - cs * a * 0.7, v.vx, v.vy, v.vz);
  }
}

// b84 mpboat84: the rider's own boat. bjb.a(S1B) with the local player aboard calls setIsBoatEmpty(false) (another rider's attach calls it with true), so the client runs xi.h's whole physics:
// the buoyancy, the rider's steering (EntityLivingBase moveForward / moveStrafing, yaw), the speed, the move and the drag; the splash draws come with it (Boats.tickBoat). Server packets reach it only
// through xi.a(DDDFFI) and xi.i (bytecode-read): a position packet whose target is over one block (squared distance > 1) away only sets boatPosRotationIncrements = 3 and motion = the last S12, and
// a nearer one is dropped; the position and angles are never set from it (the increments are read only in the isBoatEmpty branch). An S12 sets the motion. The state carries `own` with the entry's
// released position (tx/ty/tz), S12 (mx/my/mz, count vs) and position-packet count rs.
// b86 seat86: `move` is the input whose moveForward / moveStrafing the boat reads (default: `input`); the yaw is always `input`'s. MovementInputFromOptions (blj) scales a sneaking
// player's input by 0.3D, so the rider's record does too.
export function riderRecord(input, move = input) {
  const p = riderPacket(move ?? {});
  return { yaw: fl(180 - input.yaw * 180 / Math.PI), moveForward: p.f, moveStrafing: p.s, dead: false };
}
// b86 seat86: what a riding client sends each tick (bytecode-read bjk.h, EntityClientPlayerMP.onUpdate): after its own update, `if (isRiding())` C05 Look(rotationYaw,
// rotationPitch, onGround) then C0C Input(moveStrafing, moveForward, movementInput.jump, movementInput.sneak); sendMotionUpdates (bjk.a, with the C0B sneak / sprint changes and
// its own `ridingEntity != null` C06(motionX, -999, -999, motionZ) branch) runs only when not riding, so that C06 is never sent by bjk.h. moveForward / moveStrafing are the
// movement input (blj: +-1, x 0.3D sneaking; the 0.2 item-use slowdown is skipped while riding, blk.e) times sv.e's 0.98F. The port's yaw / pitch already travel in `input`
// (the C05; its onGround is false for a rider: Entity.updateRidden zeroes the motion before onUpdate, so moveEntity never lands); this is the C0C:
// { s: moveStrafing, f: moveForward, j: jump, k: sneak } (port strafe is to the right, native moveStrafing to the left).
export function riderPacket(controls = {}) {
  const sneak = !!controls.sneak, i = moveInput({ forward: controls.forward ?? 0, strafe: controls.strafe ?? 0, sneak });
  return { s: fl(-i.strafe * fl(0.98)), f: fl(i.forward * fl(0.98)), j: !!controls.jump, k: sneak };
}
// b85 boatseat85: nothing puts the copy back on the server's boat any more (the b84 two-block snap is gone); the local player is seated on this copy (RemoteVehicles.seatOf, main.js).
// `seated` false: the player left but the copy is still isBoatEmpty false (bjb.a(S1B) only calls setIsBoatEmpty for an attach packet whose vehicle is a boat: the dismount's S1B with vehicle -1
// changes nothing), so it keeps running xi.h's full physics, with no rider input, until another player's attach sets it true (RemoteVehicles.noteRiders).
// xi.h clears the snow layers and lily pads at its four corners with no isRemote guard (World.setBlockToAir / breakBlock(true); a client world's drops are none): `clear(x, y, z, block)` does it on the client world.
// b86 seat86: the lily pad's World.func_147480_a(x, y, z, true) (ahb.a(IIIZ), bytecode-read) plays level event 2001 first, on a client world through RenderGlobal (bma: the break
// sound and the destroy particles at the cell): `aux(2001, x, y, z, block + (meta << 12))`; its dropBlockAsItem drops nothing on a client world. A snow layer (ahb.f, setBlockToAir)
// plays nothing. The server's own boat breaks the same pad and sends its S28 2001 to every player within 64 blocks, the rider included (server-vehicles.js), so the rider sees both.
// `prev` is the input of the tick before: World.updateEntities skips a rider and updates it from its mount after the mount's onUpdate (ahb.h offsets 323-348, ahb.a(sa, Z)
// 454-503, bytecode-read), so the client boat's xi.h reads the moveForward / moveStrafing the player computed on the previous tick (and rotationYaw as it is now).
export function ownBoatStep(c, boats, world, fx = null, input = null, clear = null, aux = null, prev = input) {
  const v = c.v;
  v.remote = true; v.rider = c.seated === false ? null : riderRecord(input ?? { yaw: 0 }, prev ?? {});
  const hooks = { clear: (x, y, z, block) => boatClearCell(world, x, y, z, block, { aux, set: (cx, cy, cz) => { world.put(cx, cy, cz, 0, 0, false); clear?.(cx, cy, cz, block); } }) };
  for (const p of boats.tickBoat(world, v, [], hooks)) fx?.spawn(...p);
}
// The packets of the rider's boat (see above): `s` is the state with `own`. Returns nothing; updates c.cv / c.vs / c.rs and the motion.
export function ownBoatPackets(c, s) {
  const v = c.v;
  if (s.vs !== c.vs) { c.cv = [s.mx ?? 0, s.my ?? 0, s.mz ?? 0]; c.vs = s.vs; [v.vx, v.vy, v.vz] = c.cv; } // xi.i: setVelocity
  if (s.rs !== c.rs) { // xi.a(DDDFFI) with isBoatEmpty false
    c.rs = s.rs;
    if ((s.tx - v.x) ** 2 + (s.ty - v.posY) ** 2 + (s.tz - v.z) ** 2 > 1) [v.vx, v.vy, v.vz] = c.cv ?? [0, 0, 0];
  }
}

export class RemoteVehicles {
  constructor(world) {
    this.world = world;
    this.carts = new Minecarts();
    this.boats = new Boats();
    this.copies = new Map(); // key -> { v (record), target (state) }
    this.renderers = null;
    this.fx = null; // b84 mpboat84: { spawn(name, x, y, z, vx, vy, vz) }, the particle sink of the boat copies (main.js)
    this.input = null;
    this.cleared = null; // b85 boatseat85: (x, y, z, block) after the own boat cleared a snow layer or lily pad on the client world (main.js remeshes)
    this.aux = null; // b86 seat86: (id, x, y, z, data), the client world's level event of the own boat's lily pad break (main.js draws it as an S28 2001)
    this.prevInput = null; // b86 seat86: the input of the last tick() (the rider's moveForward the boat reads); set at the end of tick()
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
      if (v.boat && (s.own === 1 || c.own)) { // b84 mpboat84: the state of the boat this player rides (exact, with the entry's packets); b85 boatseat85: and the one it left (isBoatEmpty stays false)
        c.tracked = false;
        if (c.own) ownBoatPackets(c, s.own === 1 ? s : { ...s, tx: s.x, ty: s.y, tz: s.z }); else { c.vs = s.vs; c.rs = s.rs; c.cv = [s.mx ?? 0, s.my ?? 0, s.mz ?? 0]; }
      } else if (v.boat) { // b83 tracker83: a tracked boat takes the S12 when its count moved, then the position packet (cartMeta: none this time); a plain state (an older server, or the boat this player rides) snaps in tick
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
  // b84 mpboat84: the key of the boat the local player rides (self.riding) or null, and this tick's input { yaw (radians), forward, strafe }; call before tick().
  // b85 boatseat85: a boat the player leaves stays `own` (isBoatEmpty false, no rider) until noteRiders sees another attach.
  ride(key, input = null) {
    this.input = input;
    for (const [k, c] of this.copies) if (c.seated && k !== key) { c.seated = false; c.v.rider = null; }
    const c = key && this.copies.get(key);
    if (c && c.v.boat && !c.seated) { c.seated = true; c.own = true; c.tracked = false; c.bt = null; c.v.remote = true; c.cv ??= [0, 0, 0]; }
  }
  // b85 boatseat85: the local player's feet on the boat copy he rides (Entity.updateRiderPosition: the client player follows the client boat), or null when he is not seated on a running copy.
  seatOf(key) { const c = typeof key === 'string' && this.copies.get(key); return c && c.v.boat && c.seated && c.own && !c.v.dead ? vehicleSeat(c.v, -0.5) : null; }
  // b85 boatseat85: bjb.a(S1B) for another rider attaching to a boat sets isBoatEmpty true: `keys` are the boats the other players ride now; a key new since the last call ends the own physics.
  noteRiders(keys) {
    const now = new Set(keys), before = this.others ?? new Set();
    for (const k of now) if (!before.has(k)) { const c = this.copies.get(k); if (c?.v.boat && c.own && !c.seated) { c.own = false; c.tracked = c.target.bc === 1; c.bt = null; c.v.rider = null; } }
    this.others = now;
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
      if (c.own && this.world) { ownBoatStep(c, this.boats, this.world, this.fx, this.input, (x, y, z, block) => this.cleared?.(x, y, z, block), (...a) => this.aux?.(...a), this.prevInput); continue; } // b84 mpboat84 / b85 boatseat85 / b86 seat86
      if (c.tracked) { boatClientStep(c, (bv, x, y, z) => this.boats.setPosition(bv, x, y, z), this.world, this.fx); continue; } // b83 tracker83
      v.px = v.x; v.py = v.posY; v.pz = v.z; v.prevYaw = v.yaw; v.prevPitch = v.pitch;
      (v.boat ? this.boats : this.carts).setPosition(v, s.x, s.y, s.z);
      v.yaw = s.yaw; v.pitch = s.pitch;
    }
    this.prevInput = this.input; // b86 seat86: the player's own update follows its boat's (World.updateEntities)
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
