import { entityActive } from './streaming-ticks.js';
// ItemBow (abm), EntityArrow (zc) and the arrow half of EntitySkeleton (yl) from the
// 1.7.10 JAR. Evidence, class digests and gaps: public/research/bows.md; the numbers
// below are replayed against public/research/bow-reference.json by bow.test.js.
//
// Obfuscated names used in the comments: zc EntityArrow, abm ItemBow, yl EntitySkeleton,
// vd EntityAIArrowAttack, sa Entity, sv EntityLivingBase, yz EntityPlayer, ro
// DamageSource, qh MathHelper (qh.a(D)F is sqrt as a float), blk EntityPlayerSP.
import { explosionImpact } from "./explosion.js";
import { mhSin, mhCos } from "./lighting.js";
import { HEIGHT, TNT, blockBounds } from "./world.js";
import { isStair, stairBoxes } from "./stairs.js";
import { waterAcceleration, entityWaterBox, inLava } from "./fluids.js";
import { enterWater } from "./fx.js";
import { GaussianRandom, intercept, rayTraceBlocks } from "./projectiles.js";
import { addStuckArrow } from "./stuck-arrows.js";
import { applyBowEnchantments, bowEnchantments } from "./armor-enchantments.js";

const f = Math.fround;
const PI_F = f(Math.PI), PI_D = 3.1415927410125732;
export const BOW = 127, ARROW = 320, STRING = 321;
// ItemBow.getMaxItemUseDuration (abm.d_), also the "no count left" start of itemInUseCount.
export const MAX_USE = 72000;
// EntityArrow.setSize(0.5, 0.5); yOffset 0, so posY is the bottom of the box.
const WIDTH = f(0.5), HEIGHT_ARROW = f(0.5), HALF = f(WIDTH / 2);
// The ticks an arrow lives once stuck (zc.h: ticksInGround == 1200).
export const DESPAWN = 1200;
const sqrtF = (v) => f(Math.sqrt(v));
// MathHelper.ceiling_double_int (qh.f).
const ceil = (v) => {
  const i = Math.trunc(v);
  return v > i ? i + 1 : i;
};

// --- ItemBow ---

// ItemBow.onPlayerStoppedUsing (abm.a): f = ticks / 20, then (f * f + f * 2) / 3 in
// floats. Draws shorter than 0.1 do nothing; the power is capped at 1 (full draw,
// which is also the critical hit: setIsCritical(f == 1.0F)).
export function drawPower(ticks) {
  let p = f(ticks / f(20));
  p = f(f(f(p * p) + f(p * 2)) / 3);
  return p;
}
export function releasePower(ticks) {
  let p = drawPower(ticks);
  if (p < 0.1) return null;
  if (p > 1) p = 1;
  return p;
}
// EntityPlayer.getItemIcon (yz.b(add, int)): the bow icon follows the ticks the item has
// been in use: 0 bow_standby, then bow_pulling_0 (> 0), _1 (> 13), _2 (>= 18).
export const ICONS = ["bow_standby", "bow_pulling_0", "bow_pulling_1", "bow_pulling_2"];
export const bowStage = (ticks) => (ticks >= 18 ? 3 : ticks > 13 ? 2 : ticks > 0 ? 1 : 0);
// EntityPlayerSP.getFOVMultiplier (blk.t), the bow term: a draw of t ticks scales the
// field of view by 1 - 0.15 * (t / 20)^2 (t / 20 capped at 1).
export function bowFov(ticks) {
  let f1 = f(ticks / f(20));
  f1 = f1 > 1 ? 1 : f(f1 * f1);
  return f(1 - f(f1 * f(0.15)));
}
// EntityRenderer.updateFovModifierHand (once per tick): fovModifierHandPrev = current,
// current += (target - current) * 0.5, both clamped to [0.1, 1.5].
export function easeFov(state, target) {
  state.prev = state.cur;
  state.cur = f(state.cur + f(f(target - state.cur) * f(0.5)));
  state.prev = Math.min(1.5, Math.max(0.1, state.prev));
  state.cur = Math.min(1.5, Math.max(0.1, state.cur));
  return state;
}
// The sound pitch of ItemBow's shot: 1 / (itemRand.nextFloat() * 0.4 + 1.2) + power * 0.5.
export const shotPitch = (rand, power) => f(f(f(1) / f(f(rand.nextFloat() * f(0.4)) + f(1.2))) + f(power * f(0.5)));

