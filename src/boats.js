// EntityBoat (xi), ItemBoat (abj) and the Entity.onEntityUpdate / moveEntity parts a boat uses, from the
// Minecraft Java 1.7.10 JAR: a 1.5 x 0.6 box with yOffset 0.3, buoyancy from five 0.12-high water slices
// (each 0.125 below its slice), the rider's forward/strafe input and yaw scaled by speedMultiplier
// (0.07..0.35), the 0.35 speed cap, drag (0.99, 0.95 vertically), the speed > 0.2 collision break (3 planks and
// 2 sticks), the fall > 3 break, snow layers and lily pads cleared around it, splash particles above 0.2625
// speed, wobble (timeSinceHit, damageTaken, forwardDirection) and the player-hit break (above 40 damage, or any
// Creative hit with no drop). Replayed against the unchanged classes in src/boats.test.js
// (tools/probes/BoatProbe.java, public/research/boat-reference.json).
//
// Boats reuse the Minecarts bookkeeping (a `carts` list, pickable(), drain(), boxes(), mount/dismount)
// with an empty rail table. Like a cart, a boat keeps posY (the native field) and its box `bb`; `y` is the
// box bottom. Riders use the same feet convention as carts (vehicle-simulation.js).
import { ensureUuid, isUuid } from "./entity-uuid.js";
import { Minecarts } from "./minecarts.js";
import { recordBirth } from "./tracker-birth.js";
import { WATER, SNOW_LAYER, LILY_PAD } from "./world.js";
import { blockCollisions } from "./block-collisions.js";
import { entityWaterBox, waterAcceleration, inLava } from "./fluids.js";
import { traceBucket } from "./buckets.js";
import { ringEntityActive } from "./streaming-ticks.js";
import { JavaRandom } from "./java-random.js";

const f = Math.fround;
export const BOAT_ITEM = 495, PLANKS = 7, STICK = 300;
export const BOAT_WIDTH = f(1.5), BOAT_HEIGHT = f(0.6), BOAT_Y_OFFSET = f(BOAT_HEIGHT / 2);
const HALF = f(BOAT_WIDTH / 2);
const MIN_SPEED = 0.07, MAX_SPEED = 0.35, BREAK_DAMAGE = 40;
const intersects = (a, b) => b[3] > a[0] && b[0] < a[3] && b[4] > a[1] && b[1] < a[4] && b[5] > a[2] && b[2] < a[5];
const wrap180 = (a) => { a %= 360; if (a >= 180) a -= 360; if (a < -180) a += 360; return a; };

export class Boats extends Minecarts {
  constructor(options = {}) {
    super({ rails: {}, ...options });
    this.isBoats = true;
  }
  get boats() { return this.carts; }

