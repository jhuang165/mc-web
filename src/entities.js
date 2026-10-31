import { SIZE, HEIGHT, hash, raycast as voxelRay, blockBounds, WOOL } from "./world.js";
import { ITEMS } from "./survival.js";
import { mhSin, mhCos } from "./lighting.js";
import { waterAcceleration, entityWaterBox } from "./fluids.js";
import { sheepColor, childColor } from "./sheep.js";
import { sneakEdge, criticalDamage } from "./player-movement.js";
const f = Math.fround;
// MathHelper.wrapAngleTo180_float (qh.g).
export function wrapDegrees(a) {
  a = f(a % 360);
  if (a >= 180) a = f(a - 360);
  if (a < -180) a = f(a + 360);
  return a;
}
// sv.h shifts each prev angle by whole turns until it is within 180 degrees of
// the current one, so the renderer's lerp never spins the long way round.
export function nearAngle(prev, cur) {
  while (f(cur - prev) < -180) prev = f(prev - 360);
  while (f(cur - prev) >= 180) prev = f(prev + 360);
  return prev;
}
// RendererLivingEntity.interpolateRotation (boh.a(FFF)F).
export function interpolateRotation(prev, cur, partial) {
  let d = f(cur - prev);
  while (d < -180) d = f(d + 360);
  while (d >= 180) d = f(d - 360);
  return f(prev + f(partial * d));
}
// EntityBodyHelper.func_75665_a (tr.a(FFF)F): `to` turned toward `from`, at most `max` away.
const clampYaw = (from, to, max) => f(from - Math.min(Math.max(wrapDegrees(f(from - to)), -max), max));
// Transient render state, rebuilt on load: lastTickPos (which World sets equal
// to prevPos before every onUpdate), the Java-convention yaw/pitch degrees and
// the limb swing. `gait` is the old limb phase from earlier saves.
// Physics state is rebuilt on load as well: motion is already reset there.
const TRANSIENT = ["onGround", "collidedH", "inWater", "fallDistance", "moveForward", "aiMoveSpeed", "jumping", "jumpTicks", "lastDamage"];
const INTERPOLATED = [...TRANSIENT, "px", "py", "pz", "rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "rotationPitch", "prevRotationPitch", "limbSwing", "limbSwingAmount", "prevLimbSwingAmount", "bodyTicks", "bodyHeadYaw", "gait"];
// Entity.rotationYaw is Java degrees (0 faces +z, increasing toward -x); e.yaw
// is the radian bearing used by the movement code, which turns toward +x.
const javaYaw = (e) => f((-e.yaw * 180) / Math.PI) + 0;
// Seed every prev field from the current state (spawn, load, reset): RenderManager
// sets lastTickPos = pos at ticksExisted 0 so nothing interpolates from the origin.
export function syncInterpolation(e) {
  const yaw = javaYaw(e);
  return Object.assign(e, {
    px: e.x, py: e.y, pz: e.z,
    rotationYaw: yaw, prevRotationYaw: yaw, renderYawOffset: yaw, prevRenderYawOffset: yaw,
    rotationYawHead: yaw, prevRotationYawHead: yaw, rotationPitch: 0, prevRotationPitch: 0,
    limbSwing: 0, limbSwingAmount: 0, prevLimbSwingAmount: 0, bodyTicks: 0, bodyHeadYaw: yaw,
  });
}
// What RenderManager.renderEntitySimple and RendererLivingEntity.doRender feed
// the model at `partial`: lastTickPos lerp, body/head yaw through
// interpolateRotation (head relative to the body), pitch, limbSwing
// (limbSwing - limbSwingAmount * (1 - partial), x3 for children) and
// limbSwingAmount (lerped, capped at 1), age in ticks, and the death roll
// (deathTime + partial - 1) / 20 * 1.6 -> sqrt, capped at 1, times 90 degrees.
// EntitySheep.func_70894_j (wp.p(F)): how far the head has dropped, 0 to 1, for the
// grazing timer `br` (40 down to 0): it lowers over the first 4 ticks, stays down
// from 36 to 4 and rises over the last 4.
export function sheepHeadDrop(timer, partial) {
  if (timer <= 0) return 0;
  if (timer >= 4 && timer <= 36) return 1;
  return timer < 4 ? f(f(timer - partial) / 4) : f(-f(f(timer - 40) - partial) / 4);
}
// EntitySheep.func_70890_k (wp.q(F)): the head pitch in radians; a grazing sheep
// looks down 36 degrees and nods by 0.21991149 rad, otherwise it follows rotationPitch.
export function sheepHeadPitch(timer, partial, pitchDegrees = 0) {
  if (timer > 4 && timer <= 36) {
    const x = f(f(timer - 4 - partial) / 32);
    return f(0.62831855 + f(0.21991149 * f(Math.sin(f(x * 28.7)))));
  }
  return timer > 0 ? f(0.62831855) : f(pitchDegrees / 57.295776);
}
export function mobPose(e, partial) {
  const p = f(partial), lerp = (a, b) => a + (b - a) * p,
    body = interpolateRotation(e.prevRenderYawOffset, e.renderYawOffset, p),
    head = interpolateRotation(e.prevRotationYawHead, e.rotationYawHead, p);
  let swing = f(e.limbSwing - f(e.limbSwingAmount * f(1 - p))),
    amount = f(e.prevLimbSwingAmount + f(f(e.limbSwingAmount - e.prevLimbSwingAmount) * p)),
    death = 0;
  if (e.growingAge < 0) swing = f(swing * 3);
  if (amount > 1) amount = 1;
  if (e.death > 0) death = f(Math.min(1, f(Math.sqrt(f(f(f(f(e.death + p) - 1) / 20) * f(1.6))))) * 90);
  const headPitch = f(e.prevRotationPitch + f(f(e.rotationPitch - e.prevRotationPitch) * p));
  return {
    ...(e.type === "sheep" ? { headDrop: sheepHeadDrop(e.eatTimer || 0, p), headTilt: sheepHeadPitch(e.eatTimer || 0, p, headPitch) } : {}),
    x: lerp(e.px, e.x), y: lerp(e.py, e.y), z: lerp(e.pz, e.z),
    bodyYaw: body, headYaw: f(head - body),
    headPitch,
    limbSwing: swing, limbSwingAmount: amount, age: e.age + p, death,
  };
}
// Widths and heights are each 1.7.10 constructor's setSize: EntityPig (wo)
// 0.9 x 0.9, EntityCow (wh) 0.9 x 1.3, EntitySheep (wp) 0.9 x 1.3, EntityZombie
// (yq) 0.6 x 1.8. `movement` is the applyEntityAttributes (aD)
// SharedMonsterAttributes.movementSpeed base (pig 0.25, cow (double)0.2f, sheep
// (double)0.23f, zombie (double)0.23f) and sheep maxHealth is 8; `ai` holds the AI
// task speed multipliers from each constructor: EntityAIPanic (uz) pig 1.25, cow
// 2.0, sheep 1.25; EntityAITempt (vk) pig 1.2, cow 1.25, sheep 1.1; EntityAIFollowParent
// (uh) pig 1.1, cow 1.25, sheep 1.1; EntityAIMate (ua) and EntityAIWander (vc) 1.0;
// the zombie's EntityAIAttackOnCollide (us) and EntityAIWander 1.0. A sheep has no
// `drop`: wool comes from its own dropFewItems (wp.b), and mutton does not exist yet.
export const ENTITY_TYPES = {
  pig: { health: 10, width: 0.9, height: 0.9, movement: 0.25, ai: { wander: 1, mate: 1, panic: 1.25, tempt: 1.2, follow: 1.1 }, drop: 202 },
  cow: { health: 10, width: 0.9, height: 1.3, movement: f(0.2), ai: { wander: 1, mate: 1, panic: 2, tempt: 1.25, follow: 1.25 }, drop: 204 },
  sheep: { health: 8, width: 0.9, height: 1.3, movement: f(0.23), ai: { wander: 1, mate: 1, panic: 1.25, tempt: 1.1, follow: 1.1 }, drop: 0 },
  zombie: {
    health: 20,
    width: 0.6,
    height: 1.8,
    movement: f(0.23),
    ai: { wander: 1, chase: 1 },
    damage: 3,
    drop: 206,
  },
};
// EntityMoveHelper.onUpdateMoveHelper (tv.c) hands EntityLiving.setAIMoveSpeed
// (sw.i) `(float)(speed * movementSpeed)`; sw.i also sets moveForward to it. The
// zombie's "Baby speed boost" (yq.br) is operation 1: base * (1 + 0.5).
export function aiMoveSpeed(e, multiplier) {
  const base = ENTITY_TYPES[e.type].movement;
  return f(multiplier * (e.type === "zombie" && e.growingAge < 0 ? base + base * 0.5 : base));
}
// Wheat (ade.O) breeds and tempts cows and sheep (EntityAITempt / isBreedingItem).
const BREED_ITEM = { cow: 305, sheep: 305 };
// getHurtSound / getDeathSound: the pig says its hurt sound, the cow's death sound is
// its hurt sound, and the sheep uses mob.sheep.say for say, hurt and death alike.
const hurtSound = (type) => (type === "pig" ? "mob.pig.say" : type === "sheep" ? "mob.sheep.say" : "mob." + type + ".hurt");
const deathSound = (type) => (type === "sheep" ? "mob.sheep.say" : "mob." + type + (type === "cow" ? ".hurt" : ".death"));
export function actorCollides(world, x, y, z, w, h) {
  for (
    let bx = Math.floor(x - w / 2 + 0.001);
    bx <= Math.floor(x + w / 2 - 0.001);
    bx++
  )
    for (let by = Math.floor(y + 0.001); by <= Math.floor(y + h - 0.001); by++)
      for (
        let bz = Math.floor(z - w / 2 + 0.001);
        bz <= Math.floor(z + w / 2 - 0.001);
        bz++
      )
        if (world.solid(bx, by, bz)) return true;
  return false;
}
// --- Motion: Entity.moveEntity (sa.d) and EntityLivingBase.moveEntityWithHeading (sv.e(FF)) ---
const STEP_HEIGHT = 0.5; // EntityLivingBase constructor: stepHeight = 0.5f
const JUMP_MOVEMENT_FACTOR = f(0.02); // sv.aQ
// Block.slipperiness (aji.K): 0.6f for every block in this build (there is no ice).
const slipperiness = () => f(0.6);
// World.getCollidingBoundingBoxes (ahb.a): block boxes overlapping `b`, as
// [minX, minY, minZ, maxX, maxY, maxZ]. The scan starts a block low like the original.
function collisionBoxes(world, b) {
  const out = [];
  for (let bx = Math.floor(b[0]); bx < Math.floor(b[3] + 1); bx++)
    for (let by = Math.floor(b[1]) - 1; by < Math.floor(b[4] + 1); by++)
      for (let bz = Math.floor(b[2]); bz < Math.floor(b[5] + 1); bz++)
        if (world.solid(bx, by, bz)) {
          const [a, c, d, g, h, i] = blockBounds(world, bx, by, bz);
          if (bx + g > b[0] && bx + a < b[3] && by + h > b[1] && by + c < b[4] && bz + i > b[2] && bz + d < b[5]) out.push([bx + a, by + c, bz + d, bx + g, by + h, bz + i]);
        }
  return out;
}
// AxisAlignedBB.calculateXOffset/YOffset/ZOffset (azt.a/b/c): how far `bb` may still move along one axis.
const offsetX = (o, bb, d) => {
  if (bb[4] > o[1] && bb[1] < o[4] && bb[5] > o[2] && bb[2] < o[5]) {
    if (d > 0 && bb[3] <= o[0]) d = Math.min(d, o[0] - bb[3]);
    else if (d < 0 && bb[0] >= o[3]) d = Math.max(d, o[3] - bb[0]);
  }
  return d;
};
const offsetY = (o, bb, d) => {
  if (bb[3] > o[0] && bb[0] < o[3] && bb[5] > o[2] && bb[2] < o[5]) {
    if (d > 0 && bb[4] <= o[1]) d = Math.min(d, o[1] - bb[4]);
    else if (d < 0 && bb[1] >= o[4]) d = Math.max(d, o[4] - bb[1]);
  }
  return d;
};
const offsetZ = (o, bb, d) => {
  if (bb[3] > o[0] && bb[0] < o[3] && bb[4] > o[1] && bb[1] < o[4]) {
    if (d > 0 && bb[5] <= o[2]) d = Math.min(d, o[2] - bb[5]);
    else if (d < 0 && bb[2] >= o[5]) d = Math.max(d, o[5] - bb[2]);
  }
  return d;
};
const shift = (bb, dx, dy, dz) => {
  bb[0] += dx; bb[3] += dx; bb[1] += dy; bb[4] += dy; bb[2] += dz; bb[5] += dz;
};
// Entity.moveEntity (sa.d(DDD)) for a walking mob: y first, then x, then z
// against the block boxes; when a horizontal move is blocked while on the
// ground, retry with stepHeight (0.5) and keep that result unless it is no
// farther. Sets the collided/onGround flags, zeroes motion on blocked axes and
// runs Entity.updateFallState (sa.a(DZ)V); returns the fall distance on landing.
export function moveEntity(world, e, w, h, dx, dy, dz) {
  // Entity.width/height are floats (setSize), so the box edges use their float values.
  w = f(w);
  h = f(h);
  // A sneaking EntityPlayer on the ground never walks off an edge (player-movement.js).
  if (e.sneaking && e.onGround)
    [dx, dz] = sneakEdge(dx, dz, (ox, oz) => !collisionBoxes(world, [e.x - w / 2 + ox, e.y - 1, e.z - w / 2 + oz, e.x + w / 2 + ox, e.y - 1 + h, e.z + w / 2 + oz]).length);
  const odx = dx, ody = dy, odz = dz, half = w / 2,
    bb = [e.x - half, e.y, e.z - half, e.x + half, e.y + h, e.z + half],
    start = bb.slice(),
    grow = (box, gx, gy, gz) => [gx < 0 ? box[0] + gx : box[0], gy < 0 ? box[1] + gy : box[1], gz < 0 ? box[2] + gz : box[2], gx > 0 ? box[3] + gx : box[3], gy > 0 ? box[4] + gy : box[4], gz > 0 ? box[5] + gz : box[5]];
  let list = collisionBoxes(world, grow(bb, dx, dy, dz));
  for (const o of list) dy = offsetY(o, bb, dy);
  shift(bb, 0, dy, 0);
  const grounded = e.onGround || (ody !== dy && ody < 0);
  for (const o of list) dx = offsetX(o, bb, dx);
  shift(bb, dx, 0, 0);
  for (const o of list) dz = offsetZ(o, bb, dz);
  shift(bb, 0, 0, dz);
  if (grounded && (odx !== dx || odz !== dz)) {
    const sx = dx, sy = dy, sz = dz, flat = bb.slice();
    dx = odx; dy = STEP_HEIGHT; dz = odz;
    bb.splice(0, 6, ...start);
    list = collisionBoxes(world, grow(bb, odx, STEP_HEIGHT, odz));
    for (const o of list) dy = offsetY(o, bb, dy);
    shift(bb, 0, dy, 0);
    for (const o of list) dx = offsetX(o, bb, dx);
    shift(bb, dx, 0, 0);
    for (const o of list) dz = offsetZ(o, bb, dz);
    shift(bb, 0, 0, dz);
    dy = -STEP_HEIGHT;
    for (const o of list) dy = offsetY(o, bb, dy);
    shift(bb, 0, dy, 0);
    if (sx * sx + sz * sz >= dx * dx + dz * dz) {
      dx = sx; dy = sy; dz = sz;
      bb.splice(0, 6, ...flat);
    }
  }
  e.x = (bb[0] + bb[3]) / 2;
  e.y = bb[1];
  e.z = (bb[2] + bb[5]) / 2;
  e.collidedH = odx !== dx || odz !== dz;
  e.onGround = ody !== dy && ody < 0;
  if (odx !== dx) e.vx = 0;
  if (ody !== dy) e.vy = 0;
  if (odz !== dz) e.vz = 0;
  let landed = 0;
  if (e.onGround) {
    landed = e.fallDistance;
    e.fallDistance = 0;
  } else if (dy < 0) e.fallDistance = f(e.fallDistance - dy);
  return landed;
}
// Entity.moveFlying (sa.a(FFF)): `forward` (and `strafe`) scaled to `friction`,
// rotated by rotationYaw through MathHelper's sine table and added to motion.
export function moveFlying(e, strafe, forward, friction) {
  let d = f(f(strafe * strafe) + f(forward * forward));
  if (d < f(1e-4)) return;
  d = f(Math.sqrt(d));
  if (d < 1) d = 1;
  d = f(friction / d);
  strafe = f(strafe * d);
  forward = f(forward * d);
  const yaw = f(f(e.rotationYaw * f(Math.PI)) / 180), sin = mhSin(yaw), cos = mhCos(yaw);
  e.vx += f(f(strafe * cos) - f(forward * sin));
  e.vz += f(f(forward * cos) + f(strafe * sin));
}
// Entity.handleWaterMovement (sa.N) through World.handleMaterialAcceleration: the
// box shrunk 0.4 vertically and 0.001 all round is wet below each cell's liquid
// surface, and living entities are pushed 0.014 along the summed flow vector.
function inWater(world, e, w, h) {
  const r = w / 2, { wet, push } = waterAcceleration(world, entityWaterBox([e.x - r, e.y, e.z - r, e.x + r, e.y + h, e.z + r]));
  addVelocity(e, ...push);
  return wet;
}
// Entity.func_70038_c / isOffsetPositionInLiquid (sa.c(DDD)): the box moved by
// (dx, dy, dz) has no block in it and no water.
function offsetInLiquid(world, e, w, h, dx, dy, dz) {
  const half = w / 2, b = [e.x - half + dx, e.y + dy, e.z - half + dz, e.x + half + dx, e.y + h + dy, e.z + half + dz];
  if (collisionBoxes(world, b).length) return false;
  for (let bx = Math.floor(b[0]); bx < Math.floor(b[3] + 1); bx++)
    for (let by = Math.floor(b[1]); by < Math.floor(b[4] + 1); by++)
      for (let bz = Math.floor(b[2]); bz < Math.floor(b[5] + 1); bz++)
        if (world.get(bx, by, bz) === 10) return false;
  return true;
}
// EntityLivingBase.jump (sv.bj): 0.42 upward (no jump boost, no sprint).
export function jump(e) {
  e.vy = 0.41999998688697815;
}
// EntityLivingBase.moveEntityWithHeading (sv.e(FF)) without strafe, ladders or
// lava (isAIEnabled mobs): water accelerates at 0.04 and drags by 0.8; on land
// the block under the feet sets friction 0.91 * slipperiness and the ground
// acceleration aiMoveSpeed * 0.16277136 / friction^3 (0.02 in the air).
// Gravity is 0.08 with 0.98 vertical drag. Returns the landing fall distance.
export function moveEntityWithHeading(world, e, w, h, forward) {
  let landed;
  if (e.inWater) {
    const y0 = e.y;
    moveFlying(e, 0, forward, f(0.04));
    landed = moveEntity(world, e, w, h, e.vx, e.vy, e.vz);
    e.vx *= 0.800000011920929;
    e.vy *= 0.800000011920929;
    e.vz *= 0.800000011920929;
    e.vy -= 0.02;
    if (e.collidedH && offsetInLiquid(world, e, w, h, e.vx, e.vy + 0.6 - e.y + y0, e.vz)) e.vy = 0.30000001192092896;
  } else {
    // The block under the feet (floor(minY) - 1) only counts while on the ground.
    const slip = () => (e.onGround ? f(slipperiness(world.get(Math.floor(e.x), Math.floor(e.y) - 1, Math.floor(e.z))) * f(0.91)) : f(0.91));
    let friction = slip();
    const accel = f(f(0.16277136) / f(f(friction * friction) * friction));
    moveFlying(e, 0, forward, e.onGround ? f(e.aiMoveSpeed * accel) : JUMP_MOVEMENT_FACTOR);
    friction = slip();
    landed = moveEntity(world, e, w, h, e.vx, e.vy, e.vz);
    e.vy -= 0.08;
    e.vy *= 0.9800000190734863;
    e.vx *= friction;
    e.vz *= friction;
  }
  return landed;
}
// EntityLivingBase.knockBack (sv.a(Entity, F, DD)V), reached from attackEntityFrom
// with dx, dz = attacker - victim: the knockbackResistance roll, then half the
// old motion plus 0.4 away from the attacker horizontally and 0.4 up (capped at
// 0.4). attackEntityFrom nudges a coincident attacker by a random sliver first.
export function knockBack(e, fromX, fromZ, random = Math.random) {
  let dx = fromX - e.x, dz = fromZ - e.z;
  while (dx * dx + dz * dz < 1e-4) {
    dx = (random() - random()) * 0.01;
    dz = (random() - random()) * 0.01;
  }
  if (random() < (e.knockbackResistance || 0)) return false;
  const len = f(Math.sqrt(dx * dx + dz * dz)), k = f(0.4);
  e.vx = e.vx / 2 - (dx / len) * k;
  e.vy = e.vy / 2 + k;
  e.vz = e.vz / 2 - (dz / len) * k;
  if (e.vy > 0.4000000059604645) e.vy = 0.4000000059604645;
  return true;
}
// Entity.addVelocity (sa.g(DDD)V).
export function addVelocity(e, x, y, z) {
  e.vx += x;
  e.vy += y;
  e.vz += z;
}
export function entityHit(origin, dir, e, reach) {
  const base = ENTITY_TYPES[e.type], scale=e.growingAge<0?.5:1,t={width:base.width*scale,height:base.height*scale};
  let near = 0,
    far = reach;
  for (const [axis, min, max] of [
    ["x", e.x - t.width / 2, e.x + t.width / 2],
    ["y", e.y, e.y + t.height],
    ["z", e.z - t.width / 2, e.z + t.width / 2],
  ]) {
    if (Math.abs(dir[axis]) < 1e-8) {
      if (origin[axis] < min || origin[axis] > max) return null;
    } else {
      const a = (min - origin[axis]) / dir[axis],
        b = (max - origin[axis]) / dir[axis];
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
      if (far < near) return null;
    }
  }
  return near <= reach ? near : null;
}
export class EntityWorld {
  constructor(world, saved, random = Math.random) {
    this.world = world;
    this.random = random;
    this.events = [];
    this.entities = [];
    this.nextId = 1;
    this.spawnClock = 0;
    if (Array.isArray(saved)) {
      for (const e of saved.slice(0, 40)) {
        const t = ENTITY_TYPES[e.type];
        if (
          !t ||
          ![e.x, e.y, e.z, e.health].every(Number.isFinite) ||
          e.x < 1 ||
          e.x >= SIZE - 1 ||
          e.z < 1 ||
          e.z >= SIZE - 1 ||
          e.y < 0 ||
          e.y >= HEIGHT ||
          e.health <= 0
        )
          continue;
        this.entities.push(syncInterpolation({
          ...this.create(e.type, e.x, e.y, e.z),
          ...e,
          id: /^mob-\d+$/.test(e.id) ? e.id : "mob-" + this.nextId++,
          health: Math.min(t.health, e.health),
          yaw: Number.isFinite(e.yaw) ? e.yaw : 0,
          age: Number.isFinite(e.age) ? e.age : 0,
          growingAge:Number.isInteger(e.growingAge)?Math.max(-24000,Math.min(6000,e.growingAge)):0,
          love:Number.isInteger(e.love)?Math.max(0,Math.min(600,e.love)):0,
          mateTicks:0,
          ...(e.type === "sheep" ? { color: Number.isInteger(e.color) && e.color >= 0 && e.color < 16 ? e.color : 0, sheared: e.sheared === true, eatTimer: 0 } : {}),
          wander: 0,
          hurt: 0,
          attack: 0,
          flee: 0,
          vx: 0,
          vz: 0,
          vy: 0,
          ...this.physics(),
        }));
        this.nextId++;
      }
      this.nextId = Math.max(
        this.nextId,
        ...this.entities
          .map((e) => Number(String(e.id).replace("mob-", "")) + 1)
          .filter(Number.isFinite),
      );
    } else this.seedAnimals();
  }
  create(type, x, y, z, random = this.random) {
    return syncInterpolation({
      id: "mob-" + this.nextId++,
      type,
      x,
      y,
      z,
      health: ENTITY_TYPES[type].health,
      yaw: 0,
      vy: 0,
      vx: 0,
      vz: 0,
      age: 0,
      wander: 0,
      hurt: 0,
      attack: 0,
      flee: 0,
      burn: 0,
      growingAge:0,love:0,mateTicks:0,
      // EntitySheep.func_110161_a: a natural fleece colour; bit 16 of datawatcher
      // byte 16 (`sheared`); and the grazing timer (EntityAIEatGrass, mirrored in wp.br).
      ...(type === "sheep" ? { color: sheepColor(random), sheared: false, eatTimer: 0 } : {}),
      // EntityZombie.func_110161_a adds a 0 to 0.05 "Random spawn bonus" to knockbackResistance.
      knockbackResistance: type === "zombie" ? random() * 0.05000000074505806 : 0,
      ...this.physics(),
    });
  }
  // Fresh motion state: grounded only after the first collision, no AI move target yet.
  physics() {
    return { onGround: false, collidedH: false, inWater: false, fallDistance: 0, moveForward: 0, aiMoveSpeed: 0, jumping: false, jumpTicks: 0, lastDamage: 0 };
  }
  seedAnimals() {
    const spawn = this.world.spawn();
    for (let i = 0; i < 8; i++) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const angle = hash(i, attempt, this.world.numericSeed) * Math.PI * 2,
          r = 10 + hash(i, attempt, 313) * 24,
          x = Math.floor(spawn.x + Math.sin(angle) * r),
          z = Math.floor(spawn.z + Math.cos(angle) * r);
        if (x < 3 || z < 3 || x > SIZE - 3 || z > SIZE - 3) continue;
        // SpawnListEntry weights for a plains biome's creatures: sheep 12, pig 10, cow 8.
        const y = this.world.surface(x, z), roll = hash(i, 51, this.world.numericSeed) * 30, type = roll < 12 ? "sheep" : roll < 22 ? "pig" : "cow", t = ENTITY_TYPES[type];
        if (
          this.world.get(x, y - 1, z) !== 1 ||
          actorCollides(this.world, x + 0.5, y, z + 0.5, t.width, t.height)
        )
          continue;
        let n = 0;
        this.entities.push(this.create(type, x + 0.5, y, z + 0.5, () => hash(i * 31 + attempt, n++, this.world.numericSeed + 977)));
        break;
      }
    }
  }
  pick(origin, dir, reach, wallDistance = reach) {
    let result = null;
    for (const e of this.entities) {
      if (e.health <= 0) continue;
      const distance = entityHit(origin, dir, e, Math.min(reach, wallDistance));
      if (distance !== null && (!result || distance < result.distance))
        result = { entity: e, distance };
    }
    return result;
  }
  // EntityLivingBase.attackEntityFrom (sv.a(ro, F)) for a damage source with an
  // attacking entity at (fromX, fromZ): while hurtResistantTime > 10 (`hurt` > 0)
  // only damage above lastDamage counts, the difference being dealt; limbSwingAmount
  // jumps to 1.5, knockBack runs, then the mob dies or plays its hurt sound.
  damage(e, amount, fromX, fromZ) {
    if (!this.entities.includes(e) || e.health <= 0) return false;
    if (e.hurt > 0) {
      if (amount <= e.lastDamage) return false;
      e.health -= amount - e.lastDamage;
    } else {
      e.health -= amount;
      e.hurt = 10;
    }
    e.lastDamage = amount;
    // Panic (EntityAIPanic) starts for animals; zombies keep chasing.
    if (e.type !== "zombie") e.flee = 60;
    e.love=0;e.mateTicks=0;
    e.yaw = Math.atan2(e.x - fromX, e.z - fromZ);
    // EntityLivingBase.attackEntityFrom sets limbSwingAmount to 1.5.
    e.limbSwingAmount = 1.5;
    knockBack(e, fromX, fromZ);
    if (e.health <= 0) this.kill(e);
    else
      this.events.push({
        sound: hurtSound(e.type),
        position: e,
      });
    return true;
  }
  // `critical` is the jump-attack test of attackTargetEntityWithCurrentItem (damage * 1.5F).
  attack(e, tool, survival, player, extraKnockback = 0, critical = false) {
    if (!this.entities.includes(e) || e.health <= 0) return false;
    const item = ITEMS[tool],
      owned = survival.creative || survival.count(tool) > 0;
    let damage = 1;
    if (owned && ["sword","axe","pickaxe","shovel"].includes(item?.kind)) {
      damage =
        item.kind === "sword"
          ? 5 + (item.name.startsWith("Golden") ? 0 : item.tier)
          : item.kind === "axe"
            ? 4 + item.tier
            : item.kind === "pickaxe"
              ? 3 + item.tier
              : 2 + item.tier;
    }
    if (critical) damage = criticalDamage(damage);
    if (e.hurt > 0 && damage <= e.lastDamage) return false;
    if (!this.damage(e, damage, player.x, player.z)) return false;
    // EntityPlayer.attackTargetEntityWithCurrentItem (yz.r): sprinting and Knockback add
    // addVelocity(-sin(yaw) * n * 0.5F, 0.1, cos(yaw) * n * 0.5F) with the sine table and
    // Java floats; player.yaw is this build's radian view yaw (Java yaw = 180 - yaw degrees).
    if (extraKnockback > 0 && Number.isFinite(player.yaw)) {
      const rad = f(f(f(180 - player.yaw * (180 / Math.PI)) * f(Math.PI)) / 180);
      addVelocity(e, f(f(-mhSin(rad) * extraKnockback) * 0.5), 0.1, f(f(mhCos(rad) * extraKnockback) * 0.5));
    }
    survival.exhaust(0.3);
    if (owned&&["sword","axe","pickaxe","shovel"].includes(item?.kind)) survival.wear(tool,item.kind==='sword'?1:2);
    return true;
  }
  // Death of a mob: sound, experience and the drops (EntityLiving.dropFewItems).
  kill(e) {
    this.events.push({
      sound: deathSound(e.type),
      position: e,
    });
    if(e.growingAge>=0)this.events.push({xp:e.type==='zombie'?5:1+Math.floor(Math.random()*3),position:{x:e.x,y:e.y,z:e.z}});
    // EntitySheep.dropFewItems (wp.b): one wool of its colour unless sheared, young or old.
    if(e.type==='sheep'&&!e.sheared)this.events.push({drop:WOOL,count:1,damage:e.color,position:{x:e.x,y:e.y,z:e.z}});
    if(e.growingAge>=0&&ENTITY_TYPES[e.type].drop)this.events.push({
      drop: ENTITY_TYPES[e.type].drop,
      count:
        1 + Math.floor(hash(e.age, e.id.length, this.world.numericSeed) * 3),
      position: { x: e.x, y: e.y, z: e.z },
    });
    // EntityCow.dropFewItems also drops zero to two leather.
    const leather = e.type === "cow" && e.growingAge >= 0 ? Math.floor(hash(e.age + 7, e.id.length, this.world.numericSeed) * 3) : 0;
    if (leather) this.events.push({ drop: 315, count: leather, position: { x: e.x, y: e.y, z: e.z } });
    e.death = 1;
    if (e.eatTimer) e.eatTimer = 0;
  }
  // EntityLivingBase.fall (sv.b(F)): ceil(distance - 3) points of fall damage
  // (no jump boost), through attackEntityFrom without an attacker, so no knockback.
  fall(e, distance) {
    const points = Math.ceil(f(distance - 3));
    if (points <= 0 || e.health <= 0) return;
    if (e.hurt > 0) {
      if (points <= e.lastDamage) return;
      e.health -= points - e.lastDamage;
    } else {
      e.health -= points;
      e.hurt = 10;
    }
    e.lastDamage = points;
    e.limbSwingAmount = 1.5;
    if (e.health <= 0) this.kill(e);
    else this.events.push({ sound: hurtSound(e.type), position: e });
  }
  feed(e,id,survival){
    if(!this.entities.includes(e)||e.health<=0||!BREED_ITEM[e.type]||id!==BREED_ITEM[e.type]||(!survival.creative&&!survival.count(id)))return false;
    if(e.growingAge!==0||e.love>0)return false;e.love=600;
    if(!survival.creative)survival.take(id);this.events.push({hearts:true,position:{x:e.x,y:e.y+1,z:e.z}});return true;
  }
  breed(){
    for(const type of Object.keys(BREED_ITEM)){
    const adults=this.entities.filter(e=>e.type===type&&e.health>0&&e.growingAge===0&&e.love>0);
    for(const a of adults){if(!a.love)continue;const b=adults.find(b=>b!==a&&b.love>0&&Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<3);
      if(!b){a.mateTicks=0;continue;}if(++a.mateTicks<60)continue;if(this.entities.length>=40)continue;
      const baby=this.create(type,a.x,a.y,a.z);baby.growingAge=-24000;
      // EntitySheep.createChild (wp.b(rx)): the lamb's colour is the parents' dye mix.
      if(type==='sheep')baby.color=childColor(a.color,b.color,this.random);
      this.entities.push(baby);a.growingAge=b.growingAge=6000;a.love=b.love=0;a.mateTicks=b.mateTicks=0;
      this.events.push({hearts:true,position:{x:a.x,y:a.y+1,z:a.z}},{xp:1+Math.floor(Math.random()*7),position:{x:a.x,y:a.y,z:a.z}});
    }
    }
  }
  // EntitySheep.interact (wp.a(yz)) with shears (ade.aZ) held: an unsheared adult
  // is sheared, drops 1 to 3 wool of its colour (entityDropItem(stack, 1.0F) with
  // motionY += rand * 0.05 and motionX/Z += (rand - rand) * 0.1), plays mob.sheep.shear
  // and the shears lose 1 durability (not in Creative).
  shear(e,id,survival){
    if(!this.entities.includes(e)||e.health<=0||e.type!=='sheep'||id!==125||e.sheared||e.growingAge<0)return false;
    if(!survival.creative&&!survival.count(id))return false;
    const r=this.random,n=1+Math.floor(r()*3);e.sheared=true;
    for(let i=0;i<n;i++){const my=f(r()*f(0.05)),mx=f(f(r()-r())*f(0.1)),mz=f(f(r()-r())*f(0.1));
      this.events.push({drop:WOOL,count:1,damage:e.color,offsetY:1,kick:[mx,my,mz],position:{x:e.x,y:e.y,z:e.z}});}
    this.events.push({sound:'mob.sheep.shear',volume:1,position:{x:e.x,y:e.y,z:e.z}});
    if(!survival.creative)survival.wear(id,1);
    return true;
  }
  // EntityAIEatGrass (ud), mutexBits 7. EntityAITasks looks for new tasks every
  // third tick: shouldExecute rolls 1 in 1000 (1 in 50 for a lamb) and needs tall
  // grass at the feet or a grass block below. The timer starts at 40 (event 10 tells
  // the client) and counts down; at 4 the tall grass is destroyed without a drop, or
  // the grass block turns to dirt (level event 2001), and EntitySheep.eatGrassBonus
  // (wp.p) clears the sheared flag and ages a lamb by 60 seconds. Returns whether
  // the sheep is grazing this tick.
  graze(e){
    const w=this.world,x=Math.floor(e.x),y=Math.floor(e.y),z=Math.floor(e.z);
    if(!e.eatTimer){
      if(e.age%3!==0||Math.floor(this.random()*(e.growingAge<0?50:1000))!==0)return false;
      if(w.get(x,y,z)!==39&&w.get(x,y-1,z)!==1)return false;
      e.eatTimer=40;
    }
    e.eatTimer=Math.max(0,e.eatTimer-1);
    if(e.eatTimer===4){
      let at=null;
      if(w.get(x,y,z)===39)at=[x,y,z,39];else if(w.get(x,y-1,z)===1)at=[x,y-1,z,1];
      if(at){
        w.set?.(at[0],at[1],at[2],at[3]===39?0:2);
        this.events.push({eatGrass:{x:at[0],y:at[1],z:at[2],block:at[3]}});
        e.sheared=false;
        if(e.growingAge<0)e.growingAge=Math.min(0,e.growingAge+1200);
      }
    }
    return true;
  }
  // Breeding partner, tempting player or parent a passive animal walks to this
  // tick, in AI task priority order (mate 2, tempt 3, follow parent 4); null when
  // panicking or when none applies. `stop` is how close it gets.
  goal(e,player,survival,heldItem,distance,ai){
    const wheat=BREED_ITEM[e.type];
    if(!wheat||e.flee)return null;
    if(e.love>0&&e.growingAge===0){
      const partner=this.entities.find(b=>b!==e&&b.type===e.type&&b.love>0&&b.health>0&&b.growingAge===0);
      if(partner)return{target:partner,speed:ai.mate,stop:1};
    }
    if(heldItem===wheat&&(survival.creative||survival.count(wheat))&&distance<10)return{target:player,speed:ai.tempt,stop:2.5};
    if(e.growingAge<0){
      const mother=this.entities.find(b=>b!==e&&b.type===e.type&&b.growingAge>=0&&b.health>0&&Math.hypot(b.x-e.x,b.z-e.z)<8);
      if(mother)return{target:mother,speed:ai.follow,stop:2};
    }
    return null;
  }
  tick(player, survival, heldItem=0) {
    const night =
      survival.time % 24000 > 13000 && survival.time % 24000 < 23000;
    this.spawnClock++;
    if (
      night &&
      !survival.creative &&
      this.spawnClock >= 200 &&
      this.entities.filter((e) => e.type === "zombie").length < 5
    ) {
      this.spawnClock = 0;
      for (let i = 0; i < 16; i++) {
        const a = hash(i, survival.time, this.world.numericSeed) * Math.PI * 2,
          x = Math.floor(player.x + Math.sin(a) * 24),
          z = Math.floor(player.z + Math.cos(a) * 24);
        if (x < 2 || z < 2 || x > SIZE - 2 || z > SIZE - 2) continue;
        const y = this.world.surface(x, z);
        if (this.world.get(x, y - 1, z) !== 1) continue;
        this.entities.push(this.create("zombie", x + 0.5, y, z + 0.5));
        break;
      }
    }
    for (const e of this.entities) {
      // World.updateEntityWithOptionalForce and EntityLivingBase.onEntityUpdate
      // keep last tick's state for RenderManager and RendererLivingEntity.
      e.px = e.x;
      e.py = e.y;
      e.pz = e.z;
      e.prevRotationYaw = e.rotationYaw;
      e.prevRenderYawOffset = e.renderYawOffset;
      e.prevRotationYawHead = e.rotationYawHead;
      e.prevRotationPitch = e.rotationPitch;
      e.prevLimbSwingAmount = e.limbSwingAmount;
      const base=ENTITY_TYPES[e.type],scale=e.growingAge<0?.5:1,t={...base,width:base.width*scale,height:base.height*scale};
      if (e.health <= 0) {
        // A dying mob still runs onLivingUpdate with its movement blocked (sv.bh):
        // it slides on its knockback and falls, with no AI input.
        e.death = (e.death || 0) + 1;
        e.jumping = false;
        this.walk(e, t, 0);
        this.swingLimbs(e);
        continue;
      }
      e.age++;
      if(e.growingAge<0)e.growingAge++;else if(e.growingAge>0)e.growingAge--;
      e.love=Math.max(0,e.love-1);
      if(e.love&&e.age%10===0)this.events.push({hearts:true,position:{x:e.x,y:e.y+1,z:e.z}});
      e.hurt = Math.max(0, e.hurt - 1);
      e.attack = Math.max(0, e.attack - 1);
      e.flee = Math.max(0, e.flee - 1);
      const distance = Math.hypot(e.x - player.x, e.z - player.z);
      let speed = 0;
      const goal = this.goal(e, player, survival, heldItem, distance, base.ai);
      // Swimming (0), panic (1), mate (2), tempt (3) and follow parent (4) all take over from eating grass (5).
      if (e.eatTimer && (e.flee || goal || e.inWater)) e.eatTimer = 0;
      if (
        e.type === "zombie" &&
        !survival.creative &&
        distance < 30 &&
        survival.health > 0
      ) {
        e.yaw = Math.atan2(player.x - e.x, player.z - e.z);
        speed = distance > 1.1 ? aiMoveSpeed(e, base.ai.chase) : 0;
        if (
          distance < 1.4 &&
          Math.abs(e.y - player.y) < 1.5 &&
          e.attack === 0 &&
          !voxelRay(
            this.world,
            { x: e.x, y: e.y + 1.2, z: e.z },
            {
              x: (player.x - e.x) / Math.max(0.01, distance),
              y: 0,
              z: (player.z - e.z) / Math.max(0.01, distance),
            },
            distance,
          )
        ) {
          survival.damage(t.damage, "a zombie", true);
          e.attack = 20;
        }
      } else if (goal) {
        e.yaw=Math.atan2(goal.target.x-e.x,goal.target.z-e.z);
        speed=Math.hypot(goal.target.x-e.x,goal.target.z-e.z)>goal.stop?aiMoveSpeed(e,goal.speed):0;
        e.walking=speed>0;
      } else if (e.flee) {
        speed = aiMoveSpeed(e, base.ai.panic);
      } else if (e.type === "sheep" && this.graze(e)) {
        // Grazing holds the sheep still (mutex bits 7: move, look and jump).
      } else {
        if (--e.wander <= 0) {
          e.yaw =
            hash(e.age, e.id.length, this.world.numericSeed) * Math.PI * 2;
          e.wander = 60 + Math.floor(hash(e.age, 7, 4) * 120);
          e.walking = hash(e.age, 1, e.id.length) > 0.35;
        }
        if (e.walking) speed = aiMoveSpeed(e, base.ai.wander);
      }
      if (e.type === "zombie" && !night) {
        let sky = true;
        for (let y = Math.floor(e.y + t.height); y < HEIGHT; y++)
          if (this.world.solid(Math.floor(e.x), y, Math.floor(e.z))) {
            sky = false;
            break;
          }
        e.burn = sky ? 1 : 0;
        if (sky && e.age % 20 === 0) {
          e.health--;
          e.hurt = 8;
          e.lastDamage = 1;
        }
      } else e.burn = 0;
      // EntityMoveHelper/EntityJumpHelper, simplified: a blocked mob hops a one-high
      // step (jump 0.42 clears 1.25) and otherwise turns away; EntityAISwimming (uf)
      // jumps 80% of ticks in water.
      e.jumping = false;
      if (e.inWater = inWater(this.world, e, t.width, t.height)) e.fallDistance = 0;
      if (e.inWater && Math.random() < 0.8) e.jumping = true;
      else if (speed > 0 && e.collidedH && e.onGround) {
        const ax = e.x + Math.sin(e.yaw) * 0.5, az = e.z + Math.cos(e.yaw) * 0.5;
        if (actorCollides(this.world, ax, e.y, az, t.width, t.height)) {
          if (!actorCollides(this.world, e.x, e.y + 1, e.z, t.width, t.height) && !actorCollides(this.world, ax, e.y + 1, az, t.width, t.height)) e.jumping = true;
          else e.yaw += Math.PI * 0.55;
        }
      }
      this.walk(e, t, speed);
      this.turnBody(e);
      this.swingLimbs(e);
      if (e.age % 160 === 0 && distance < 18)
        this.events.push({
          sound: "mob." + e.type + ".say",
          position: { x: e.x, y: e.y, z: e.z },
        });
      if (e.health <= 0 && !e.death) {
        e.death = 1;
        this.events.push({ sound: "mob.zombie.death", position: e });
        this.events.push({
          drop: t.drop,
          count: 1,
          position: { x: e.x, y: e.y, z: e.z },
        });
      }
      if (e.y < 0) {
        e.health = 0;
        e.death = 20;
      }
    }
    this.breed();
    this.entities = this.entities.filter((e) => e.health > 0 || e.death < 20);
  }
  // Motion half of EntityLivingBase.onLivingUpdate (sv.e()): jump delay, motion
  // below 0.005 snapped to 0, EntityMoveHelper (tv.c) turning a move target into
  // aiMoveSpeed and moveForward (zeroed when idle), the jump (0.04 in water, else
  // jump() on the ground every 10 ticks), moveForward x 0.98, then
  // moveEntityWithHeading. `speed` is the setAIMoveSpeed value or 0.
  walk(e, t, speed) {
    if (e.jumpTicks > 0) e.jumpTicks--;
    if (Math.abs(e.vx) < 0.005) e.vx = 0;
    if (Math.abs(e.vy) < 0.005) e.vy = 0;
    if (Math.abs(e.vz) < 0.005) e.vz = 0;
    e.moveForward = 0;
    if (speed > 0) e.aiMoveSpeed = e.moveForward = speed;
    this.aimYaw(e);
    if (e.jumping) {
      if (e.inWater) e.vy += 0.03999999910593033;
      else if (e.onGround && e.jumpTicks === 0) {
        jump(e);
        e.jumpTicks = 10;
      }
    } else e.jumpTicks = 0;
    e.moveForward = f(e.moveForward * f(0.98));
    const landed = moveEntityWithHeading(this.world, e, t.width, t.height, e.moveForward);
    // The finite world's edge stops a mob like a wall.
    const edge = (axis, v) => {
      const c = Math.max(0.6, Math.min(SIZE - 0.6, e[axis]));
      if (c !== e[axis]) (e[axis] = c), (e[v] = 0);
    };
    edge("x", "vx");
    edge("z", "vz");
    if (landed > 0) this.fall(e, landed);
  }
  // Entity.rotationYaw (Java degrees) follows the AI's e.yaw by the wrapped
  // difference from last tick, so moveFlying sees this tick's heading.
  aimYaw(e) {
    e.rotationYaw = f(e.prevRotationYaw + wrapDegrees(f(javaYaw(e) - e.prevRotationYaw)));
  }
  // EntityBodyHelper.func_75664_a (tr.a), reached through EntityLiving.func_110146_f
  // (sw.f) for AI-enabled mobs; the yaw wraps of EntityLivingBase.onUpdate (sv.h) follow.
  // Simplified: the head faces e.yaw at once (no EntityLookHelper turn limit).
  turnBody(e) {
    const dx = e.x - e.px, dz = e.z - e.pz;
    this.aimYaw(e);
    e.rotationYawHead = e.rotationYaw;
    if (dx * dx + dz * dz > 2.500000277905201e-7) {
      e.renderYawOffset = e.rotationYaw;
      e.rotationYawHead = clampYaw(e.renderYawOffset, e.rotationYawHead, 75);
      e.bodyHeadYaw = e.rotationYawHead;
      e.bodyTicks = 0;
    } else {
      let limit = 75;
      if (Math.abs(f(e.rotationYawHead - e.bodyHeadYaw)) > 15) {
        e.bodyTicks = 0;
        e.bodyHeadYaw = e.rotationYawHead;
      } else if (++e.bodyTicks > 10) limit = f(Math.max(f(1 - f(f(e.bodyTicks - 10) / 10)), 0) * 75);
      e.renderYawOffset = clampYaw(e.rotationYawHead, e.renderYawOffset, limit);
    }
    e.prevRotationYaw = nearAngle(e.prevRotationYaw, e.rotationYaw);
    e.prevRenderYawOffset = nearAngle(e.prevRenderYawOffset, e.renderYawOffset);
    e.prevRotationPitch = nearAngle(e.prevRotationPitch, e.rotationPitch);
    e.prevRotationYawHead = nearAngle(e.prevRotationYawHead, e.rotationYawHead);
  }
  // Tail of EntityLivingBase.moveEntityWithHeading (sv.e(FF)): limbSwingAmount
  // eases 0.4 of the way to four times this tick's horizontal travel (cap 1)
  // and limbSwing advances by it. Dying mobs keep running it.
  swingLimbs(e) {
    const dx = e.x - e.px, dz = e.z - e.pz,
      target = Math.min(f(f(Math.sqrt(dx * dx + dz * dz)) * 4), 1);
    e.limbSwingAmount = f(e.limbSwingAmount + f(f(target - e.limbSwingAmount) * f(0.4)));
    e.limbSwing = f(e.limbSwing + e.limbSwingAmount);
  }
  serialize() {
    return this.entities.filter((e) => e.health > 0).map((e) => {
      const saved = { ...e };
      for (const key of INTERPOLATED) delete saved[key];
      return saved;
    });
  }
  drain() {
    const events = this.events;
    this.events = [];
    return events;
  }
}
