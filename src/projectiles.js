// EntitySnowball (zj) from the 1.7.10 JAR, with EntityThrowable (zk) and
// ItemSnowball (aed); EntityEgg (zl) shares all of it and differs only in onImpact
// (see `layEggs`) and its item icon. Snowballs are 0.25 x 0.25 boxes thrown from the eye at
// 1.5 blocks/tick with gaussian inaccuracy, drag 0.99 (0.8 in water), gravity
// 0.03, a World.rayTraceBlocks (ahb.a) sweep each tick and an entity sweep
// (expand 0.3) that skips the thrower for the first five ticks. A hit deals
// 0 damage (3 for blazes, which this build lacks), spawns eight snowballpoof
// EntityBreakingFX (bju) particles and removes the ball. `y` is the bottom of
// the box, which is also the entity's posY (yOffset 0).
import { explosionImpact } from "./explosion.js";
import { acceptsParticle } from "./particle-settings.js";
import { JavaRandom, mhSin, mhCos } from "./lighting.js";
import { blockBounds, collisionBounds, snowSelectionHeight, FIRE, CARROTS, REEDS, LADDER, POTATOES, RED_FLOWER, SAPLING, SNOW_LAYER, YELLOW_FLOWER } from "./world.js";
import { ladderBounds } from "./ladders.js";
import { REED_BOUNDS } from "./plants.js";
import { ENTITY_TYPES } from "./entities.js";

const f = Math.fround;
const PI_F = f(Math.PI), PI_D = 3.1415927410125732;
const HW = 0.125, HEIGHT = 0.25, THROWER = "player";
// EntityBreakingFX / EntityFX: 0.2 x 0.2 box whose posY is its centre (yOffset
// height / 2), 0.04 x blockParticleGravity (1.0 for snow) per tick.
const P_HW = f(0.2 / 2), P_H = f(0.2), P_YOFF = f(P_H / 2), PARTICLES = 8;

// java.util.Random.nextGaussian (the polar method); Entity.rand is one of these.
export class GaussianRandom extends JavaRandom {
  nextGaussian() {
    if (this.spare !== undefined) {
      const g = this.spare;
      this.spare = undefined;
      return g;
    }
    let v1, v2, s;
    do {
      v1 = 2 * this.nextDouble() - 1;
      v2 = 2 * this.nextDouble() - 1;
      s = v1 * v1 + v2 * v2;
    } while (s >= 1 || s === 0);
    const m = Math.sqrt((-2 * Math.log(s)) / s);
    this.spare = v2 * m;
    return v1 * m;
  }
  // java.util.Random.nextBoolean.
  nextBoolean() {
    return this.next(1) !== 0;
  }
}

// java.util.Random.nextInt(bound): a power of two takes the high bits, otherwise
// the value is redrawn while the modulo would be biased (int overflow).
GaussianRandom.prototype.nextInt = function (bound) {
  let r = this.next(31);
  const m = bound - 1;
  if ((bound & m) === 0) return Math.floor((bound * r) / 2 ** 31);
  for (let u = r; ((u - (r = u % bound) + m) | 0) < 0; u = this.next(31));
  return r;
};

// MathHelper.sqrt_double (qh.a(D)F).
const sqrtF = (v) => f(Math.sqrt(v));

// EntityThrowable.setThrowableHeading (zk.c): normalise, add gaussian *
// 0.0075 * inaccuracy per axis (x, y, z in that order), scale by velocity,
// then derive yaw and pitch (degrees, floats) from the result.
export function heading(rand, x, y, z, velocity, inaccuracy) {
  const n = sqrtF(x * x + y * y + z * z);
  x /= n;
  y /= n;
  z /= n;
  x += rand.nextGaussian() * 0.007499999832361937 * f(inaccuracy);
  y += rand.nextGaussian() * 0.007499999832361937 * f(inaccuracy);
  z += rand.nextGaussian() * 0.007499999832361937 * f(inaccuracy);
  x *= f(velocity);
  y *= f(velocity);
  z *= f(velocity);
  const flat = sqrtF(x * x + z * z),
    yaw = f((Math.atan2(x, z) * 180) / PI_D),
    pitch = f((Math.atan2(y, flat) * 180) / PI_D);
  return { mx: x, my: y, mz: z, yaw, pitch };
}