// --- Launch ---

// EntityArrow.setThrowableHeading (zc.c): normalise by the float length, add
// nextGaussian * (+-1 from nextBoolean) * 0.0075 * inaccuracy per axis (x, y, z in that
// order; the gaussian is drawn before the boolean), scale by the velocity, and take yaw
// and pitch (degrees, floats) from the result.
export function arrowHeading(rand, x, y, z, velocity, inaccuracy) {
  const n = sqrtF(x * x + y * y + z * z);
  x /= n;
  y /= n;
  z /= n;
  const spread = (v) => v + rand.nextGaussian() * (rand.nextBoolean() ? -1 : 1) * 0.007499999832361937 * f(inaccuracy);
  x = spread(x);
  y = spread(y);
  z = spread(z);
  x *= f(velocity);
  y *= f(velocity);
  z *= f(velocity);
  const flat = sqrtF(x * x + z * z);
  return { mx: x, my: y, mz: z, yaw: f((Math.atan2(x, z) * 180) / PI_D), pitch: f((Math.atan2(y, flat) * 180) / PI_D) };
}
// EntityArrow(world, shooter, power) (zc) for a player: from the eye (the integrated
// server's EntityPlayerMP reports 1.62), 0.16 to the side and 0.1 down, aimed along the
// view and sent through setThrowableHeading(velocity = power * 1.5, inaccuracy = 1).
// This build's yaw and pitch are radians looking along (-sin yaw cos pitch, sin pitch,
// -cos yaw cos pitch); Minecraft's are degrees with yaw' = 180 - yaw and pitch' = -pitch.
export function playerArrow(rand, feet, yaw, pitch, power) {
  const mcYaw = f(180 - (yaw * 180) / Math.PI), mcPitch = f((-pitch * 180) / Math.PI),
    k = f(f(mcYaw / 180) * PI_F), p = f(f(mcPitch / 180) * PI_F),
    s = mhSin(k), c = mhCos(k);
  const h = arrowHeading(rand, f(f(-s) * mhCos(p)), f(-mhSin(p)), f(c * mhCos(p)), f(f(power) * f(1.5)), 1);
  return { x: feet.x - f(c * f(0.16)), y: feet.y + f(1.62) - 0.10000000149011612, z: feet.z - f(s * f(0.16)), ...h };
}
// EntityArrow(world, shooter, target, velocity, inaccuracy) (zc) for a mob: from the
// shooter's eye minus 0.1, one block towards the target, aimed at a third of the
// target's height with a lob of 0.2 x the horizontal distance. `shooter` is
// { x, y, z, eyeHeight } and `target` { x, y, z, height } (feet positions). Null when
// the target is straight above or below (d3 < 1e-7).
export function mobArrow(rand, shooter, target, velocity, inaccuracy) {
  const y = shooter.y + f(shooter.eyeHeight) - 0.10000000149011612,
    d0 = target.x - shooter.x, d1 = target.y + f(f(target.height) / 3) - y, d2 = target.z - shooter.z,
    d3 = sqrtF(d0 * d0 + d2 * d2);
  if (d3 < 1.0e-7) return null;
  const h = arrowHeading(rand, d0, d1 + f(d3 * f(0.2)), d2, velocity, inaccuracy);
  return { x: shooter.x + d0 / d3, y, z: shooter.z + d2 / d3, ...h };
}
// EntitySkeleton.attackEntityWithRangedAttack (yl.a(sv, F)) damage roll:
// f * 2 + nextGaussian * 0.25 + difficulty * 0.11F, then Power (+ level * 0.5 + 0.5) and Punch/Flame of the
// held bow; a skeleton's bow is never enchanted in this port, so those terms are zero.
export const skeletonDamage = (rand, scale, difficulty = 2) => f(scale * 2) + rand.nextGaussian() * 0.25 + f(difficulty * f(0.11));
// EntityAIArrowAttack's clamp of the distance fraction: MathHelper.clamp_float(f, 0.1F, 1.0F).
export const rangeScale = (fraction) => (fraction < f(0.1) ? f(0.1) : fraction > 1 ? 1 : fraction);