  // EntityBoat(world, x, y, z): setPosition(x, y + yOffset, z); `yaw` is applied by the caller (ItemBoat).
  spawnBoat({ x, y, z, yaw = 0, vx = 0, vy = 0, vz = 0 }, { seed, born = false } = {}) {
    const boat = {
      id: this.nextId++, boat: true, type: 0, rider: null, x: 0, posY: 0, z: 0, y: 0, bb: null, vx, vy, vz,
      yaw: f(yaw), pitch: 0, prevYaw: f(yaw), prevPitch: 0, onGround: false, collidedH: false, fallDistance: 0, inWeb: false, inWater: false, fire: 0,
      timeSinceHit: 0, damage: 0, forwardDir: 1, speed: 0.07, dead: false, height: BOAT_HEIGHT, wet: false, firstUpdate: true,
    };
    boat.random = seed === undefined ? this.makeRandom(boat) : new JavaRandom(seed);
    this.setPosition(boat, x, y + BOAT_Y_OFFSET, z);
    boat.px = boat.x; boat.py = boat.posY; boat.pz = boat.z;
    if (born) recordBirth(boat); // World.spawnEntityInWorld -> EntityTracker.trackEntity: the tracker entry starts with this state (tracker-birth.js)
    this.carts.push(boat);
    this.joined?.(boat); // entity-simulation.js (entityWalkers): the boat's place in World.loadedEntityList
    return boat;
  }
  // Entity.setPosition: the box from posY - yOffset.
  setPosition(boat, x, y, z) {
    boat.x = x; boat.posY = y; boat.z = z;
    const minY = y - BOAT_Y_OFFSET;
    boat.bb = [x - HALF, minY, z - HALF, x + HALF, minY + BOAT_HEIGHT, z + HALF];
    boat.y = minY;
  }
  // EntityBoat.getMountedYOffset = height * 0.0 - 0.3; Entity.updateRiderPosition puts the rider 0.4 ahead of
  // the centre along the boat's yaw. Browser riders use feet, so the rider's getYOffset (yOffset - 0.5) is applied.
  updateRiderPosition(boat) {
    if (!boat.rider) return;
    const a = boat.yaw * Math.PI / 180, d0 = Math.cos(a) * 0.4, d1 = Math.sin(a) * 0.4;
    Object.assign(boat.rider, { x: boat.x + d0, y: boat.posY + this.getMountedYOffset() - 0.5, z: boat.z + d1 });
  }
  // EntityBoat.interactFirst: a rider that is not the clicker blocks it; the clicker mounts.
  mount(boat, rider, { sneaking = false } = {}) {
    if (boat.dead || sneaking || boat.rider || boat.passenger || rider.vehicle) return false;
    boat.rider = rider; rider.vehicle = boat;
    this.updateRiderPosition(boat);
    return true;
  }