// EntityThrowable(world, thrower) (zk): from the eye (the integrated server's
// EntityPlayerMP reports 1.62), shifted 0.16 to the right and 0.1 down, with
// motion 0.4 along the view before func_70186_c(1.5, 1.0). This build's yaw and
// pitch are radians looking along (-sin yaw cos pitch, sin pitch, -cos yaw cos
// pitch); Minecraft's are degrees with yaw' = 180 - yaw and pitch' = -pitch.
export function launch(rand, feet, yaw, pitch) {
  const mcYaw = f(180 - (yaw * 180) / Math.PI), mcPitch = f((-pitch * 180) / Math.PI),
    k = f(f(mcYaw / 180) * PI_F), p = f(f(mcPitch / 180) * PI_F),
    s = mhSin(k), c = mhCos(k), power = f(0.4);
  const h = heading(
    rand,
    f(f(-s * mhCos(p)) * power),
    f(-mhSin(p) * power),
    f(f(c * mhCos(p)) * power),
    1.5,
    1,
  );
  return {
    x: feet.x - f(c * f(0.16)),
    y: feet.y + f(1.62) - 0.10000000149011612,
    z: feet.z - f(s * f(0.16)),
    ...h,
  };
}

// Vec3.getIntermediateWithX/Y/Z (azw.b/c/d): the point where the segment
// a -> b crosses a coordinate plane, or null when it is parallel or outside.
const EPS = 1.0000000116860974e-7;
function between(a, b, axis, value) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  if (d[axis] * d[axis] < EPS) return null;
  const t = (value - a[axis]) / d[axis];
  return t >= 0 && t <= 1 ? [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t] : null;
}
const dist2 = (a, b) => (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2;

// AxisAlignedBB.calculateIntercept (azt.a) and, applied after translating the
// segment into block space, Block.collisionRayTrace (aji.a): the nearest
// entry among the six face planes whose hit lies inside the face. Sides are
// 0 y-, 1 y+, 2 z-, 3 z+, 4 x-, 5 x+.
export function intercept([x0, y0, z0, x1, y1, z1], a, b) {
  const hits = [
    between(a, b, 0, x0), between(a, b, 0, x1),
    between(a, b, 1, y0), between(a, b, 1, y1),
    between(a, b, 2, z0), between(a, b, 2, z1),
  ];
  const inYZ = (v) => v && v[1] >= y0 && v[1] <= y1 && v[2] >= z0 && v[2] <= z1,
    inXZ = (v) => v && v[0] >= x0 && v[0] <= x1 && v[2] >= z0 && v[2] <= z1,
    inXY = (v) => v && v[0] >= x0 && v[0] <= x1 && v[1] >= y0 && v[1] <= y1;
  const ok = [inYZ(hits[0]), inYZ(hits[1]), inXZ(hits[2]), inXZ(hits[3]), inXY(hits[4]), inXY(hits[5])],
    sides = [4, 5, 0, 1, 2, 3];
  let best = -1;
  for (let i = 0; i < 6; i++) if (ok[i] && (best < 0 || dist2(a, hits[i]) < dist2(a, hits[best]))) best = i;
  return best < 0 ? null : { vec: hits[best], side: sides[best] };
}

// Selection boxes (setBlockBoundsBasedOnState) of the blocks in this build:
// farmland 15/16 high, crops 1/4, tall grass inset 0.1, chests inset 1/16
// (joined towards a partner) and BlockTorch.collisionRayTrace (aoc.a), which
// sets the standing-torch box (f = 0.1) before the ordinary ray test. Every
// other block is a full cube. See also shadow-reference.json, whose default
// bounds are not the torch's ray bounds.
const T = f(0.1);
const RAY_BOUNDS = {
  20: [f(0.5 - T), 0, f(0.5 - T), f(0.5 + T), f(0.6), f(0.5 + T)],
  29: [0, 0, 0, 1, 0.9375, 1],
  30: [0, 0, 0, 1, 0.9375, 1],
  39: [0.09999999403953552, 0, 0.09999999403953552, 0.8999999761581421, 0.800000011920929, 0.8999999761581421],
};
for (let id = 31; id <= 38; id++) RAY_BOUNDS[id] = [0, 0, 0, 1, 0.25, 1];
RAY_BOUNDS[CARROTS] = RAY_BOUNDS[POTATOES] = [0, 0, 0, 1, 0.25, 1];
// BlockReed: setBlockBounds(0.125, 0, 0.125, 0.875, 1, 0.875). BlockCactus keeps the full cube.
RAY_BOUNDS[REEDS] = [...REED_BOUNDS];
// BlockBush(f = 0.2): 0.5 - f .. 0.5 + f wide and f * 3 high (shadow-reference.json).
RAY_BOUNDS[YELLOW_FLOWER] = RAY_BOUNDS[RED_FLOWER] = [f(0.5 - f(0.2)), 0, f(0.5 - f(0.2)), f(0.5 + f(0.2)), f(f(0.2) * 3), f(0.5 + f(0.2))];
// BlockSapling(f = 0.4): 0.5 - f .. 0.5 + f wide and f * 2 high (shadow-reference.json).
RAY_BOUNDS[SAPLING] = [f(0.5 - f(0.4)), 0, f(0.5 - f(0.4)), f(0.5 + f(0.4)), f(f(0.4) * 2), f(0.5 + f(0.4))];
// A snow layer's selection box is (metadata + 1) / 8 high (BlockSnow.setBlockBoundsBasedOnState);
// a ladder's is its plate (BlockLadder.setBlockBoundsBasedOnState).
export const rayBounds = (world, x, y, z, id) =>
  id === 41 ? blockBounds(world, x, y, z) : id === LADDER ? ladderBounds(world.getMeta?.(x, y, z) ?? 0) : id === SNOW_LAYER ? [0, 0, 0, 1, snowSelectionHeight(world.getMeta?.(x, y, z) ?? 0), 1] : RAY_BOUNDS[id] || [0, 0, 0, 1, 1, 1];

// World.rayTraceBlocks (ahb.a(Vec3, Vec3) = func_147447_a(false, false, false)):
// walk the cells along the segment (at most 201 steps, each moving the start
// vector to the cell's entry point) and return the first block that is not
// air or water with its ray bounds hit. Below y 0 the world is air. `hasBox` is
// func_147447_a's ignoreBlockWithoutBoundingBox (EntityArrow passes true): only
// blocks with a collision box count, which leaves out torches and plants.
export function rayTraceBlocks(world, start, end, hasBox = false) {
  if (start.some(Number.isNaN) || end.some(Number.isNaN)) return null;
  const id = (x, y, z) => (y < 0 ? 0 : world.get(x, y, z)),
    // BlockFire.isCollidable is false, so canCollideCheck skips fire like air.
    solid = (b) => b !== 0 && b !== 10 && b !== 42 && b !== FIRE,
    test = (x, y, z, a) => {
      const b = id(x, y, z);
      if (!solid(b) || (hasBox && !world.solid(x, y, z))) return null;
      const [x0, y0, z0, x1, y1, z1] = rayBounds(world, x, y, z, b),
        hit = intercept([x0, y0, z0, x1, y1, z1], [a[0] - x, a[1] - y, a[2] - z], [end[0] - x, end[1] - y, end[2] - z]);
      return hit && { block: [x, y, z], side: hit.side, vec: [hit.vec[0] + x, hit.vec[1] + y, hit.vec[2] + z] };
    };
  const a = [...start], ex = Math.floor(end[0]), ey = Math.floor(end[1]), ez = Math.floor(end[2]);
  let x = Math.floor(a[0]), y = Math.floor(a[1]), z = Math.floor(a[2]);
  const first = test(x, y, z, a);
  if (first) return first;
  for (let n = 200; n-- >= 0; ) {
    if (a.some(Number.isNaN)) return null;
    if (x === ex && y === ey && z === ez) return null;
    let mx = true, my = true, mz = true, d0 = 999, d1 = 999, d2 = 999;
    if (ex > x) d0 = x + 1;
    else if (ex < x) d0 = x;
    else mx = false;
    if (ey > y) d1 = y + 1;
    else if (ey < y) d1 = y;
    else my = false;
    if (ez > z) d2 = z + 1;
    else if (ez < z) d2 = z;
    else mz = false;
    let tx = 999, ty = 999, tz = 999;
    const dx = end[0] - a[0], dy = end[1] - a[1], dz = end[2] - a[2];
    if (mx) tx = (d0 - a[0]) / dx;
    if (my) ty = (d1 - a[1]) / dy;
    if (mz) tz = (d2 - a[2]) / dz;
    let side;
    if (tx < ty && tx < tz) {
      side = ex > x ? 4 : 5;
      a[0] = d0;
      a[1] += dy * tx;
      a[2] += dz * tx;
    } else if (ty < tz) {
      side = ey > y ? 0 : 1;
      a[0] += dx * ty;
      a[1] = d1;
      a[2] += dz * ty;
    } else {
      side = ez > z ? 2 : 3;
      a[0] += dx * tz;
      a[1] += dy * tz;
      a[2] = d2;
    }
    x = Math.floor(a[0]);
    if (side === 5) x--;
    y = Math.floor(a[1]);
    if (side === 1) y--;
    z = Math.floor(a[2]);
    if (side === 3) z--;
    const hit = test(x, y, z, a);
    if (hit) return hit;
  }
  return null;
}

// Entity.handleWaterMovement for a 0.25 box (func_72918_a, box.expand(0,
// -0.4, 0).contract(0.001)): the shrunk box is inverted, so it reaches only
// the cell at floor(y) and only while y's fraction lies in [0.151, 0.599).
// Water here is the still block id 10 (a source block always passes the
// liquid-height test).
export function inWater(world, x, y, z) {
  const x0 = Math.floor(x - HW + 0.001), x1 = Math.floor(x + HW - 0.001 + 1),
    y0 = Math.floor(y + 0.4 + 0.001), y1 = Math.floor(y + HEIGHT - 0.4 - 0.001 + 1),
    z0 = Math.floor(z - HW + 0.001), z1 = Math.floor(z + HW - 0.001 + 1);
  for (let bx = x0; bx < x1; bx++)
    for (let by = y0; by < y1; by++) for (let bz = z0; bz < z1; bz++) if (world.get(bx, by, bz) === 10) return true;
  return false;
}

// Collision targets for the entity sweep: every mob's box (width x height from
// EntityPig/Cow/Zombie setSize, halved for calves) and the thrower's.
// Entity.canBeCollidedWith is true until the entity is dead, so dying mobs
// still count.
export function mobTargets(entities, player, width = 0.6, height = 1.8) {
  const out = entities.map((e) => {
    const t = ENTITY_TYPES[e.type], s = e.growingAge < 0 ? 0.5 : 1, w = f(t.width * s), h = f(t.height * s), hw = f(w / 2);
    return { ref: e, box: [e.x - hw, e.y, e.z - hw, e.x + hw, e.y + h, e.z + hw] };
  });
  if (player) {
    const hw = f(f(width) / 2);
    out.push({ ref: THROWER, thrower: true, box: [player.x - hw, player.y, player.z - hw, player.x + hw, player.y + f(height), player.z + hw] });
  }
  return out;
}

// EntityLivingBase.attackEntityFrom (sv.a) with the zero damage of
// DamageSource.causeThrownDamage: it still counts as a hit unless the target
// is dead or inside its hurt window, so the mob flashes, plays its hurt sound
// and is knocked away from the thrower (not along the ball's path) through
// EntityWorld.damage. EntityAnimal.attackEntityFrom sets fleeingTick 60 and
// cancels love first, even for a rejected hit. Health never changes.
export function thrownHit(mobs, e, from) {
  if (!mobs.entities.includes(e)) return false;
  if (e.type !== "zombie" && e.type !== "skeleton") {
    e.flee = 60;
    e.love = 0;
    e.mateTicks = 0;
  }
  return mobs.damage(e, 0, from.x, from.z);
}

export class Projectiles {
  constructor(random = Math.random) {
    this.random = random;
    this.particleSetting = 0;
    this.particleRandom = new JavaRandom(Math.floor(Math.random() * 2 ** 48));
    this.particleViewer = null;
    this.balls = [];
    this.particles = [];
    this.events = [];
  }
  // Entity.rand is a fresh java.util.Random per entity.
  rng() {
    return new GaussianRandom(Math.floor(this.random() * 2 ** 48));
  }
  // ItemSnowball.onItemRightClick (aed.a) spawns this; the stack and sound are
  // the caller's. lastTickPos starts at the spawn point.
  throwSnowball(feet, yaw, pitch, kind = "snowball") {
    const rand = this.rng(), h = launch(rand, feet, yaw, pitch),
      ball = { ...h, kind, px: h.x, py: h.y, pz: h.z, prevYaw: h.yaw, prevPitch: h.pitch, ticks: 0, rand, dead: false };
    this.balls.push(ball);
    return ball;
  }
  // ItemEgg.onItemRightClick (ack.a) spawns an EntityEgg (zl) the same way.
  throwEgg(feet, yaw, pitch) {
    return this.throwSnowball(feet, yaw, pitch, "egg");
  }
  // EntityEgg.onImpact (zl.a) after the 0-damage hit: with probability 1/8 a chick
  // hatches (rand.nextInt(8) == 0), four of them with 1/32 (rand.nextInt(32) == 0),
  // each a child (age -24000) at the egg's position with its rotationYaw and pitch 0.
  // The caller turns the event into mobs; `yaw` is the egg's Java yaw in degrees.
  layEggs(b) {
    if (b.rand.nextInt(8) !== 0) return 0;
    const count = b.rand.nextInt(32) === 0 ? 4 : 1;
    this.events.push({ chicks: count, x: b.x, y: b.y, z: b.z, yaw: b.yaw });
    return count;
  }
  drain() {
    const events = this.events;
    this.events = [];
    return events;
  }
  // EntityThrowable inherits zero eye height and ignores damage; explosions still add motion.
  explode(world, x, y, z, size, exploder = null) {
    for (const b of this.balls) {
      if (b.dead || b === exploder) continue;
      const hit = explosionImpact(world, x, y, z, size, b.x, b.y, b.z, b.y,
        [b.x - HW, b.y, b.z - HW, b.x + HW, b.y + HEIGHT, b.z + HW]);
      if (hit) { b.mx += hit.push[0]; b.my += hit.push[1]; b.mz += hit.push[2]; }
    }
  }
  // EntityThrowable.onUpdate (zk.h) for every ball, then EffectRenderer's
  // update of the particles. `onHit(ref, ball)` applies the 0-damage hit.
  tick(world, targets = [], onHit = () => {}) {
    for (const b of this.balls) if (!b.dead) this.step(world, b, targets, onHit);
    this.balls = this.balls.filter((b) => !b.dead);
    for (const p of this.particles) this.moveParticle(world, p);
    this.particles = this.particles.filter((p) => !p.dead);
  }
  step(world, b, targets, onHit) {
    b.px = b.x;
    b.py = b.y;
    b.pz = b.z;
    // Entity.onEntityUpdate: previous rotation, water, the -64 void.
    b.prevYaw = b.yaw;
    b.prevPitch = b.pitch;
    b.water = inWater(world, b.x, b.y, b.z);
    if (b.y < -64) b.dead = true;
    b.ticks++;
    const start = [b.x, b.y, b.z], far = [b.x + b.mx, b.y + b.my, b.z + b.mz],
      block = rayTraceBlocks(world, start, far),
      end = block ? block.vec : far;
    // The thrower is skipped until the ball has been in the air five ticks;
    // the nearest expand(0.3) box wins (a later one only if `d1 < d0`, or while
    // d0 is still zero).
    const box = [b.x - HW, b.y, b.z - HW, b.x + HW, b.y + HEIGHT, b.z + HW],
      area = [
        box[0] + Math.min(0, b.mx) - 1, box[1] + Math.min(0, b.my) - 1, box[2] + Math.min(0, b.mz) - 1,
        box[3] + Math.max(0, b.mx) + 1, box[4] + Math.max(0, b.my) + 1, box[5] + Math.max(0, b.mz) + 1,
      ];
    let hit = null, d0 = 0;
    const grow = f(0.3);
    for (const t of targets) {
      const e = t.box;
      if (!(e[3] > area[0] && e[0] < area[3] && e[4] > area[1] && e[1] < area[4] && e[5] > area[2] && e[2] < area[5])) continue;
      if (t.thrower && b.ticks < 5) continue;
      const r = intercept([e[0] - grow, e[1] - grow, e[2] - grow, e[3] + grow, e[4] + grow, e[5] + grow], start, end);
      if (!r) continue;
      const d1 = Math.sqrt(dist2(start, r.vec));
      if (d1 < d0 || d0 === 0) {
        hit = t;
        d0 = d1;
      }
    }
    if (hit || block) {
      // EntitySnowball.onImpact (zj.a): attackEntityFrom(thrown damage 0),
      // eight snowballpoof at the ball's current position, then setDead.
      if (hit) onHit(hit.ref, b);
      if (b.kind === "egg") this.layEggs(b);
      for (let i = 0; i < PARTICLES; i++) this.poof(b.x, b.y, b.z);
      b.dead = true;
      return;
    }
    b.x += b.mx;
    b.y += b.my;
    b.z += b.mz;
    // Rotation eases a fifth of the way to the heading (float maths).
    const flat = sqrtF(b.mx * b.mx + b.mz * b.mz);
    b.yaw = f((Math.atan2(b.mx, b.mz) * 180) / PI_D);
    b.pitch = f((Math.atan2(b.my, flat) * 180) / PI_D);
    while (f(b.pitch - b.prevPitch) < -180) b.prevPitch = f(b.prevPitch - 360);
    while (f(b.pitch - b.prevPitch) >= 180) b.prevPitch = f(b.prevPitch + 360);
    while (f(b.yaw - b.prevYaw) < -180) b.prevYaw = f(b.prevYaw - 360);
    while (f(b.yaw - b.prevYaw) >= 180) b.prevYaw = f(b.prevYaw + 360);
    b.pitch = f(b.prevPitch + f(f(b.pitch - b.prevPitch) * f(0.2)));
    b.yaw = f(b.prevYaw + f(f(b.yaw - b.prevYaw) * f(0.2)));
    // Drag 0.99 (0.8 in water: the original also emits four bubbles, omitted
    // here along with the splash sound) and gravity 0.03.
    const drag = f(b.water ? 0.8 : 0.99);
    b.mx *= drag;
    b.my *= drag;
    b.mz *= drag;
    b.my -= f(0.03);
  }
  // new EntityBreakingFX(world, x, y, z, snowball) (bju) -> EntityFX (bkm).
  // Entity.rand draws the texture jitter, scale and lifetime (in that order);
  // Math.random the motion: each axis gets a +-0.4 kick, and the vector is
  // rescaled to length f * 0.4 with +0.1 upwards.
  poof(x, y, z) {
    if (!acceptsParticle("snowballpoof", this.particleSetting, this.particleRandom, x, y, z, this.particleViewer)) return null;
    const rand = this.rng(), r = this.random,
      jx = f(rand.nextFloat() * 3), jy = f(rand.nextFloat() * 3),
      scale = f(f(f(rand.nextFloat() * 0.5) + 0.5) * 2),
      max = Math.trunc(f(4 / f(f(rand.nextFloat() * 0.9) + 0.1)));
    let mx = f(f(r() * 2 - 1) * f(0.4)), my = f(f(r() * 2 - 1) * f(0.4)), mz = f(f(r() * 2 - 1) * f(0.4));
    const speed = f(f(r() + r() + 1) * f(0.15)), n = sqrtF(mx * mx + my * my + mz * mz);
    mx = (mx / n) * speed * 0.4000000059604645;
    my = (my / n) * speed * 0.4000000059604645 + 0.10000000149011612;
    mz = (mz / n) * speed * 0.4000000059604645;
    const p = { x, y, z, px: x, py: y, pz: z, mx, my, mz, jx, jy, scale: f(scale / 2), max, age: 0, dead: false, onGround: false };
    this.particles.push(p);
    return p;
  }
  // Solid block boxes overlapping the volume (World.getCollidingBoundingBoxes);
  // the same walk as ItemEntities.boxes.
  boxes(world, x0, y0, z0, x1, y1, z1) {
    const out = [];
    for (let bx = Math.floor(x0); bx < Math.floor(x1 + 1); bx++)
      for (let by = Math.floor(y0) - 1; by < Math.floor(y1 + 1); by++)
        for (let bz = Math.floor(z0); bz < Math.floor(z1 + 1); bz++)
          if (world.solid(bx, by, bz)) {
            const [a, b, c, d, e, g] = collisionBounds(world, bx, by, bz);
            if (bx + d > x0 && bx + a < x1 && by + e > y0 && by + b < y1 && bz + g > z0 && bz + c < z1) out.push([bx + a, by + b, bz + c, bx + d, by + e, bz + g]);
          }
    return out;
  }
  // EntityFX.onUpdate (bkm.h): age, gravity 0.04, Entity.moveEntity (y, x, z
  // against block boxes), drag 0.98 and, on the ground, 0.7 horizontally.
  moveParticle(world, p) {
    p.px = p.x;
    p.py = p.y;
    p.pz = p.z;
    if (p.age++ >= p.max) p.dead = true;
    p.my -= 0.04 * f(1);
    let dx = p.mx, dy = p.my, dz = p.mz;
    const box = [p.x - P_HW, p.y - P_YOFF, p.z - P_HW, p.x + P_HW, p.y - P_YOFF + P_H, p.z + P_HW],
      list = this.boxes(world, Math.min(box[0], box[0] + dx), Math.min(box[1], box[1] + dy), Math.min(box[2], box[2] + dz), Math.max(box[3], box[3] + dx), Math.max(box[4], box[4] + dy), Math.max(box[5], box[5] + dz)),
      ody = dy, odx = dx, odz = dz;
    for (const o of list)
      if (o[3] > box[0] && o[0] < box[3] && o[5] > box[2] && o[2] < box[5]) {
        if (dy > 0 && o[1] >= box[4]) dy = Math.min(dy, o[1] - box[4]);
        else if (dy < 0 && o[4] <= box[1]) dy = Math.max(dy, o[4] - box[1]);
      }
    box[1] += dy;
    box[4] += dy;
    for (const o of list)
      if (o[4] > box[1] && o[1] < box[4] && o[5] > box[2] && o[2] < box[5]) {
        if (dx > 0 && o[0] >= box[3]) dx = Math.min(dx, o[0] - box[3]);
        else if (dx < 0 && o[3] <= box[0]) dx = Math.max(dx, o[3] - box[0]);
      }
    box[0] += dx;
    box[3] += dx;
    for (const o of list)
      if (o[4] > box[1] && o[1] < box[4] && o[3] > box[0] && o[0] < box[3]) {
        if (dz > 0 && o[2] >= box[5]) dz = Math.min(dz, o[2] - box[5]);
        else if (dz < 0 && o[5] <= box[2]) dz = Math.max(dz, o[5] - box[2]);
      }
    p.x += dx;
    p.y += dy;
    p.z += dz;
    p.onGround = ody !== dy && ody < 0;
    if (odx !== dx) p.mx = 0;
    if (odz !== dz) p.mz = 0;
    if (ody !== dy) p.my = 0;
    p.mx *= 0.9800000190734863;
    p.my *= 0.9800000190734863;
    p.mz *= 0.9800000190734863;
    if (p.onGround) {
      p.mx *= 0.699999988079071;
      p.mz *= 0.699999988079071;
    }
  }
  // EntitySnowball.writeEntityToNBT keeps Pos, Motion and Rotation (plus the
  // vestigial in-ground fields); ticksInAir is not saved, so loaded balls
  // start at 0. Particles are not saved.
  serialize() {
    return this.balls.map((b) => ({ x: b.x, y: b.y, z: b.z, mx: b.mx, my: b.my, mz: b.mz, yaw: b.yaw, pitch: b.pitch, ...(b.kind === "egg" ? { kind: "egg" } : {}) }));
  }
  load(list) {
    this.clear();
    const ok = (v) => Number.isFinite(v);
    for (const d of Array.isArray(list) ? list : [])
      if (d && [d.x, d.y, d.z, d.mx, d.my, d.mz].every(ok)) {
        const yaw = ok(d.yaw) ? f(d.yaw) : 0, pitch = ok(d.pitch) ? f(d.pitch) : 0;
        this.balls.push({ kind: d.kind === "egg" ? "egg" : "snowball", x: d.x, y: d.y, z: d.z, px: d.x, py: d.y, pz: d.z, mx: d.mx, my: d.my, mz: d.mz, yaw, pitch, prevYaw: yaw, prevPitch: pitch, ticks: 0, rand: this.rng(), dead: false });
      }
  }
  clear() {
    this.balls = [];
    this.particles = [];
    this.events = [];
  }
}