// --- Collision helpers ---

// The collision box of the block an arrow is stuck in (Block.getCollisionBoundingBoxFromPool):
// farmland has a full cube here although its selection box is lower; null without one.
function collisionBox(world, x, y, z) {
  const id = world.get(x, y, z);
  if (id === 0 || id === 10 || id === 42 || !world.solid(x, y, z)) return null;
  return id === 29 || id === 30 ? [0, 0, 0, 1, 1, 1] : blockBounds(world, x, y, z);
}
const blockAt = (world, x, y, z) => (y < 0 || y >= (world.height ?? HEIGHT) ? 0 : world.get(x, y, z));
const strictInside = (b, x, y, z, v) => v[0] > x + b[0] && v[0] < x + b[3] && v[1] > y + b[1] && v[1] < y + b[4] && v[2] > z + b[2] && v[2] < z + b[5];
const dist2 = (a, b) => (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2;
const box = (a) => [a.x - HALF, a.y, a.z - HALF, a.x + HALF, a.y + HEIGHT_ARROW, a.z + HALF];
const overlap = (a, b) => a[3] > b[0] && a[0] < b[3] && a[4] > b[1] && a[1] < b[4] && a[5] > b[2] && a[2] < b[5];
const bound = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The entity sweep targets of EntityArrow.onUpdate: every mob's box plus the player's.
// `ref` is the mob (or "player"); a creative player is `immune`.
export function arrowTargets(mobTargetList, creative) {
  return mobTargetList.map((t) => (t.ref === "player" ? { ...t, immune: !!creative } : t));
}

const mobsHas = (mobs, mob) => !!mobs?.entities?.includes(mob) && typeof mobs.attackEntityFrom === "function";

export class Arrows {
  constructor(random = Math.random) {
    this.random = random;
    this.list = [];
    this.events = [];
    // The client Fx (main.js) for crit trails, bubbles and splashes.
    this.fx = null;
    // Item.itemRand and the skeletons' Entity.rand (one stream per mob).
    this.itemRand = this.rng();
    this.mobRands = new WeakMap();
    // Entity.isWet for rain (set by main.js); `lavaAt` stays the fluids.js test.
    this.wet = null;
  }
  // Entity.rand is a fresh java.util.Random per entity.
  rng() {
    return new GaussianRandom(Math.floor(this.random() * 2 ** 48));
  }
  mobRand(mob) {
    let r = this.mobRands.get(mob);
    if (!r) this.mobRands.set(mob, (r = this.rng()));
    return r;
  }
  make(h, rand, extra) {
    return {
      x: h.x, y: h.y, z: h.z, px: h.x, py: h.y, pz: h.z, mx: h.mx, my: h.my, mz: h.mz,
      yaw: h.yaw, pitch: h.pitch, prevYaw: h.yaw, prevPitch: h.pitch,
      xTile: -1, yTile: -1, zTile: -1, inTile: 0, inData: 0, inGround: false, shake: 0,
      ticksInGround: 0, ticksInAir: 0, pickup: 0, damage: 2, knockback: 0, crit: false, fire: 0,
      shooter: null, water: null, rand, dead: false, ...extra,
    };
  }
  // ItemBow's arrow (see releaseBow): canBePickedUp 1, or 2 when no arrow was consumed.
  shootPlayer(feet, yaw, pitch, power, { creative = false, crit = false } = {}) {
    const rand = this.rng(), arrow = this.make(playerArrow(rand, feet, yaw, pitch, power), rand, {
      shooter: "player", pickup: creative ? 2 : 1, crit,
    });
    this.list.push(arrow);
    return arrow;
  }
  // The skeleton's arrow: velocity 1.6, inaccuracy 14 - difficulty * 4, canBePickedUp 0,
  // damage from skeletonDamage, `random.bow` at volume 1 and pitch
  // 1 / (rand.nextFloat() * 0.4 + 0.8). The rolls come from the skeleton's own stream:
  // the gaussian for the damage, then the pitch float.
  skeletonShoot(mob, target, scale, difficulty = 2) {
    const rand = this.rng(), mr = this.mobRand(mob),
      h = mobArrow(rand, { x: mob.x, y: mob.y, z: mob.z, eyeHeight: f(f(1.8) * f(0.85)) }, target, f(1.6), 14 - difficulty * 4);
    if (!h) return null;
    const arrow = this.make(h, rand, { shooter: mob, pickup: 0 });
    arrow.damage = skeletonDamage(mr, scale, difficulty);
    const pitch = f(f(1) / f(f(mr.nextFloat() * f(0.4)) + f(0.8)));
    this.events.push({ sound: "random.bow", volume: 1, pitch, position: { x: mob.x, y: mob.y, z: mob.z } });
    this.list.push(arrow);
    return arrow;
  }
  drain() {
    const events = this.events;
    this.events = [];
    return events;
  }
  sound(a, name, volume, pitch) {
    this.events.push({ sound: name, volume, pitch, position: { x: a.x, y: a.y, z: a.z } });
  }
  // Explosion.doExplosionA pushes arrows even though Entity.attackEntityFrom returns false.
  // posY is the box bottom; inherited Entity.getEyeHeight is 0. A stuck arrow remains stuck
  // until its next onUpdate sees that the supporting block changed or disappeared.
  explode(world, x, y, z, size, exploder = null) {
    for (const a of this.list) {
      if (a.dead || a === exploder) continue;
      const hit = explosionImpact(world, x, y, z, size, a.x, a.y, a.z, a.y, box(a));
      if (hit) { a.mx += hit.push[0]; a.my += hit.push[1]; a.mz += hit.push[2]; }
    }
  }
  // EntityArrow.onUpdate for every arrow. `ctx`: targets (arrowTargets), mobs (the
  // EntityWorld, for damage), survival (the player's) and player ({ x, z }, for knockback).
  tick(world, ctx = {}) {
    for (const a of this.list) if (!a.dead && entityActive(world,a)) this.step(world, a, ctx);
    this.list = this.list.filter((a) => !a.dead);
  }
  step(world, a, ctx) {
    // Entity.onUpdate / onEntityUpdate: previous position and angles, water (which
    // also puts a fire out), fire, lava and the -64 void.
    a.px = a.x;
    a.py = a.y;
    a.pz = a.z;
    a.prevYaw = a.yaw;
    a.prevPitch = a.pitch;
    const wetBox = entityWaterBox(box(a)), wet = a.y < 0 ? { wet: false, push: [0, 0, 0] } : waterAcceleration(world, wetBox);
    const wasWater = a.water;
    a.water = wet.wet;
    // Entity.handleWaterMovement: entering water after the first update splashes.
    if (a.water && wasWater === false) {
      const s = enterWater(this.fx, { x: a.x, z: a.z, minY: a.y, width: WIDTH, mx: a.mx, my: a.my, mz: a.mz }, a.rand);
      this.sound(a, "game.neutral.swim.splash", s.volume, s.pitch);
    }
    a.mx += wet.push[0];
    a.my += wet.push[1];
    a.mz += wet.push[2];
    if (a.water) a.fire = 0;
    if (a.fire > 0) a.fire--;
    if (a.y >= 0 && inLava(world, box(a))) a.fire = Math.max(a.fire, 300);
    if (a.y < -64) a.dead = true;
    // zc.h: an arrow that never got a heading takes its angles from its motion.
    if (a.prevPitch === 0 && a.prevYaw === 0) {
      const flat = sqrtF(a.mx * a.mx + a.mz * a.mz);
      a.prevYaw = a.yaw = f((Math.atan2(a.mx, a.mz) * 180) / PI_D);
      a.prevPitch = a.pitch = f((Math.atan2(a.my, flat) * 180) / PI_D);
    }
    // Is the block it last stuck in still around it?
    const px = a.xTile, py = a.yTile, pz = a.zTile;
    if (blockAt(world, px, py, pz) !== 0) {
      const boxes = isStair(blockAt(world, px, py, pz)) ? stairBoxes(world, px, py, pz) : [collisionBox(world, px, py, pz)];
      if (boxes.some((b) => b && strictInside(b, px, py, pz, [a.x, a.y, a.z]))) a.inGround = true;
    }
    if (a.shake > 0) a.shake--;
    if (a.inGround) {
      if (blockAt(world, px, py, pz) === a.inTile && (py < 0 ? 0 : world.getMeta(px, py, pz)) === a.inData) {
        // 1200 ticks and it is gone.
        if (++a.ticksInGround === DESPAWN) a.dead = true;
      } else {
        // The block went away (or changed): the arrow drops, keeping a random sliver of its motion.
        a.inGround = false;
        a.mx *= f(a.rand.nextFloat() * f(0.2));
        a.my *= f(a.rand.nextFloat() * f(0.2));
        a.mz *= f(a.rand.nextFloat() * f(0.2));
        a.ticksInGround = 0;
        a.ticksInAir = 0;
      }
      return;
    }
    a.ticksInAir++;
    // World.func_147447_a(start, start + motion, false, true, false): the first block with
    // a collision box; then the entity sweep (the shooter is skipped for five ticks).
    const start = [a.x, a.y, a.z], far = [a.x + a.mx, a.y + a.my, a.z + a.mz],
      block = rayTraceBlocks(world, start, far, true);
    let end = block ? block.vec : far, hit = block ? { block } : null;
    const b0 = box(a),
      area = [
        b0[0] + Math.min(0, a.mx) - 1, b0[1] + Math.min(0, a.my) - 1, b0[2] + Math.min(0, a.mz) - 1,
        b0[3] + Math.max(0, a.mx) + 1, b0[4] + Math.max(0, a.my) + 1, b0[5] + Math.max(0, a.mz) + 1,
      ];
    let nearest = null, d0 = 0;
    const grow = f(0.3);
    for (const t of ctx.targets || []) {
      if (!overlap(t.box, area)) continue;
      if (t.ref === a.shooter && a.ticksInAir < 5) continue;
      const e = t.box, r = intercept([e[0] - grow, e[1] - grow, e[2] - grow, e[3] + grow, e[4] + grow, e[5] + grow], start, end);
      if (!r) continue;
      const d1 = Math.sqrt(dist2(start, r.vec));
      if (d1 < d0 || d0 === 0) {
        nearest = t;
        d0 = d1;
      }
    }
    if (nearest) hit = { entity: nearest };
    // A creative player (disableDamage) is not hit: the whole hit, block included, is lost.
    if (hit?.entity?.immune) hit = null;
    if (hit) {
      if (hit.entity) {
        const speed = sqrtF(a.mx * a.mx + a.my * a.my + a.mz * a.mz);
        let dmg = ceil(speed * a.damage);
        if (a.crit) dmg += a.rand.nextInt(Math.trunc(dmg / 2) + 2);
        if (this.damageTarget(a, hit.entity.ref, dmg, ctx)) {
          // Knockback (the Knockback enchantment only): addVelocity(m * k * 0.6 / h, 0.1, ...).
          const h = sqrtF(a.mx * a.mx + a.mz * a.mz);
          if (a.knockback > 0 && h > 0 && hit.entity.ref !== "player")
            this.push(ctx.mobs, hit.entity.ref, (a.mx * a.knockback * 0.6000000238418579) / h, 0.1, (a.mz * a.knockback * 0.6000000238418579) / h);
          this.sound(a, "random.bowhit", 1, f(f(1.2) / f(f(a.rand.nextFloat() * f(0.2)) + f(0.9))));
          a.dead = true;
        } else {
          // Ricochet: the arrow bounces back at a tenth of its speed.
          a.mx *= -0.10000000149011612;
          a.my *= -0.10000000149011612;
          a.mz *= -0.10000000149011612;
          a.yaw = f(a.yaw + 180);
          a.prevYaw = f(a.prevYaw + 180);
          a.ticksInAir = 0;
        }
      } else {
        // Stuck: motion becomes the vector to the hit point, the arrow backs off 0.05
        // along it and the 7-tick shake begins.
        const [bx, by, bz] = hit.block.block;
        a.xTile = bx;
        a.yTile = by;
        a.zTile = bz;
        a.inTile = world.get(bx, by, bz);
        a.inData = world.getMeta(bx, by, bz);
        a.mx = f(hit.block.vec[0] - a.x);
        a.my = f(hit.block.vec[1] - a.y);
        a.mz = f(hit.block.vec[2] - a.z);
        const len = sqrtF(a.mx * a.mx + a.my * a.my + a.mz * a.mz);
        if (len > 0) {
          a.x -= (a.mx / len) * 0.05000000074505806;
          a.y -= (a.my / len) * 0.05000000074505806;
          a.z -= (a.mz / len) * 0.05000000074505806;
        }
        this.sound(a, "random.bowhit", 1, f(f(1.2) / f(f(a.rand.nextFloat() * f(0.2)) + f(0.9))));
        a.inGround = true;
        a.shake = 7;
        a.crit = false;
        // BlockTNT.onEntityCollidedWithBlock is called on the block hit, before the arrow
        // advances to the backed-off hit point. Only a burning arrow primes it; keep shooter.
        if (a.inTile === TNT && a.fire > 0) ctx.igniteTnt?.(bx, by, bz, a.shooter);
      }
    }
    // A critical arrow trails four "crit" along this tick's motion, thrown backwards.
    if (a.crit && this.fx)
      for (let n = 0; n < 4; n++) this.fx.spawn("crit", a.x + (a.mx * n) / 4, a.y + (a.my * n) / 4, a.z + (a.mz * n) / 4, -a.mx, -a.my + 0.2, -a.mz);
    a.x += a.mx;
    a.y += a.my;
    a.z += a.mz;
    // Rotation eases a fifth of the way to the heading (float maths).
    const flat = sqrtF(a.mx * a.mx + a.mz * a.mz);
    a.yaw = f((Math.atan2(a.mx, a.mz) * 180) / PI_D);
    a.pitch = f((Math.atan2(a.my, flat) * 180) / PI_D);
    while (f(a.pitch - a.prevPitch) < -180) a.prevPitch = f(a.prevPitch - 360);
    while (f(a.pitch - a.prevPitch) >= 180) a.prevPitch = f(a.prevPitch + 360);
    while (f(a.yaw - a.prevYaw) < -180) a.prevYaw = f(a.prevYaw - 360);
    while (f(a.yaw - a.prevYaw) >= 180) a.prevYaw = f(a.prevYaw + 360);
    a.pitch = f(a.prevPitch + f(f(a.pitch - a.prevPitch) * f(0.2)));
    a.yaw = f(a.prevYaw + f(f(a.yaw - a.prevYaw) * f(0.2)));
    // Drag 0.99 (0.8 in water, with four "bubble" a quarter tick behind), rain or water
    // puts a burning arrow out, gravity 0.05.
    if (a.water && this.fx) for (let i = 0; i < 4; i++) this.fx.spawn("bubble", a.x - a.mx * 0.25, a.y - a.my * 0.25, a.z - a.mz * 0.25, a.mx, a.my, a.mz);
    const drag = f(a.water ? 0.8 : 0.99);
    if (a.fire > 0 && (a.water || this.wet?.(a))) a.fire = 0;
    a.mx *= drag;
    a.my *= drag;
    a.mz *= drag;
    a.my -= f(0.05);
    // Entity.doBlockCollisions at the final box also calls BlockTNT for a grazing arrow
    // whose centre ray missed the block. Rain/water extinguishing above precedes this pass.
    if (a.fire > 0 && ctx.igniteTnt) {
      const b=box(a);
      for(let x=Math.floor(b[0]+0.001);x<=Math.floor(b[3]-0.001);x++)
        for(let y=Math.floor(b[1]+0.001);y<=Math.floor(b[4]-0.001);y++)
          for(let z=Math.floor(b[2]+0.001);z<=Math.floor(b[5]-0.001);z++)
            if(world.get(x,y,z)===TNT)ctx.igniteTnt(x,y,z,a.shooter);
    }
  }
  // Entity.addVelocity on a mob.
  push(mobs, e, x, y, z) {
    if (!mobs?.entities?.includes(e)) return;
    e.vx += x;
    e.vy += y;
    e.vz += z;
  }
  // The damage half of EntityArrow's hit: DamageSource.causeArrowDamage (indirect, a
  // projectile: not scaled by difficulty), setFire(5) from a burning arrow, then
  // attackEntityFrom. A mob's knockback comes from the shooter (the source's entity),
  // or from the arrow when there is none; a mob shot by a mob does not turn on the player.
  damageTarget(a, ref, dmg, ctx) {
    if (ref === "player") {
      const survival = ctx.survival, shooter = a.shooter;
      if (!survival) return false;
      // zc.h: a burning arrow does setFire(5) on its target before attackEntityFrom (Fire Protection shortens it).
      if (a.fire > 0) survival.setFire?.(5);
      const hit = !!survival.damage(dmg, "an arrow", true);
      // zc.h: a landed hit on a living entity does setArrowCountInEntity(count + 1).
      if (hit && survival.health > 0) survival.arrowCount = addStuckArrow(survival.arrowCount);
      // A hit by an arrow a mob shot runs the wearer's Thorns on the shooter (EnchantmentHelper.func_151384_a).
      if (hit && shooter && typeof shooter === "object" && mobsHas(ctx.mobs, shooter))
        survival.thorns?.({
          hurt: (damage) => ctx.mobs.attackEntityFrom(shooter, damage, { from: ctx.player ? { x: ctx.player.x, z: ctx.player.z } : { x: a.x, z: a.z }, player: true, name: "thorns" }),
          sound: () => this.events.push({ sound: "damage.thorns", volume: 0.5, pitch: 1, position: { x: shooter.x, y: shooter.y, z: shooter.z } }),
        });
      return hit;
    }
    // A painting or item frame: attackEntityFrom with the arrow source; its entity is the shooter.
    if (ctx.hanging?.entities.includes(ref)) return ctx.hanging.attack(ref, a.shooter === "player" ? { player: true, creative: !!ctx.survival?.creative } : null);
    const mobs = ctx.mobs;
    if (!mobs?.entities?.includes(ref) || ref.health <= 0) return false;
    if (a.fire > 0) ref.fire = Math.max(ref.fire || 0, 100);
    const s = a.shooter, from = s === "player" ? ctx.player || a : s && typeof s === "object" ? s : a;
    return mobs.damage(ref, dmg, from.x, from.z, s === "player", s && typeof s === "object" ? s.type : null);
  }
  // EntityArrow.onCollideWithPlayer (zc.b_): the player's box grown by (1, 0.5, 1) touches a
  // stuck arrow that has stopped shaking. canBePickedUp 1 needs room in the inventory (one
  // arrow is added), 2 works in Creative only; the pickup sound is random.pop at 0.2.
  collect(playerBox, survival, take = (n) => survival.add(ARROW, n)) {
    const near = [playerBox[0] - 1, playerBox[1] - 0.5, playerBox[2] - 1, playerBox[3] + 1, playerBox[4] + 0.5, playerBox[5] + 1];
    let n = 0;
    for (const a of this.list) {
      if (a.dead || !a.inGround || a.shake > 0 || !overlap(box(a), near)) continue;
      let ok = a.pickup === 1 || (a.pickup === 2 && survival.creative);
      if (a.pickup === 1 && !take(1)) ok = false;
      if (!ok) continue;
      this.sound(a, "random.pop", f(0.2), f(f(f(f(a.rand.nextFloat() - a.rand.nextFloat()) * f(0.7)) + 1) * 2));
      a.dead = true;
      n++;
    }
    if (n) this.list = this.list.filter((a) => !a.dead);
    return n;
  }
  // EntityArrow.writeEntityToNBT: the tile (shorts), inTile, inData, shake, inGround, pickup
  // (bytes), life (ticksInGround), damage and the base Entity's position, motion, rotation
  // and fire. The shooter and the critical flag (a datawatcher byte) are not saved.
  serialize() {
    return this.list.filter((a) => !a.dead).map((a) => ({
      x: a.x, y: a.y, z: a.z, mx: a.mx, my: a.my, mz: a.mz, yaw: a.yaw, pitch: a.pitch,
      xTile: a.xTile, yTile: a.yTile, zTile: a.zTile, life: a.ticksInGround, inTile: a.inTile, inData: a.inData,
      shake: a.shake, inGround: a.inGround, pickup: a.pickup, damage: a.damage, ...(a.fire > 0 ? { fire: a.fire } : {}),
    }));
  }
  load(list) {
    this.clear();
    const ok = (v) => Number.isFinite(v), int = (v, lo, hi, d) => (Number.isInteger(v) ? bound(v, lo, hi) : d);
    for (const d of (Array.isArray(list) ? list : []).slice(0, 300))
      if (d && [d.x, d.y, d.z, d.mx, d.my, d.mz].every(ok)) {
        const yaw = ok(d.yaw) ? f(d.yaw) : 0, pitch = ok(d.pitch) ? f(d.pitch) : 0;
        this.list.push(
          this.make({ x: d.x, y: d.y, z: d.z, mx: d.mx, my: d.my, mz: d.mz, yaw, pitch }, this.rng(), {
            xTile: int(d.xTile, -1, 2 ** 15, -1), yTile: int(d.yTile, -1, 255, -1), zTile: int(d.zTile, -1, 2 ** 15, -1),
            ticksInGround: int(d.life, 0, DESPAWN, 0), inTile: int(d.inTile, 0, 255, 0), inData: int(d.inData, 0, 15, 0),
            shake: int(d.shake, 0, 127, 0), inGround: d.inGround === true, pickup: int(d.pickup, 0, 2, 1),
            damage: ok(d.damage) ? d.damage : 2, fire: int(d.fire, 0, 2000, 0),
          }),
        );
      }
  }
  clear() {
    this.list = [];
    this.events = [];
  }
}

// ItemBow.onPlayerStoppedUsing (abm.a) and what follows: with the stack held, in Creative, with Infinity
// or with an arrow in the inventory, a draw of `ticks` of at least 0.1 power launches an
// arrow at power * 2 (a critical one at full power), the bow loses 1 durability,
// `random.bow` plays at volume 1 and pitch 1 / (itemRand * 0.4 + 1.2) + power * 0.5, and
// in Survival one arrow is used up (otherwise the arrow cannot be picked up as an item).
// The bow's enchantments follow the launch, in ItemBow's order: Power (damage + level * 0.5 + 0.5), Punch
// (knockbackStrength), Flame (setFire(100)), then the bow's durability and the sound. Infinity behaves as
// Creative does here: no arrow is needed or consumed and the arrow is canBePickedUp 2.
// Returns the arrow, or null when nothing was shot.
export function releaseBow({ survival, arrows, ticks, feet, yaw, pitch }) {
  const creative = survival.creative, inv = survival.inventory,
    at = inv?.held?.id === BOW ? inv.current : inv?.find?.(BOW), bow = at >= 0 && at != null ? inv.getStack(at) : null,
    flag = creative || bowEnchantments(bow).infinity > 0;
  if (!flag && !survival.count(ARROW)) return null;
  const power = releasePower(ticks);
  if (power === null) return null;
  const arrow = arrows.shootPlayer(feet, yaw, pitch, f(power * 2), { creative: flag, crit: power === 1 });
  applyBowEnchantments(arrow, bow, creative);
  survival.wear(BOW, 1);
  arrows.events.push({ sound: "random.bow", volume: 1, pitch: shotPitch(arrows.itemRand, power) });
  if (!flag) survival.take(ARROW);
  return arrow;
}
// ItemBow.onItemRightClick (abm.a(add, ahb, yz)): the draw starts in Creative or with an arrow (the Infinity
// shortcut applies only on release, as in the original, so the draw itself still needs one).
export const canDraw = (survival) => survival.creative || survival.count(ARROW) > 0;