  // World.getCollidingBoundingBoxes for a boat: as for a cart, plus the box of a snow layer (BlockSnow gives a flat layer a
  // zero-height box that still stops a boat dipping below it).
  boxes(world, boat, b, others) {
    const out = super.boxes(world, boat, b, others);
    for (let bx = Math.floor(b[0]); bx < Math.floor(b[3] + 1); bx++)
      for (let by = Math.floor(b[1]) - 1; by < Math.floor(b[4] + 1); by++)
        for (let bz = Math.floor(b[2]); bz < Math.floor(b[5] + 1); bz++)
          if (world.get(bx, by, bz) === SNOW_LAYER && !world.solid(bx, by, bz)) {
            const top = by + (world.getMeta(bx, by, bz) & 7) * 0.125;
            if (bx + 1 > b[0] && bx < b[3] && top > b[1] && by < b[4] && bz + 1 > b[2] && bz < b[5]) out.push([bx, by, bz, bx + 1, top, bz + 1]);
          }
    return out;
  }
  // Entity.moveEntity (sa.d) for a boat: web slowdown, box offsets, flags, EntityBoat.updateFallState, zeroed motion,
  // then doBlockCollisions and the burning-box test.
  move(world, boat, dx, dy, dz, others) {
    if (boat.inWeb) {
      boat.inWeb = false;
      dx *= 0.25; dy *= 0.05000000074505806; dz *= 0.25;
      boat.vx = boat.vy = boat.vz = 0;
    }
    const odx = dx, ody = dy, odz = dz, bb = boat.bb.slice();
    const list = this.boxes(world, boat, [dx < 0 ? bb[0] + dx : bb[0], dy < 0 ? bb[1] + dy : bb[1], dz < 0 ? bb[2] + dz : bb[2],
      dx > 0 ? bb[3] + dx : bb[3], dy > 0 ? bb[4] + dy : bb[4], dz > 0 ? bb[5] + dz : bb[5]], others);
    for (const o of list) if (bb[3] > o[0] && bb[0] < o[3] && bb[5] > o[2] && bb[2] < o[5]) {
      if (dy > 0 && bb[4] <= o[1]) dy = Math.min(dy, o[1] - bb[4]);
      else if (dy < 0 && bb[1] >= o[4]) dy = Math.max(dy, o[4] - bb[1]);
    }
    bb[1] += dy; bb[4] += dy;
    for (const o of list) if (bb[4] > o[1] && bb[1] < o[4] && bb[5] > o[2] && bb[2] < o[5]) {
      if (dx > 0 && bb[3] <= o[0]) dx = Math.min(dx, o[0] - bb[3]);
      else if (dx < 0 && bb[0] >= o[3]) dx = Math.max(dx, o[3] - bb[0]);
    }
    bb[0] += dx; bb[3] += dx;
    for (const o of list) if (bb[3] > o[0] && bb[0] < o[3] && bb[4] > o[1] && bb[1] < o[4]) {
      if (dz > 0 && bb[5] <= o[2]) dz = Math.min(dz, o[2] - bb[5]);
      else if (dz < 0 && bb[2] >= o[5]) dz = Math.max(dz, o[5] - bb[2]);
    }
    bb[2] += dz; bb[5] += dz;
    boat.bb = bb;
    boat.x = (bb[0] + bb[3]) / 2;
    boat.posY = bb[1] + BOAT_Y_OFFSET;
    boat.z = (bb[2] + bb[5]) / 2;
    boat.y = bb[1];
    boat.collidedH = odx !== dx || odz !== dz;
    boat.onGround = ody !== dy && ody < 0;
    this.updateFallState(world, boat, dy, boat.onGround);
    if (odx !== dx) boat.vx = 0;
    if (ody !== dy) boat.vy = 0;
    if (odz !== dz) boat.vz = 0;
    blockCollisions(world, bb, boat, { hurt: (source, n) => this.attack(boat, n, { source }), wet: boat.inWater });
  }
  // EntityBoat.updateFallState: on landing above 3 blocks the boat falls (rider damage), breaks into planks and
  // sticks; otherwise a fall over anything but water accumulates.
  updateFallState(world, boat, dy, onGround) {
    const bx = Math.floor(boat.x), by = Math.floor(boat.posY), bz = Math.floor(boat.z);
    if (onGround) {
      if (boat.fallDistance > 3) {
        boat.rider?.fall?.(boat.fallDistance);
        if (!boat.dead) this.crashBreak(boat);
        boat.fallDistance = 0;
      }
    } else if (world.get(bx, by - 1, bz) !== WATER && dy < 0) boat.fallDistance = f(boat.fallDistance - dy);
  }
  // setDead and the func_145778_a drops: 3 planks then 2 sticks at the boat (EntityItem delay 10, native random motion).
  crashBreak(boat) {
    boat.dead = true;
    for (let i = 0; i < 3; i++) this.drop(boat, PLANKS);
    for (let i = 0; i < 2; i++) this.drop(boat, STICK);
  }
  drop(boat, id) {
    this.drops.push({ stack: { id, count: 1, damage: 0 }, original: null, x: boat.x, posY: boat.posY, z: boat.z, motion: null, delay: 10 });
  }
  // EntityBoat.attackEntityFrom: flips the wobble direction, timeSinceHit 10, damage + 10 x amount; above 40, or any
  // Creative player's hit, the rider is released and the boat breaks (the Creative break drops nothing).
  attack(boat, amount, { creative = false } = {}) {
    if (boat.dead) return true;
    boat.velocityChanged = true; // EntityBoat.attackEntityFrom: setBeenAttacked() before the damage (executed path: Entity.velocityChanged -> the entry's S12)
    boat.forwardDir = -boat.forwardDir;
    boat.timeSinceHit = 10;
    boat.damage = f(boat.damage + f(amount * 10));
    if (creative || boat.damage > BREAK_DAMAGE) {
      if (!creative) this.drop(boat, BOAT_ITEM);
      boat.dead = true;
    }
    return true;
  }
  setDead(boat) { boat.dead = true; }
  kill(boat) { boat.dead = true; }

