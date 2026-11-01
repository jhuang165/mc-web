import { spiderAttack, spiderDrops, spiderFindsPlayer, STRING, SPIDER_EYE } from "./spider.js";
import {CARROT,zombieRareDrop} from './crops.js';
import { creeperFields, creeperTick, creeperFall, creeperDrops, GUNPOWDER } from "./creeper.js";
import { SIZE, HEIGHT, hash, slipperiness, collisionBounds, normalCube, WOOL, isLiquid, DYE } from "./world.js";
import { isOnLadder, ladderClamp, LADDER_CLIMB, countsVertical } from "./ladders.js";
import { ITEMS } from "./survival.js";
import { mhSin, mhCos, JavaRandom } from "./lighting.js";
import { enterWater, burst } from "./fx.js";
import { waterAcceleration, entityWaterBox, inLava } from "./fluids.js";
import { sheepColor, childColor } from "./sheep.js";
import { sneakEdge, criticalDamage } from "./player-movement.js";
import { MobAI } from "./ai.js";
import { webMove } from './webs.js';
import { blockCollisions } from "./block-collisions.js";
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
// Entity.rand, one java.util.Random per entity; never saved.
const RANDOMS = new WeakMap();
export const entityRandom = (e) => {
  let r = RANDOMS.get(e);
  if (!r) RANDOMS.set(e, (r = new JavaRandom(Math.floor(Math.random() * 2 ** 48))));
  return r;
};
const TRANSIENT = ["inWeb", "onGround", "collidedH", "inWater", "fallDistance", "moveForward", "aiMoveSpeed", "jumping", "jumpTicks", "lastDamage", "inLava", "fire", "idle", "revenge", "recentlyHit"];
const INTERPOLATED = [...TRANSIENT, "eggTimer", "wingRotation", "destPos", "oFlapSpeed", "oFlap", "wingRotDelta", "px", "py", "pz", "rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "rotationPitch", "prevRotationPitch", "limbSwing", "limbSwingAmount", "prevLimbSwingAmount", "bodyTicks", "bodyHeadYaw", "gait"];
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
// RenderChicken.handleRotationFloat (bng.a(wg, F)F): the wing angle fed to the
// model as ageInTicks, (sin(oFlap + (wingRotation - oFlap) * partial) + 1) *
// (oFlapSpeed + (destPos - oFlapSpeed) * partial), with MathHelper.sin's table.
export function chickenFlap(e, partial) {
  const p = f(partial), a = f(e.oFlap + f(f(e.wingRotation - e.oFlap) * p)), b = f(e.oFlapSpeed + f(f(e.destPos - e.oFlapSpeed) * p));
  return f(f(mhSin(a) + 1) * b);
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
    ...(e.type === "chicken" ? { flap: chickenFlap(e, p) } : {}),
    ...(e.type === "sheep" ? { headDrop: sheepHeadDrop(e.eatTimer || 0, p), headTilt: sheepHeadPitch(e.eatTimer || 0, p, headPitch) } : {}),
    x: lerp(e.px, e.x), y: lerp(e.py, e.y), z: lerp(e.pz, e.z),
    bodyYaw: body, headYaw: f(head - body),
    headPitch,
    limbSwing: swing, limbSwingAmount: amount, age: e.age + p, death: e.type === "spider" ? death * 2 : death,
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
  // EntityChicken (wg): 0.3 x 0.7, 4 health, speed 0.25; panic 1.4, mate 1.0, tempt
  // (wheat seeds, ade.N) 1.0, follow parent 1.1, wander 1.0. No `drop`: feathers and
  // chicken come from its own dropFewItems (wg.b(ZI)).
  chicken: { health: 4, width: f(0.3), height: f(0.7), movement: 0.25, ai: { wander: 1, mate: 1, panic: 1.4, tempt: 1, follow: 1.1 }, drop: 0 },
  zombie: {
    health: 20,
    width: 0.6,
    height: 1.8,
    movement: f(0.23),
    ai: { wander: 1, chase: 1 },
    damage: 3,
    drop: 206,
  },
  // EntitySpider (yn): legacy AI uses speed 0.8 as input, fixed 0.1 land acceleration.
  spider: { health: 16, width: f(1.4), height: f(0.9), movement: f(0.8), ai: { wander: 1 }, damage: 2, drop: 0 },
  // EntitySkeleton (yl): 0.6 x 1.8, 20 health, speed 0.25 (applyEntityAttributes). Its
  // arrow and bone drops are rolled in `kill`, so there is no `drop`; the task
  // speeds (ArrowAttack 1.0, FleeSun 1.0, Wander 1.0) are in the AI's brain.
  skeleton: { health: 20, width: 0.6, height: 1.8, movement: 0.25, ai: { wander: 1 }, drop: 0 },
  // EntityCreeper (xz): 0.6 x 1.8, EntityMob's 20 health, speed 0.25; EntityAIAttackOnCollide
  // 1.0 and EntityAIWander 0.8. `damage` is EntityMob's attackDamage 2, which the swell
  // task (mutex 1, ahead of the attack) keeps from ever being dealt. Gunpowder comes from
  // `kill` (creeper.js creeperDrops).
  creeper: { health: 20, width: 0.6, height: 1.8, movement: 0.25, ai: { wander: 0.8, chase: 1 }, damage: 2, drop: 0 },
};
// EntityMob subclasses: no panic counter, 5 experience, despawning, 0.5 - brightness path weights.
export const HOSTILE = new Set(["zombie", "skeleton", "spider", "creeper"]);
// EntityMoveHelper.onUpdateMoveHelper (tv.c) hands EntityLiving.setAIMoveSpeed
// (sw.i) `(float)(speed * movementSpeed)`; sw.i also sets moveForward to it. The
// zombie's "Baby speed boost" (yq.br) is operation 1: base * (1 + 0.5).
export function aiMoveSpeed(e, multiplier) {
  const base = ENTITY_TYPES[e.type].movement;
  return f(multiplier * (e.type === "zombie" && e.growingAge < 0 ? base + base * 0.5 : base));
}
// Wheat (ade.O) breeds and tempts cows and sheep; chickens take wheat seeds (309, any
// ItemSeeds in the original) through EntityAITempt / isBreedingItem.
// Pigs use only carrots (ade.bF), including the carrot held by EntityAITempt.
const BREED_ITEM = { pig: CARROT, cow: 305, sheep: 305, chicken: 309 };
export const EGG = 316, FEATHER = 317, RAW_CHICKEN = 318, COOKED_CHICKEN = 319;
// getHurtSound / getDeathSound: the pig says its hurt sound, the cow's death sound is
// its hurt sound, and the sheep uses mob.sheep.say for say, hurt and death alike.
const hurtSound = (type) => (type === "pig" ? "mob.pig.say" : (type === "sheep" || type === "spider" || type === "creeper") ? "mob." + type + ".say" : "mob." + type + ".hurt");
// EntityChicken's death sound is its hurt sound as well.
const deathSound = (type) => (type === "sheep" ? "mob.sheep.say" : "mob." + type + (type === "cow" || type === "chicken" ? ".hurt" : ".death"));
// Chunk.canBlockSeeTheSky without a height map (weather.js `canSeeSky` is the real one
// that main.js hooks in): no solid block at or above (x, y, z).
const openSky = (world, x, y, z) => {
  for (let yy = Math.max(0, y); yy < HEIGHT; yy++) if (world.solid(x, yy, z)) return false;
  return true;
};
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
// World.getCollidingBoundingBoxes (ahb.a): block boxes overlapping `b`, as
// [minX, minY, minZ, maxX, maxY, maxZ]. The scan starts a block low like the original.
function collisionBoxes(world, b) {
  const out = [];
  for (let bx = Math.floor(b[0]); bx < Math.floor(b[3] + 1); bx++)
    for (let by = Math.floor(b[1]) - 1; by < Math.floor(b[4] + 1); by++)
      for (let bz = Math.floor(b[2]); bz < Math.floor(b[5] + 1); bz++)
        if (world.solid(bx, by, bz)) {
          const [a, c, d, g, h, i] = collisionBounds(world, bx, by, bz);
          if (bx + g > b[0] && bx + a < b[3] && by + h > b[1] && by + c < b[4] && bz + i > b[2] && bz + d < b[5]) out.push([bx + a, by + c, bz + d, bx + g, by + h, bz + i]);
        }
  return out;
}
// Entity.func_145771_j [sa.j(DDD)Z], used by items and XP orbs (the player overrides it,
// pushOutOfBlocks): when the box overlaps a block collision box or the cell of (cx, cy, cz) is a
// normal cube, push towards the nearest side whose neighbour is not a normal cube, never down and
// up by default, at rand.nextFloat() * 0.2F + 0.1F. Returns [axis (0 x, 1 y, 2 z), motion] or null.
export function entityPushOut(world, cx, cy, cz, box, random) {
  const x = Math.floor(cx), y = Math.floor(cy), z = Math.floor(cz);
  if (!collisionBoxes(world, box).length && !normalCube(world.get(x, y, z))) return null;
  const fx = cx - x, fy = cy - y, fz = cz - z, open = (dx, dy, dz) => !normalCube(world.get(x + dx, y + dy, z + dz));
  let side = 3, best = 9999;
  if (open(-1, 0, 0) && fx < best) (best = fx), (side = 0);
  if (open(1, 0, 0) && 1 - fx < best) (best = 1 - fx), (side = 1);
  if (open(0, 1, 0) && 1 - fy < best) (best = 1 - fy), (side = 3);
  if (open(0, 0, -1) && fz < best) (best = fz), (side = 4);
  if (open(0, 0, 1) && 1 - fz < best) (best = 1 - fz), (side = 5);
  const speed = f(f(f(random()) * f(0.2)) + f(0.1));
  return side === 0 ? [0, -speed] : side === 1 ? [0, speed] : side === 3 ? [1, speed] : side === 4 ? [2, -speed] : [2, speed];
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
// EntityPlayerSP.onLivingUpdate, after the sneak ySize raise: func_145771_j [blk.j(DDD)Z] at the
// box's four corners (posX -/+ width * 0.35, minY + 0.5, posZ +/- width * 0.35) in this order.
// A corner whose cell or the cell above is a normal cube sets motionX or motionZ to -/+0.1F
// towards the nearest side whose two cells are clear (x tested before z, ties keep the first);
// later corners overwrite earlier ones. Never up or down, unlike the Entity version in item-entities.js.
const PUSH_OUT = f(0.1);
export function pushOutOfBlocks(world, e, width) {
  const r = f(width) * 0.35, y = e.y + 0.5;
  for (const [sx, sz] of [[-1, 1], [-1, -1], [1, -1], [1, 1]]) pushOutCorner(world, e, e.x + sx * r, y, e.z + sz * r);
}
function pushOutCorner(world, e, px, py, pz) {
  const x = Math.floor(px), y = Math.floor(py), z = Math.floor(pz), fx = px - x, fz = pz - z,
    blocked = (dx, dz) => normalCube(world.get(x + dx, y, z + dz)) || normalCube(world.get(x + dx, y + 1, z + dz));
  if (!blocked(0, 0)) return;
  let side = -1, best = 9999;
  if (!blocked(-1, 0) && fx < best) (best = fx), (side = 0);
  if (!blocked(1, 0) && 1 - fx < best) (best = 1 - fx), (side = 1);
  if (!blocked(0, -1) && fz < best) (best = fz), (side = 4);
  if (!blocked(0, 1) && 1 - fz < best) (best = 1 - fz), (side = 5);
  if (side === 0) e.vx = -PUSH_OUT;
  if (side === 1) e.vx = PUSH_OUT;
  if (side === 4) e.vz = -PUSH_OUT;
  if (side === 5) e.vz = PUSH_OUT;
}

// Entity.moveEntity (sa.d(DDD)) for a walking mob: y first, then x, then z
// against the block boxes; when a horizontal move is blocked while on the
// ground, retry with stepHeight (0.5) and keep that result unless it is no
// farther. Sets the collided/onGround flags, zeroes motion on blocked axes and
// runs Entity.updateFallState (sa.a(DZ)V); returns the fall distance on landing.
// The player also passes `ySize` (after onLivingUpdate's sneak raise); it decays here.
// `step` is Entity.stepHeight (0 for EntityTNTPrimed, which never steps). The tail runs the block
// collisions and the burning-box test (block-collisions.js) with `hooks`; without them only webs.
export function moveEntity(world, e, w, h, dx, dy, dz, step = STEP_HEIGHT, hooks) {
  // Entity.width/height are floats (setSize), so the box edges use their float values.
  w = f(w);
  h = f(h);
  if (e.inWeb) {
    const requested = { vx: dx, vy: dy, vz: dz };
    [dx, dy, dz] = webMove(e, requested);
    e.vx = e.vy = e.vz = 0;
  }
  // Entity.moveEntity begins with ySize *= 0.4F (only the player's eye drop uses it).
  if (e.ySize !== undefined) e.ySize = f(e.ySize * f(0.4));
  // A sneaking EntityPlayer on the ground never walks off an edge (player-movement.js).
  const sneakEdgeOn = !!(e.sneaking && e.onGround);
  if (sneakEdgeOn)
    [dx, dz] = sneakEdge(dx, dz, (ox, oz) => !collisionBoxes(world, [e.x - w / 2 + ox, e.y - 1, e.z - w / 2 + oz, e.x + w / 2 + ox, e.y - 1 + h, e.z + w / 2 + oz]).length);
  const odx = dx, ody = dy, odz = dz, half = w / 2,
    // An entity that keeps its bounding box (`e.bb`, as Entity.boundingBox) moves that
    // box itself, so its centre carries the same rounding as the original.
    bb = e.bb ? e.bb.slice() : [e.x - half, e.y, e.z - half, e.x + half, e.y + h, e.z + half],
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
  // The step retry also needs the sneak-edge flag or ySize < 0.05F: an eye still lowered
  // from sneaking (0.08 on the first tick after release) does not step.
  if (step > 0 && grounded && (sneakEdgeOn || !(e.ySize >= f(0.05))) && (odx !== dx || odz !== dz)) {
    const sx = dx, sy = dy, sz = dz, flat = bb.slice();
    dx = odx; dy = step; dz = odz;
    bb.splice(0, 6, ...start);
    list = collisionBoxes(world, grow(bb, odx, step, odz));
    for (const o of list) dy = offsetY(o, bb, dy);
    shift(bb, 0, dy, 0);
    for (const o of list) dx = offsetX(o, bb, dx);
    shift(bb, dx, 0, 0);
    for (const o of list) dz = offsetZ(o, bb, dz);
    shift(bb, 0, 0, dz);
    dy = -step;
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
  if (e.bb) e.bb = bb;
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
  blockCollisions(world, bb, e, hooks);
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
// (dx, dy, dz) has no block in it and no liquid.
function offsetInLiquid(world, e, w, h, dx, dy, dz) {
  const half = w / 2, b = [e.x - half + dx, e.y + dy, e.z - half + dz, e.x + half + dx, e.y + h + dy, e.z + half + dz];
  if (collisionBoxes(world, b).length) return false;
  for (let bx = Math.floor(b[0]); bx < Math.floor(b[3] + 1); bx++)
    for (let by = Math.floor(b[1]); by < Math.floor(b[4] + 1); by++)
      for (let bz = Math.floor(b[2]); bz < Math.floor(b[5] + 1); bz++)
        if (isLiquid(world.get(bx, by, bz))) return false;
  return true;
}
// EntityLivingBase.jump (sv.bj): 0.42 upward (no jump boost, no sprint).
export function jump(e) {
  e.vy = 0.41999998688697815;
}
// EntityLivingBase.moveEntityWithHeading (sv.e(FF)), without strafe. AI mobs
// accelerate at 0.04 in water (legacy spiders 0.02); drag is 0.8. Lava uses
// acceleration 0.02 and drag 0.5; gravity is 0.02 in either liquid. On land,
// friction is 0.91 * block slipperiness. Acceleration is aiMoveSpeed (spiders:
// fixed 0.1) * 0.16277136 / friction^3; 0.02 in the air. Spiders can climb.
// Gravity is 0.08 with 0.98 vertical drag. Returns the landing fall distance.
export function moveEntityWithHeading(world, e, w, h, forward, hooks) {
  let landed;
  if (e.inWater) {
    const y0 = e.y;
    moveFlying(e, 0, forward, f(e.type === "spider" ? 0.02 : 0.04));
    landed = moveEntity(world, e, w, h, e.vx, e.vy, e.vz, STEP_HEIGHT, hooks);
    e.vx *= 0.800000011920929;
    e.vy *= 0.800000011920929;
    e.vz *= 0.800000011920929;
    e.vy -= 0.02;
    if (e.collidedH && offsetInLiquid(world, e, w, h, e.vx, e.vy + 0.6 - e.y + y0, e.vz)) e.vy = 0.30000001192092896;
  } else if (e.inLava) {
    const y0 = e.y;
    moveFlying(e, 0, forward, f(0.02));
    landed = moveEntity(world, e, w, h, e.vx, e.vy, e.vz, STEP_HEIGHT, hooks);
    e.vx *= 0.5;
    e.vy *= 0.5;
    e.vz *= 0.5;
    e.vy -= 0.02;
    if (e.collidedH && offsetInLiquid(world, e, w, h, e.vx, e.vy + 0.6 - e.y + y0, e.vz)) e.vy = 0.30000001192092896;
  } else {
    // The block under the feet (floor(minY) - 1) only counts while on the ground.
    const slip = () => (e.onGround ? f(slipperiness(world.get(Math.floor(e.x), Math.floor(e.y) - 1, Math.floor(e.z))) * f(0.91)) : f(0.91));
    let friction = slip();
    const accel = f(f(0.16277136) / f(f(friction * friction) * friction));
    moveFlying(e, 0, forward, e.onGround ? f((e.type === "spider" ? f(0.1) : e.aiMoveSpeed) * accel) : JUMP_MOVEMENT_FACTOR);
    friction = slip();
    // isOnLadder: EntitySpider's override is its wall flag; others test the ladder cell (ladders.js).
    const climbable = () => (e.type === "spider" ? e.climbing : isOnLadder(world, e.x, e.y, e.z));
    if (climbable()) {
      ladderClamp(e, e.player && e.sneaking, ["vx", "vy", "vz"]);
      e.fallDistance = 0;
    }
    landed = moveEntity(world, e, w, h, e.vx, e.vy, e.vz, STEP_HEIGHT, hooks);
    if (e.collidedH && climbable()) e.vy = LADDER_CLIMB;
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
    // The client Fx (main.js) the death puffs, splashes and feeding hearts spawn into.
    this.fx = null;
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
        const fresh = this.create(e.type, e.x, e.y, e.z);
        this.entities.push(syncInterpolation({
          ...fresh,
          ...e,
          id: /^mob-\d+$/.test(e.id) ? e.id : "mob-" + this.nextId++,
          health: Math.min(t.health, e.health),
          yaw: Number.isFinite(e.yaw) ? e.yaw : 0,
          age: Number.isFinite(e.age) ? e.age : 0,
          growingAge:Number.isInteger(e.growingAge)?Math.max(-24000,Math.min(6000,e.growingAge)):0,
          love:Number.isInteger(e.love)?Math.max(0,Math.min(600,e.love)):0,
          mateTicks:0,
          ...(e.type === "sheep" ? { color: Number.isInteger(e.color) && e.color >= 0 && e.color < 16 ? e.color : 0, sheared: e.sheared === true, eatTimer: 0 } : {}),
          // timeUntilNextEgg is not saved in 1.7.10: a fresh roll from create, whatever the save says.
          ...(e.type === "chicken" ? { eggTimer: fresh.eggTimer } : {}),
          ...(e.type === "spider" ? { climbing: false, spiderTarget: false, spiderRevenge: 0, stepDistance: 0, nextStep: 1 } : {}),
          // EntityCreeper.readEntityFromNBT: "powered" and "ignited" are saved, the swell
          // state (datawatcher 16) and timeSinceIgnited start over.
          ...(e.type === "creeper" ? { ...creeperFields(), powered: e.powered === true, ignited: e.ignited === true } : {}),
          wander: 0,
          hurt: 0,
          recentlyHit: 0,
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
      revenge: 0,
      recentlyHit: 0,
      idle: 0,
      burn: 0,
      growingAge:0,love:0,mateTicks:0,
      // EntitySheep.func_110161_a: a natural fleece colour; bit 16 of datawatcher
      // byte 16 (`sheared`); and the grazing timer (EntityAIEatGrass, mirrored in wp.br).
      ...(type === "sheep" ? { color: sheepColor(random), sheared: false, eatTimer: 0 } : {}),
      // EntityChicken (wg): timeUntilNextEgg = rand.nextInt(6000) + 6000 (wg.bu; not saved in
      // 1.7.10), wingRotation/destPos and their previous values 0, wingRotDelta (bt) 1.0.
      ...(type === "spider" ? { climbing: false, spiderTarget: false, spiderRevenge: 0, stepDistance: 0, nextStep: 1 } : {}),
      ...(type === "creeper" ? creeperFields() : {}),
      ...(type === "chicken" ? { eggTimer: Math.floor(random() * 6000) + 6000, wingRotation: 0, destPos: 0, oFlapSpeed: 0, oFlap: 0, wingRotDelta: 1 } : {}),
      // EntityZombie.func_110161_a adds a 0 to 0.05 "Random spawn bonus" to knockbackResistance.
      knockbackResistance: type === "zombie" ? random() * 0.05000000074505806 : 0,
      ...this.physics(),
    });
  }
  // EntityEgg.onImpact (zl.a): a chick (EntityChicken, setGrowingAge(-24000)) at the
  // egg's position with the egg's rotationYaw (Java degrees) and pitch 0. Capped at
  // the 40 mobs a save keeps.
  hatch(x, y, z, yawDegrees) {
    if (this.entities.length >= 40) return null;
    const chick = this.create("chicken", x, y, z);
    chick.growingAge = -24000;
    chick.yaw = (-yawDegrees * Math.PI) / 180;
    syncInterpolation(chick);
    this.entities.push(chick);
    return chick;
  }
  // Fresh motion state: grounded only after the first collision, no AI move target yet.
  physics() {
    return { onGround: false, collidedH: false, inWater: null, inLava: false, fire: 0, fallDistance: 0, moveForward: 0, aiMoveSpeed: 0, jumping: false, jumpTicks: 0, lastDamage: 0 };
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
        // SpawnListEntry weights for a plains biome's creatures: sheep 12, pig 10, chicken 10, cow 8.
        const y = this.world.surface(x, z), roll = hash(i, 51, this.world.numericSeed) * 40, type = roll < 12 ? "sheep" : roll < 22 ? "pig" : roll < 32 ? "chicken" : "cow", t = ENTITY_TYPES[type];
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
  damage(e, amount, fromX, fromZ, byPlayer = true) {
    if (!this.entities.includes(e) || e.health <= 0) return false;
    if (e.hurt > 0) {
      if (amount <= e.lastDamage) return false;
      e.health -= amount - e.lastDamage;
    } else {
      e.health -= amount;
      e.hurt = 10;
    }
    e.lastDamage = amount;
    // EntityAnimal.attackEntityFrom sets fleeingTick = 60 (kept as a counter; nothing
    // reads it any more) and resets love; EntityLivingBase.attackEntityFrom sets the
    // revenge target (the attacker, always the player here), which EntityAIPanic and
    // EntityAIHurtByTarget read. The mob is not turned: panic walks it away.
    if (!HOSTILE.has(e.type)) e.flee = 60;
    e.love=0;e.mateTicks=0;
    // A mob shot by another mob's arrow has no player to take revenge on.
    if (byPlayer) { e.revenge = (e.age || 0) + 1; e.recentlyHit = 100; }
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
  // The entity as Crit2FX follows it: position, box floor, size (halved for a child), motion.
  fxTarget(e) {
    const t = ENTITY_TYPES[e.type], s = e.growingAge < 0 ? 0.5 : 1;
    return { x: e.x, z: e.z, minY: e.y, width: f(t.width * s), height: f(t.height * s), mx: e.vx, my: e.vy, mz: e.vz };
  }
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
    if(e.growingAge>=0)this.events.push({xp:HOSTILE.has(e.type)?5:1+Math.floor(Math.random()*3),position:{x:e.x,y:e.y,z:e.z}});
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
    // EntityChicken.dropFewItems (wg.b(ZI)): rand.nextInt(3) + rand.nextInt(1 + looting)
    // feathers, then raw chicken, or cooked when the chicken is burning.
    if (e.type === "chicken" && e.growingAge >= 0) {
      const feathers = Math.floor(this.random() * 3);
      if (feathers) this.events.push({ drop: FEATHER, count: feathers, position: { x: e.x, y: e.y, z: e.z } });
      this.events.push({ drop: e.burn ? COOKED_CHICKEN : RAW_CHICKEN, count: 1, position: { x: e.x, y: e.y, z: e.z } });
    }
    // EntitySkeleton.dropFewItems (yl.b(ZI)): rand.nextInt(3 + looting) arrows, then
    // rand.nextInt(3 + looting) bones (the wither skeleton's coal and skull are not ported).
    if (e.type === "skeleton") {
      const arrows = Math.floor(this.random() * 3), bones = Math.floor(this.random() * 3);
      if (arrows) this.events.push({ drop: 320, count: arrows, position: { x: e.x, y: e.y, z: e.z } });
      if (bones) this.events.push({ drop: 311, count: bones, position: { x: e.x, y: e.y, z: e.z } });
    }
    if (e.type === "spider") {
      const drops = spiderDrops(e.recentlyHit > 0, this.random);
      for (const [drop, count] of [[STRING, drops.string], [SPIDER_EYE, drops.eye]])
        if (count) this.events.push({ drop, count, position: { x: e.x, y: e.y, z: e.z } });
    }
    // EntityCreeper: EntityLiving.dropFewItems with gunpowder, rand.nextInt(3).
    if (e.type === "creeper") {
      const n = creeperDrops((k) => Math.floor(this.random() * k));
      if (n) this.events.push({ drop: GUNPOWDER, count: n, position: { x: e.x, y: e.y, z: e.z } });
    }
    if(e.type==='zombie'){const drop=zombieRareDrop(e.recentlyHit,n=>Math.floor(this.random()*n));if(drop)this.events.push({drop,count:1,position:{x:e.x,y:e.y,z:e.z}});}
    e.death = 1;
    if (e.eatTimer) e.eatTimer = 0;
  }
  // EntityLivingBase.fall (sv.b(F)): ceil(distance - 3) points of fall damage
  // (no jump boost), through attackEntityFrom without an attacker, so no knockback.
  fall(e, distance) {
    this.hazard(e, Math.ceil(f(distance - 3)));
    // EntityCreeper.fall (xz.b(F)) then pushes the fuse on.
    if (e.type === "creeper") creeperFall(e, distance);
  }
  // attackEntityFrom with a source that has no attacker (fall, fire, lava).
  hazard(e, points) {
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
  // The fire and lava part of Entity.onEntityUpdate (sa.C): water puts the fire
  // out; a burning mob takes 1 (onFire) whenever the counter is a multiple of 20;
  // lava (handleLavaMovement) deals 4 (lava), sets fire for 15 s (counter 300) and
  // halves the fall distance. EntityAIPanic keeps animals running while they burn.
  burn(e, t) {
    // handleWaterMovement: only water; rain puts a burning mob out in moveEntity's tail.
    if (e.inWater) e.fire = 0;
    if (e.fire > 0) {
      if (e.fire % 20 === 0) this.hazard(e, 1);
      e.fire--;
    }
    const r = t.width / 2;
    if ((e.inLava = inLava(this.world, [e.x - r, e.y, e.z - r, e.x + r, e.y + t.height, e.z + r]))) {
      this.hazard(e, 4);
      e.fire = Math.max(e.fire, 300);
      e.fallDistance *= 0.5;
    }
    // Fire blocks and cactus act in moveEntity's tail (walk, block-collisions.js).
    if (e.fire > 0) e.burn = 1;
  }
  feed(e,id,survival){
    if(!this.entities.includes(e)||e.health<=0||!BREED_ITEM[e.type]||id!==BREED_ITEM[e.type]||(!survival.creative&&!survival.count(id)))return false;
    if(e.growingAge!==0||e.love>0)return false;e.love=600;
    if(!survival.creative)survival.take(id);
    // EntityAnimal.func_146082_f: World.setEntityState(18), which the client shows as 7 hearts.
    if(this.fx){const t=ENTITY_TYPES[e.type];burst(this.fx,'heart',7,{x:e.x,y:e.y,z:e.z,width:t.width,height:t.height},entityRandom(e),0.5);}
    return true;
  }
  // EntityAIMate.spawnBaby (ua.g): the child of two animals in love (growingAge -24000,
  // at the mother's position, a sheep's colour from the parents' dyes), both parents'
  // age set to 6000 and love cleared, and 1 to 7 experience (its hearts are a server
  // spawnParticle, which singleplayer never shows). A full world
  // (40 mobs) keeps them waiting. Returns whether the baby was born.
  spawnBaby(a,b){
    if(this.entities.length>=40)return false;
    const baby=this.create(a.type,a.x,a.y,a.z);baby.growingAge=-24000;
    // EntitySheep.createChild (wp.b(rx)): the lamb's colour is the parents' dye mix.
    if(a.type==='sheep')baby.color=childColor(a.color,b.color,this.random);
    this.entities.push(baby);a.growingAge=b.growingAge=6000;a.love=b.love=0;a.mateTicks=b.mateTicks=0;
    this.events.push({xp:1+Math.floor(Math.random()*7),position:{x:a.x,y:a.y,z:a.z}});
    return true;
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
  // ItemDye.itemInteractionForEntity (acj.a(add, yz, sv)): after EntitySheep.interact
  // declined (shears, wheat), a dye whose fleece colour (~damage & 15) differs from an
  // unsheared sheep's sets it and loses one item (Creative restores the stack). Lambs
  // are dyed too. Returns true for any sheep, as the original does.
  dye(e,stack,survival){
    if(!this.entities.includes(e)||e.health<=0||e.type!=='sheep'||stack?.id!==DYE)return false;
    const colour=~stack.damage&15;
    if(!e.sheared&&e.color!==colour){
      e.color=colour;
      if(!survival.creative)survival.inventory.decr(survival.inventory.current,1);
    }
    return true;
  }
  // The tick-4 step of EntityAIEatGrass (ud.e, task in ai.js): the tall grass at the feet
  // is destroyed without a drop, or the grass block below turns to dirt (level event
  // 2001), and EntitySheep.eatGrassBonus (wp.p) clears the sheared flag and ages a lamb
  // by 60 seconds.
  eatGrass(e){
    const w=this.world,x=Math.floor(e.x),y=Math.floor(e.y),z=Math.floor(e.z);
    let at=null;
    if(w.get(x,y,z)===39)at=[x,y,z,39];else if(w.get(x,y-1,z)===1)at=[x,y-1,z,1];
    if(at){
      w.set?.(at[0],at[1],at[2],at[3]===39?0:2);
      this.events.push({eatGrass:{x:at[0],y:at[1],z:at[2],block:at[3]}});
      e.sheared=false;
      if(e.growingAge<0)e.growingAge=Math.min(0,e.growingAge+1200);
    }
  }
  // The AI service: the brains (navigator, helpers and tasks per mob, see ai.js) hang off
  // a WeakMap, so they are never saved and a loaded world starts them fresh.
  get ai(){
    return this.mobAI??=new MobAI(this,{
      ENTITY_TYPES,BREED_ITEM,aiMoveSpeed,
      mobSize:(e)=>{const base=ENTITY_TYPES[e.type],scale=e.growingAge<0?.5:1;return{width:base.width*scale,height:base.height*scale};},
      spawnBaby:(a,b)=>this.spawnBaby(a,b),
      eatGrass:(e)=>this.eatGrass(e),
      attackPlayer:(e,survival)=>survival.damage(ENTITY_TYPES[e.type].damage,"a " + e.type,true),
      // EntitySkeleton.attackEntityWithRangedAttack: the arrow itself is made by bow.js
      // (entities.js cannot import it: projectiles.js already imports this file).
      rangedAttack:(e,target,scale)=>this.shoot?.(e,target,scale),
      isDaytime:()=>this.day,
      canSeeSky:(x,y,z)=>this.canSeeSky?this.canSeeSky(x,y,z):openSky(this.world,x,y,z),
      despawn:(e)=>{e.health=0;e.death=20;},
    });
  }
  tick(player, survival, heldItem=0) {
    const night =
      survival.time % 24000 > 13000 && survival.time % 24000 < 23000;
    this.spawnClock++;
    // World.isDaytime (skylightSubtracted < 4); main.js hooks the real light level in.
    this.day = this.isDaytime ? this.isDaytime() : !night;
    this.ai.beginTick(player, survival, heldItem);
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
    // Skeletons come out at night with the zombies, on their own timer and cap (the
    // original rolls both from one spawn pass over lit-dark cells within 24 to 128
    // blocks; this build keeps its simpler ring around the player).
    this.skeletonClock = (this.skeletonClock || 0) + 1;
    if (
      night &&
      !survival.creative &&
      this.skeletonClock >= 240 &&
      this.entities.filter((e) => e.type === "skeleton").length < 3
    ) {
      this.skeletonClock = 0;
      for (let i = 0; i < 16; i++) {
        const a = hash(i + 100, survival.time, this.world.numericSeed) * Math.PI * 2,
          x = Math.floor(player.x + Math.sin(a) * 24),
          z = Math.floor(player.z + Math.cos(a) * 24);
        if (x < 2 || z < 2 || x > SIZE - 2 || z > SIZE - 2) continue;
        const y = this.world.surface(x, z);
        if (this.world.get(x, y - 1, z) !== 1) continue;
        this.entities.push(this.create("skeleton", x + 0.5, y, z + 0.5));
        break;
      }
    }
    this.spiderClock = (this.spiderClock || 0) + 1;
    if (night && !survival.creative && this.spiderClock >= 260 && this.entities.filter(e => e.type === "spider").length < 3) {
      this.spiderClock = 0;
      for (let i = 0; i < 16; i++) {
        const a = hash(i + 200, survival.time, this.world.numericSeed) * Math.PI * 2,
          x = Math.floor(player.x + Math.sin(a) * 24), z = Math.floor(player.z + Math.cos(a) * 24);
        if (x < 2 || z < 2 || x > SIZE - 2 || z > SIZE - 2) continue;
        const y = this.world.surface(x, z), t = ENTITY_TYPES.spider;
        if (this.world.get(x, y - 1, z) !== 1 || actorCollides(this.world, x + 0.5, y, z + 0.5, t.width, t.height)) continue;
        this.entities.push(this.create("spider", x + 0.5, y, z + 0.5));
        break;
      }
    }
    // Creepers: the same night ring as the skeletons, with their own clock and cap.
    this.creeperClock = (this.creeperClock || 0) + 1;
    if (night && !survival.creative && this.creeperClock >= 250 && this.entities.filter((e) => e.type === "creeper").length < 3) {
      this.creeperClock = 0;
      for (let i = 0; i < 16; i++) {
        const a = hash(i + 300, survival.time, this.world.numericSeed) * Math.PI * 2,
          x = Math.floor(player.x + Math.sin(a) * 24), z = Math.floor(player.z + Math.cos(a) * 24);
        if (x < 2 || z < 2 || x > SIZE - 2 || z > SIZE - 2) continue;
        const y = this.world.surface(x, z), t = ENTITY_TYPES.creeper;
        if (this.world.get(x, y - 1, z) !== 1 || actorCollides(this.world, x + 0.5, y, z + 0.5, t.width, t.height)) continue;
        this.entities.push(this.create("creeper", x + 0.5, y, z + 0.5));
        break;
      }
    }
    // A mob spawned during the loop (a baby) joins the next tick's updates, as World.spawnEntityInWorld queues it.
    for (const e of this.entities.slice()) {
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
        // EntityLivingBase.onDeathUpdate: at deathTime 20 the body goes up in 20 "explode".
        if (e.death === 20 && this.fx) burst(this.fx, "explode", 20, { x: e.x, y: e.y, z: e.z, width: t.width, height: t.height }, entityRandom(e));
        e.jumping = false;
        this.walk(e, t, 0);
        if (e.type === "chicken") this.chickenUpdate(e);
        this.swingLimbs(e);
        continue;
      }
      // EntityCreeper.onUpdate (xz.h) runs its fuse before EntityLivingBase.onUpdate. The
      // explosion (mobGriefing on) is main.js's; the creeper is gone without drops.
      if (e.type === "creeper") {
        const out = creeperTick(e);
        if (out.sound) this.events.push({ sound: out.sound.name, volume: out.sound.volume, pitch: out.sound.pitch, position: { x: e.x, y: e.y, z: e.z } });
        if (out.explode) {
          this.events.push({ explode: { ...out.explode, source: e } });
          e.health = 0;
          e.death = 20;
          continue;
        }
      }
      e.age++;
      if(e.recentlyHit>0)e.recentlyHit--;
      if(e.growingAge<0)e.growingAge++;else if(e.growingAge>0)e.growingAge--;
      e.love=Math.max(0,e.love-1);
      // The inLove countdown's hearts (every 10 ticks) run on the server's copy only: the
      // client never learns inLove, so 1.7.10 singleplayer shows none.
      e.hurt = Math.max(0, e.hurt - 1);
      e.attack = Math.max(0, e.attack - 1);
      e.flee = Math.max(0, e.flee - 1);
      // EntityLivingBase.onEntityUpdate: the revenge target lapses after 100 ticks.
      if (e.revenge && e.age + 1 - e.revenge > 100) e.revenge = 0;
      const distance = Math.hypot(e.x - player.x, e.z - player.z);
      if (e.type === "zombie" && !night && !this.wet?.(e, t.height)) {
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
      // EntitySkeleton.onLivingUpdate (yl.e): in daylight a skeleton under open sky
      // (brightness > 0.5, with chance (brightness - 0.4) * 2 / 30 a tick) is set on fire
      // for 8 s; burn() below takes the damage, water or rain puts it out. It wears no helmet.
      if (e.type === "skeleton" && this.day) {
        const bx = Math.floor(e.x), by = Math.floor(e.y + t.height * 0.66), bz = Math.floor(e.z),
          light = this.ai.brightness(bx, by, bz);
        if (light > 0.5 && f(this.random() * 30) < f(f(light - f(0.4)) * 2) && this.ai.deps.canSeeSky(bx, Math.floor(e.y), bz)) e.fire = Math.max(e.fire || 0, 160);
      }
      const wasInWater = e.inWater;
      if (e.inWater = inWater(this.world, e, t.width, t.height)) e.fallDistance = 0;
      // Entity.handleWaterMovement: entering water (not on the entity's first update, when
      // inWater is still unset) splashes. EntityMob plays the hostile sound.
      if (e.inWater && wasInWater === false) {
        const s = enterWater(this.fx, { x: e.x, z: e.z, minY: e.y, width: t.width, mx: e.vx, my: e.vy, mz: e.vz }, entityRandom(e));
        this.events.push({ sound: HOSTILE.has(e.type) ? "game.hostile.swim.splash" : "game.neutral.swim.splash", volume: s.volume, pitch: s.pitch, position: { x: e.x, y: e.y, z: e.z } });
      }
      this.burn(e, t);
      // EntityLiving.onLivingUpdate runs the AI (ai.js) between the motion snap and the
      // jump/move: tasks, navigator, move/look/jump helpers.
      this.walk(e, t, 0, () => e.type === "spider" ? this.spiderThink(e) : this.ai.think(e));
      if (e.type === "spider") {
        e.climbing = e.collidedH;
        // Entity.moveEntity's distanceWalkedOnStepModified (0.6 per block);
        // EntitySpider has its own original step event at volume 0.15.
        const dx = e.x - e.px, dy = countsVertical(this.world, e.x, e.y, e.z) ? e.y - e.py : 0, dz = e.z - e.pz;
        e.stepDistance = f((e.stepDistance || 0) + f(Math.sqrt(dx * dx + dy * dy + dz * dz) * 0.6));
        const below = this.world.get(Math.floor(e.x), Math.floor(e.y - 0.2), Math.floor(e.z));
        if (e.stepDistance > (e.nextStep || 1) && below) {
          e.nextStep = Math.floor(e.stepDistance) + 1;
          this.events.push({ sound: "mob.spider.step", volume: 0.15, pitch: 1, position: { x: e.x, y: e.y, z: e.z } });
        }
      }
      if (e.type === "chicken") this.chickenUpdate(e);
      this.turnBody(e);
      this.swingLimbs(e);
      // EntityCreeper has no getLivingSound.
      if (e.age % 160 === 0 && distance < 18 && e.type !== "creeper")
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
    this.entities = this.entities.filter((e) => e.health > 0 || e.death < 20);
  }
  // Motion half of EntityLivingBase.onLivingUpdate (sv.e()): jump delay, motion
  // below 0.005 snapped to 0, EntityMoveHelper (tv.c) turning a move target into
  // aiMoveSpeed and moveForward (zeroed when idle), the jump (0.04 in water, else
  // jump() on the ground every 10 ticks), moveForward x 0.98, then
  // moveEntityWithHeading. `think` is the AI step (ai.js: tasks, navigator and the three
  // helpers, which set moveForward, aiMoveSpeed, the yaw and the jump); without it
  // `speed` is the setAIMoveSpeed value or 0.
  walk(e, t, speed, think) {
    if (e.jumpTicks > 0) e.jumpTicks--;
    if (Math.abs(e.vx) < 0.005) e.vx = 0;
    if (Math.abs(e.vy) < 0.005) e.vy = 0;
    if (Math.abs(e.vz) < 0.005) e.vz = 0;
    e.moveForward = 0;
    if (think) think();
    else if (speed > 0) e.aiMoveSpeed = e.moveForward = speed;
    if (e.jumping) {
      if (e.inWater || e.inLava) e.vy += 0.03999999910593033;
      else if (e.onGround && e.jumpTicks === 0) {
        jump(e);
        e.jumpTicks = 10;
      }
    } else e.jumpTicks = 0;
    e.moveForward = f(e.moveForward * f(0.98));
    // moveEntity's tail: cactus and fire (inFire) damage, webs, the fire counter and the rain fizz.
    const self = this, hooks = {
      hurt: (source, points) => this.hazard(e, points),
      get wet() { return e.inWater || !!self.wet?.(e, t.height); },
      fizz: () => this.events.push({ sound: "random.fizz", volume: 0.7, pitch: f(1.6 + f(f(this.random() - this.random()) * 0.4)), position: { x: e.x, y: e.y, z: e.z } }),
    };
    const landed = moveEntityWithHeading(this.world, e, t.width, t.height, e.moveForward, hooks);
    // The finite world's edge stops a mob like a wall.
    const edge = (axis, v) => {
      const c = Math.max(0.6, Math.min(SIZE - 0.6, e[axis]));
      if (c !== e[axis]) (e[axis] = c), (e[v] = 0);
    };
    edge("x", "vx");
    edge("z", "vz");
    if (landed > 0) this.onLand?.(e, landed);
    // EntityChicken.fall (wg.b(F)) does nothing.
    if (landed > 0 && e.type !== "chicken") this.fall(e, landed);
  }
  // Spider keeps EntityCreature's legacy aggression/leap rules. Navigation reuses
  // the existing bounded PathFinder; its refresh/wander timing remains adapted.
  spiderThink(e) {
    const m = this.ai.brain(e), p = this.ai.player, s = this.ai.survival;
    const light = this.ai.brightness(Math.floor(e.x), Math.floor(e.y + ENTITY_TYPES.spider.height * 0.66), Math.floor(e.z));
    const distance = Math.sqrt(m.distSq(p));
    e.idle = (e.idle || 0) + 1 + (light > 0.5 ? 2 : 0);
    m.despawnEntity();
    m.senseCache.clear();
    if (!p.alive || s.creative) {
      if (e.spiderTarget) m.navigator.clearPathEntity();
      e.spiderTarget = false;
    } else if (e.revenge && e.revenge !== e.spiderRevenge) {
      e.spiderRevenge = e.revenge;
      e.spiderTarget = true;
    } else if (!e.spiderTarget && distance < 16 && spiderFindsPlayer(light)) e.spiderTarget = true;
    if (e.spiderTarget) {
      m.attackTarget = p;
      if (m.canSee(p)) {
        const result = spiderAttack(e, p, distance, light, this.random);
        if (result === "forget") { e.spiderTarget = false; m.navigator.clearPathEntity(); }
        else if (result === "hit") s.damage(2, "a spider", true);
      }
      if (e.spiderTarget) {
        if (e.age % 10 === 0 || m.navigator.noPath()) m.navigator.tryMoveToEntityLiving(p, 1);
        m.lookHelper.setLookPositionWithEntity(p, 30, 30);
        // The legacy path cannot climb vertically; continue pushing toward the
        // target when a wall stops the path, which sets the spider's ladder flag.
        if (m.navigator.noPath() || e.climbing) m.moveHelper.setMoveTo(p.x, e.y, p.z, 1);
      }
    } else {
      m.attackTarget = null;
      if (e.age % 80 === 0) {
        const a = this.random() * Math.PI * 2;
        m.navigator.tryMoveToXYZ(e.x + Math.sin(a) * 6, e.y, e.z + Math.cos(a) * 6, 1);
      }
    }
    m.navigator.onUpdateNavigation();
    m.moveHelper.onUpdateMoveHelper();
    m.lookHelper.onUpdateLook();
    m.jumpHelper.doJump();
    e.yaw = -e.rotationYaw * Math.PI / 180;
  }
  // The chicken half of EntityChicken.onLivingUpdate (wg.e()), run after the shared
  // movement: the previous wing values are kept, destPos moves 0.3 x (-1 on the
  // ground, else 4) within [0, 1], wingRotDelta (bt) snaps up to 1 in the air and
  // decays by 0.9, a falling chicken keeps 0.6 of its downward motion, and
  // wingRotation advances by twice wingRotDelta. An adult that is not a jockey counts
  // timeUntilNextEgg down and, at 0, plays mob.chicken.plop (volume 1, pitch
  // (rand - rand) * 0.2 + 1), drops one egg (entityDropItem(egg, 0)) and rolls
  // 6000 + rand.nextInt(6000) again.
  chickenUpdate(e) {
    e.oFlap = e.wingRotation;
    e.oFlapSpeed = e.destPos;
    e.destPos = f(e.destPos + (e.onGround ? -1 : 4) * 0.3);
    if (e.destPos < 0) e.destPos = 0;
    if (e.destPos > 1) e.destPos = 1;
    if (!e.onGround && e.wingRotDelta < 1) e.wingRotDelta = 1;
    e.wingRotDelta = f(e.wingRotDelta * 0.9);
    if (!e.onGround && e.vy < 0) e.vy *= 0.6;
    e.wingRotation = f(e.wingRotation + f(e.wingRotDelta * 2));
    if (e.growingAge >= 0 && --e.eggTimer <= 0) {
      const r = this.random, pitch = f(f(f(r() - r()) * f(0.2)) + 1);
      this.events.push({ sound: "mob.chicken.plop", volume: 1, pitch, position: { x: e.x, y: e.y, z: e.z } });
      this.events.push({ drop: EGG, count: 1, position: { x: e.x, y: e.y, z: e.z } });
      e.eggTimer = Math.floor(r() * 6000) + 6000;
    }
  }
  // EntityBodyHelper.func_75664_a (tr.a), reached through EntityLiving.func_110146_f
  // (sw.f) for AI-enabled mobs; the yaw wraps of EntityLivingBase.onUpdate (sv.h) follow.
  // rotationYaw is set by EntityMoveHelper and the head by EntityLookHelper (ai.js).
  turnBody(e) {
    const dx = e.x - e.px, dz = e.z - e.pz;
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