  // Entity.handleWaterMovement on entering water: the splash sound (volume from the speed, pitch from two floats), then
  // 1 + width x 20 bubbles and as many splashes spread over the box's width at the water surface.
  enterWater(boat, particles, hooks) {
    const r = boat.random, vol = Math.min(1, f(f(Math.sqrt(boat.vx * boat.vx * 0.20000000298023224 + boat.vy * boat.vy + boat.vz * boat.vz * 0.20000000298023224)) * f(0.2)));
    const pitch = f(1 + f(f(r.nextFloat() - r.nextFloat()) * f(0.4)));
    hooks.splash?.(boat, vol, pitch);
    const y = f(Math.floor(boat.bb[1])), n = f(1 + f(BOAT_WIDTH * 20));
    for (let i = 0; i < n; i++) {
      const a = f(f(f(r.nextFloat() * 2) - 1) * BOAT_WIDTH), b = f(f(f(r.nextFloat() * 2) - 1) * BOAT_WIDTH);
      particles.push(["bubble", boat.x + a, f(y + 1), boat.z + b, boat.vx, boat.vy - f(r.nextFloat() * f(0.2)), boat.vz]);
    }
    for (let i = 0; i < n; i++) {
      const a = f(f(f(r.nextFloat() * 2) - 1) * BOAT_WIDTH), b = f(f(f(r.nextFloat() * 2) - 1) * BOAT_WIDTH);
      particles.push(["splash", boat.x + a, f(y + 1), boat.z + b, boat.vx, boat.vy, boat.vz]);
    }
  }
  // World.updateEntity then EntityBoat.onUpdate (xi.h). `entities` are other solid boxes ({ bb }) that block the move;
  // `hooks.clear(x, y, z, block)` removes a snow layer or breaks a lily pad.
  tickBoat(world, boat, entities = [], hooks = {}) {
    boat.px = boat.x; boat.py = boat.posY; boat.pz = boat.z;
    boat.prevYaw = boat.yaw; boat.prevPitch = boat.pitch;
    const particles = [];
    // Entity.onEntityUpdate: handleWaterMovement (flow push, fall distance reset), lava, burning, the void.
    const water = waterAcceleration(world, entityWaterBox(boat.bb));
    if (water.wet) {
      boat.vx += water.push[0]; boat.vy += water.push[1]; boat.vz += water.push[2];
      if (!boat.inWater && !boat.firstUpdate) this.enterWater(boat, particles, hooks);
      boat.fallDistance = 0; boat.inWater = true; boat.fire = 0;
    } else boat.inWater = false;
    if (inLava(world, boat.bb)) { this.attack(boat, 4, { source: "lava" }); boat.fire = 300; }
    if (boat.fire > 0) { if (boat.fire % 20 === 0) this.attack(boat, 1, { source: "onFire" }); boat.fire--; }
    if (boat.posY < -64) { boat.dead = true; return particles; }
    boat.firstUpdate = false;
    if (boat.dead) return particles;
    if (boat.timeSinceHit > 0) boat.timeSinceHit--;
    if (boat.damage > 0) boat.damage = f(boat.damage - 1);
    boat.px = boat.x; boat.py = boat.posY; boat.pz = boat.z;
    const bb = boat.bb;
    let d0 = 0;
    for (let i = 0; i < 5; i++) {
      const y0 = bb[1] + (bb[4] - bb[1]) * i / 5 - 0.125, y1 = bb[1] + (bb[4] - bb[1]) * (i + 1) / 5 - 0.125;
      if (waterAcceleration(world, [bb[0], y0, bb[2], bb[3], y1, bb[5]], false).wet) d0 += 1 / 5;
    }
    const d10 = Math.sqrt(boat.vx * boat.vx + boat.vz * boat.vz);
    if (d10 > 0.26249999999999996) {
      const rad = boat.yaw * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad), r = boat.random;
      for (let j = 0; j < 1 + d10 * 60; j++) {
        const d5 = f(f(r.nextFloat() * 2) - 1), d6 = (r.nextInt(2) * 2 - 1) * 0.7;
        if (r.nextBoolean()) particles.push(["splash", boat.x - c * d5 * 0.8 + s * d6, boat.posY - 0.125, boat.z - s * d5 * 0.8 - c * d6, boat.vx, boat.vy, boat.vz]);
        else particles.push(["splash", boat.x + c + s * d5 * 0.7, boat.posY - 0.125, boat.z + s - c * d5 * 0.7, boat.vx, boat.vy, boat.vz]);
      }
    }
    if (d0 < 1) boat.vy += 0.03999999910593033 * (d0 * 2 - 1);
    else { if (boat.vy < 0) boat.vy /= 2; boat.vy += 0.007000000216066837; }
    const rider = boat.rider;
    if (rider) {
      const a = f(f(f(rider.yaw) + f(f(-(rider.moveStrafing ?? 0)) * 90)) * f(Math.PI)) / 180;
      const forward = rider.moveForward ?? 0;
      boat.vx += -Math.sin(f(a)) * boat.speed * forward * 0.05000000074505806;
      boat.vz += Math.cos(f(a)) * boat.speed * forward * 0.05000000074505806;
    }
    let d2 = Math.sqrt(boat.vx * boat.vx + boat.vz * boat.vz);
    if (d2 > MAX_SPEED) {
      const k = MAX_SPEED / d2;
      boat.vx *= k; boat.vz *= k;
      d2 = MAX_SPEED;
    }
    if (d2 > d10 && boat.speed < MAX_SPEED) {
      boat.speed += (MAX_SPEED - boat.speed) / 35;
      if (boat.speed > MAX_SPEED) boat.speed = MAX_SPEED;
    } else {
      boat.speed -= (boat.speed - MIN_SPEED) / 35;
      if (boat.speed < MIN_SPEED) boat.speed = MIN_SPEED;
    }
    if (boat.onGround) { boat.vx *= 0.5; boat.vy *= 0.5; boat.vz *= 0.5; }
    this.move(world, boat, boat.vx, boat.vy, boat.vz, [...this.carts, ...entities]);
    if (boat.collidedH && d10 > 0.2) {
      if (!boat.dead) this.crashBreak(boat);
    } else { boat.vx *= 0.9900000095367432; boat.vy *= 0.949999988079071; boat.vz *= 0.9900000095367432; }
    boat.pitch = 0;
    let d4 = boat.yaw;
    const dx = boat.px - boat.x, dz = boat.pz - boat.z;
    if (dx * dx + dz * dz > 0.001) d4 = f(Math.atan2(dz, dx) * 180 / Math.PI);
    let d7 = wrap180(d4 - boat.yaw);
    if (d7 > 20) d7 = 20;
    if (d7 < -20) d7 = -20;
    boat.yaw = f(f(boat.yaw + d7) % 360);
    boat.pitch = f(boat.pitch % 360);
    // Boat-boat pushes (Entity.applyEntityCollision of the neighbour), then snow layers and lily pads at the four corners.
    const near = [boat.bb[0] - 0.2, boat.bb[1], boat.bb[2] - 0.2, boat.bb[3] + 0.2, boat.bb[4], boat.bb[5] + 0.2];
    for (const o of this.carts) if (o !== boat && !o.dead && intersects(o.bb, near)) this.collide(o, boat, true);
    for (let l = 0; l < 4; l++) {
      const bx = Math.floor(boat.x + ((l % 2) - 0.5) * 0.8), bz = Math.floor(boat.z + (Math.trunc(l / 2) - 0.5) * 0.8);
      for (let k = 0; k < 2; k++) {
        const by = Math.floor(boat.posY) + k, block = world.get(bx, by, bz);
        if (block === SNOW_LAYER || block === LILY_PAD) hooks.clear ? hooks.clear(bx, by, bz, block) : world.set(bx, by, bz, 0);
      }
    }
    if (rider?.dead) { rider.vehicle = null; boat.rider = null; }
    return particles;
  }
  tick(world, { entities = [], hooks = {} } = {}) {
    const out = [];
    for (const boat of [...this.carts]) out.push(...this.tickOne(world, boat, entities, hooks));
    this.reap();
    return out;
  }
  // One boat's update where the loaded-entity walk reaches it (entity-simulation.js entityWalkers). World.updateEntityWithOptionalForce: +-32 blocks loaded
  // (the window, or the ring's 5 x 5 chunk test; natural-spawning.md "Round 7"). Returns the splash particles.
  tickOne(world, boat, entities = [], hooks = {}) {
    if (boat.dead || !ringEntityActive(world, boat)) return [];
    return this.tickBoat(world, boat, entities, hooks).map((p) => (hooks.particle?.(p), p));
  }
  reap() { this.carts = this.carts.filter((c) => !c.dead); }
  // Entity.applyEntityCollision(other) on `boat`: both are pushed apart by 0.05 / sqrt(distance) along the larger axis.
  // With `mutual`, `other` is another boat that receives its share; otherwise the share is returned for the entity
  // (the player or a mob, whose own collideWithNearbyEntities calls this).
  collide(boat, other, mutual = false) {
    if (boat.dead || other === boat.rider || other.vehicle === boat || other.ridingEntity === boat) return [0, 0];
    let dx = other.x - boat.x, dz = other.z - boat.z;
    const m = Math.max(Math.abs(dx), Math.abs(dz));
    if (!(m >= 0.009999999776482697)) return [0, 0];
    const d = f(Math.sqrt(m)); // MathHelper.sqrt_double returns a float (probed: boat-cow records)
    dx /= d; dz /= d;
    let k = 1 / d;
    if (k > 1) k = 1;
    dx *= k; dz *= k;
    dx *= 0.05000000074505806; dz *= 0.05000000074505806;
    boat.vx += -dx; boat.vz += -dz; boat.airBorne = true; // Entity.applyEntityCollision -> addVelocity sets isAirBorne on both (bytecode-read: sa.g(DDD))
    if (mutual) { other.vx += dx; other.vz += dz; other.airBorne = true; return [0, 0]; }
    return [dx, dz];
  }
  pushEntity(entity, box) {
    const near = [box[0] - 0.2, box[1], box[2] - 0.2, box[3] + 0.2, box[4], box[5] + 0.2];
    let x = 0, z = 0;
    for (const boat of this.carts)
      if (!boat.dead && intersects(boat.bb, near)) { const [ax, az] = this.collide(boat, entity); x += ax; z += az; }
    return [x, z];
  }
  hit(boat, amount, options) { return this.attack(boat, amount, options); }

  // ItemBoat.onItemRightClick (abj.a): a 5-block trace that stops on source water, the snow layer's cell one lower, the
  // boat at (x + 0.5, y + 1, z + 0.5) turned to the player's nearest axis, refused when its box (shrunk 0.1) meets a block or
  // an entity. Returns the boat, or null. The caller takes the item (not in Creative).
  // Before the trace result is used, every canBeCollidedWith entity in the player's box swept 5 along the look vector (grown by 1)
  // whose box grown by collisionBorderSize (0.1) contains the rayTraceBlocks start vector (which the trace has moved to the
  // entry point of the last cell it visited, not the eye) cancels the placement. `sight` lists those entities' boxes
  // ({ bb } or boxes; default `entities`), `entities` every box the spawned boat must not overlap.
  place(world, { eye, dir, yaw, box }, entities = [], sight = entities) {
    const trace = {}, hit = traceBucket(world, eye, dir, true, trace);
    if (!hit) return null;
    const feet = box ?? [eye[0] - 0.3, eye[1] - f(1.62), eye[2] - 0.3, eye[0] + 0.3, eye[1] - f(1.62) + f(1.8), eye[2] + 0.3];
    const look = [dir[0] * 5, dir[1] * 5, dir[2] * 5],
      reach = feet.map((v, i) => (i < 3 ? (look[i] < 0 ? v + look[i] : v) : look[i - 3] > 0 ? v + look[i - 3] : v)).map((v, i) => (i < 3 ? v - 1 : v + 1)),
      [sx, sy, sz] = trace.start;
    for (const o of sight) {
      const b = o.bb ?? o;
      if (!intersects(reach, b)) continue;
      if (sx > b[0] - 0.1 && sx < b[3] + 0.1 && sy > b[1] - 0.1 && sy < b[4] + 0.1 && sz > b[2] - 0.1 && sz < b[5] + 0.1) return null;
    }
    let [x, y, z] = hit.block;
    if (world.get(x, y, z) === SNOW_LAYER) y--;
    const boat = this.spawnBoat({ x: x + 0.5, y: y + 1, z: z + 0.5, yaw: ((Math.floor(f(f(f(yaw) * 4) / 360) + 0.5) & 3) - 1) * 90 }, { born: true });
    const b = boat.bb, shrunk = [b[0] + 0.1, b[1] + 0.1, b[2] + 0.1, b[3] - 0.1, b[4] - 0.1, b[5] - 0.1];
    if (this.boxes(world, boat, shrunk, entities).length) { this.carts.pop(); this.nextId--; return null; }
    return boat;
  }

  // Browser save: the Entity fields a native reload keeps (position, motion, rotation, fall distance, fire).
  toJSON() { return this.carts.filter((c) => !c.dead).map((c) => this.serializeOne(c)); }
  // One boat's save record (also what portal travel carries to the other dimension: entity-portal.js).
  serializeOne(c) {
    return {
      id: c.id, uuid: ensureUuid(c), x: c.x, y: c.posY, z: c.z, motion: [c.vx, c.vy, c.vz], rotation: [c.yaw, c.pitch], fallDistance: c.fallDistance, fire: c.fire,
      onGround: c.onGround, ...(c.rider?.player === true ? { rider: true } : {}), ...(c.portalCooldown > 0 ? { portalCooldown: c.portalCooldown } : {}),
    };
  }
  static fromJSON(list, options) {
    const m = new Boats(options), ok = (...v) => v.every(Number.isFinite);
    for (const c of Array.isArray(list) ? list.slice(0, 1024) : []) {
      if (!ok(c?.x, c?.y, c?.z)) continue;
      const boat = m.spawnBoat({ x: c.x, y: c.y - BOAT_Y_OFFSET, z: c.z });
      boat.restorePlayer = c.rider === true;
      if (isUuid(c.uuid)) boat.uuid = c.uuid.toLowerCase(); // Entity.writeToNBT's UUIDMost/UUIDLeast (entity-uuid.js)
      if (Number.isInteger(c.id) && c.id > 0 && !m.carts.some((o) => o !== boat && o.id === c.id)) boat.id = c.id; // passengers name their boat by id
      m.nextId = Math.max(m.nextId, boat.id + 1);
      const v = Array.isArray(c.motion) && c.motion.length === 3 && ok(...c.motion) ? c.motion : [0, 0, 0];
      // Entity.readFromNBT: motion components above 10 in magnitude are dropped to 0.
      [boat.vx, boat.vy, boat.vz] = v.map((x) => (Math.abs(x) > 10 ? 0 : x));
      if (Array.isArray(c.rotation) && c.rotation.length === 2 && ok(...c.rotation)) [boat.yaw, boat.pitch] = c.rotation.map(f);
      boat.prevYaw = boat.yaw; boat.prevPitch = boat.pitch;
      if (ok(c.fallDistance)) boat.fallDistance = f(c.fallDistance);
      if (Number.isInteger(c.fire)) boat.fire = c.fire;
      boat.onGround = !!c.onGround;
      if (Number.isInteger(c.portalCooldown) && c.portalCooldown > 0) boat.portalCooldown = Math.min(300, c.portalCooldown);
    }
    return m;
  }

  // RenderBoat.doRender's wobble: rotate (180 - yaw) about Y, then sin(t) * t * d / 10 * forwardDirection about X.
  renderPose(world, boat, partial = 1) {
    const lerp = (a, b) => a + (b - a) * partial;
    const t = f(boat.timeSinceHit - partial), d = Math.max(0, f(boat.damage - partial));
    const roll = t > 0 ? f(f(f(Math.sin(t) * t) * d) / 10) * boat.forwardDir : 0;
    return { x: lerp(boat.px, boat.x), y: lerp(boat.py, boat.posY), z: lerp(boat.pz, boat.z),
      yaw: f(boat.prevYaw + f(f(boat.yaw - boat.prevYaw) * partial)), roll };
  }
}
