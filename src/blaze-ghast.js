// EntityBlaze (xx), EntityGhast (yd), EntityLargeFireball (zg), EntitySmallFireball (zi) and their base EntityFireball (ze) of Minecraft Java
// 1.7.10: the pure rules. Replayed in blaze-ghast.test.js against public/research/blaze-ghast-reference.json (tools/probes/BlazeGhastProbe.java,
// tools/verify-blaze-ghast.mjs). blaze-ghast-mobs.js and fireballs.js wire them to the engine. Where a rule is read from the bytecode and not
// probed, the comment says so. Floats are fround-ed where the original keeps floats.
const f = Math.fround;
const DEG = 180 / 3.1415927410125732;

// Internal item ids (original-items.js): blaze rod 369 -> 387, ghast tear 370 -> 389; gunpowder is 330 here.
export const BLAZE_ROD = 387, GHAST_TEAR = 389, GUNPOWDER = 330, FIRE_CHARGE = 1952;

export const BLAZE = Object.freeze({
  health: 20, width: f(0.6), height: f(1.8), speed: f(0.1), attackDamage: 6, followRange: 16, experience: 10, volume: 1, talkInterval: 80,
  sounds: Object.freeze({ living: "mob.blaze.breathe", hurt: "mob.blaze.hit", death: "mob.blaze.death" }),
  // RenderGlobal.playAuxSFX (bma): 1009 is mob.ghast.fireball at volume 2, pitch (rand - rand) * 0.2 + 1; the crackle is the client-side
  // onLivingUpdate roll (one in 24, fire.fire).
  crackleSound: "fire.fire", shootSound: "mob.ghast.fireball", shootVolume: 2, shootEvent: 1009, shotsPerVolley: 3, range: 30, meleeRange: 2, shadow: 0.5,
});
export const GHAST = Object.freeze({
  health: 10, width: f(4), height: f(4), experience: 5, volume: f(10), talkInterval: 80, maxSpawnedInChunk: 1, targetRange: 100, aggroRange: 64,
  sounds: Object.freeze({ living: "mob.ghast.moan", hurt: "mob.ghast.scream", death: "mob.ghast.death" }),
  // RenderGlobal.playAuxSFX: 1007 mob.ghast.charge and 1008 mob.ghast.fireball, both at volume 10, pitch (rand - rand) * 0.2 + 1.
  chargeSound: "mob.ghast.charge", fireSound: "mob.ghast.fireball", eventVolume: 10, warnEvent: 1007, fireEvent: 1008, shadow: 0.5,
});
// EntityFireball: 0.95 friction (0.8 in water), 0.1 acceleration; EntityLargeFireball is 1 x 1, EntitySmallFireball 0.3125 x 0.3125.
export const FIREBALL = Object.freeze({
  speed: 0.1, noise: 0.4, friction: f(0.95), waterFriction: f(0.8), largeSize: 1, smallSize: f(0.3125), maxGroundTicks: 600, ownerGrace: 25,
  smallDamage: 5, smallFireSeconds: 5, largeDamage: 6, defaultPower: 1, deflectDamageIgnored: true,
});

// Drops. Blaze (xx.b): only after a player hit, rand.nextInt(2 + looting) rods. Ghast (yd.b): rand.nextInt(2) + rand.nextInt(1 + looting)
// tears, then rand.nextInt(3) + rand.nextInt(1 + looting) gunpowder, whether or not a player hit it.
export function blazeDrops(rand, looting, playerHit) {
  return playerHit ? Array(rand.nextInt(2 + looting)).fill(BLAZE_ROD) : [];
}
export function ghastDrops(rand, looting) {
  const out = [];
  for (let n = rand.nextInt(2) + rand.nextInt(1 + looting); n > 0; n--) out.push(GHAST_TEAR);
  for (let n = rand.nextInt(3) + rand.nextInt(1 + looting); n > 0; n--) out.push(GUNPOWDER);
  return out;
}

// --- EntityBlaze ---
export const blazeState = () => ({ attackTime: 0, shots: 0, burning: false, hasAttacked: false, hoverDelay: 0, hoverOffset: 0.5 });

// xx.a(sa, F) (attackEntity), called with attackTime already counted down for this tick. `target` is { y, height, x, z, minY } of the
// victim (minY the foot, maxY = minY + height) and `me` the blaze { x, y, z }. Returns { melee } or { yaw, shot: {...} | null, event }.
// The shot's aim vector is (dx + gauss * f9, dy, dz + gauss * f9) with f9 = sqrt(distance) * 0.5 (qh.c(F) * 0.5): two gaussians of the
// blaze's Random, x first.
export function blazeAttack(s, rand, me, target, distance) {
  const out = { melee: false, shot: null, event: 0, yaw: null };
  if (s.attackTime <= 0 && distance < BLAZE.meleeRange && target.minY + target.height > me.y && target.minY < me.y + BLAZE.height) {
    s.attackTime = 20;
    out.melee = true;
    return out;
  }
  if (distance < BLAZE.range) {
    const dx = target.x - me.x, dy = target.minY + f(target.height / 2) - (me.y + f(BLAZE.height / 2)), dz = target.z - me.z;
    if (s.attackTime === 0) {
      s.shots++;
      if (s.shots === 1) { s.attackTime = 60; s.burning = true; }
      else if (s.shots <= 4) s.attackTime = 6;
      else { s.attackTime = 100; s.shots = 0; s.burning = false; }
      if (s.shots > 1) {
        const spread = f(Math.sqrt(distance) * f(0.5));
        const gx = rand.nextGaussian(), gz = rand.nextGaussian();
        out.event = BLAZE.shootEvent;
        out.shot = { dx: dx + gx * spread, dy, dz: dz + gz * spread, x: me.x, y: me.y + f(BLAZE.height / 2) + 0.5, z: me.z };
      }
    }
    out.yaw = f(f((Math.atan2(dz, dx) * 180) / 3.1415927410125732) - 90);
    s.hasAttacked = true;
  }
  return out;
}

// xx.e()'s server half: the hover countdown (100 ticks, offset 0.5 + gauss * 3), the upward push while the target is above, the 0.6
// fall damping in the air. Returns the new vertical motion. `wet` is isWet (water or rain): the caller deals 1 drown damage.
export function blazeHover(s, rand, e, target, { onGround }) {
  let vy = e.vy;
  if (--s.hoverDelay <= 0) {
    s.hoverDelay = 100;
    s.hoverOffset = f(f(0.5) + f(f(rand.nextGaussian()) * f(3)));
  }
  if (target && target.y + target.eye > e.y + e.eye + s.hoverOffset) vy += (0.3 - vy) * 0.3;
  if (!onGround && vy < 0) vy *= 0.6;
  return vy;
}

// --- EntityGhast ---
export const ghastState = () => ({ wx: 0, wy: 0, wz: 0, wander: 0, charge: 0, prevCharge: 0, delay: 0, explosionPower: 1, hasTarget: false });

// yd.bq() (updateEntityActionState). `me` is { x, y, z, vx, vy, vz }; ctx supplies world.getClosestVulnerablePlayerToEntity(this, 100)
// (`findPlayer()` -> { x, minY, z, height, distSq } or null), canEntityBeSeen, the swept-box test of yd.a(DDDD) and the events. It
// mutates `s` and `me` (motion, yaw) and returns { yaw, fireball } for the engine.
export function ghastStep(s, rand, me, ctx) {
  s.prevCharge = s.charge;
  let dx = s.wx - me.x, dy = s.wy - me.y, dz = s.wz - me.z, d = dx * dx + dy * dy + dz * dz;
  if (d < 1 || d > 3600) {
    s.wx = me.x + f(f(f(rand.nextFloat() * 2) - 1) * 16);
    s.wy = me.y + f(f(f(rand.nextFloat() * 2) - 1) * 16);
    s.wz = me.z + f(f(f(rand.nextFloat() * 2) - 1) * 16);
  }
  if (s.wander-- <= 0) {
    s.wander += rand.nextInt(5) + 2;
    d = f(Math.sqrt(d));
    if (ctx.pathClear(s.wx, s.wy, s.wz, d)) {
      me.vx += (dx / d) * 0.1;
      me.vy += (dy / d) * 0.1;
      me.vz += (dz / d) * 0.1;
    } else { s.wx = me.x; s.wy = me.y; s.wz = me.z; }
  }
  if (!s.hasTarget || s.delay-- <= 0) {
    s.hasTarget = !!ctx.findPlayer();
    if (s.hasTarget) s.delay = 20;
  }
  const target = s.hasTarget ? ctx.target() : null;
  if (!target) s.hasTarget = false;
  let yaw, fireball = null;
  if (target && target.distSq < GHAST.aggroRange * GHAST.aggroRange) {
    dx = target.x - me.x;
    dy = target.minY + f(target.height / 2) - (me.y + f(GHAST.height / 2));
    dz = target.z - me.z;
    yaw = f(f(f(-f(Math.atan2(dx, dz))) * 180) / f(Math.PI));
    if (ctx.canSee()) {
      if (s.charge === 10) ctx.event(GHAST.warnEvent);
      s.charge++;
      if (s.charge === 20) {
        ctx.event(GHAST.fireEvent);
        fireball = { dx, dy, dz, power: s.explosionPower };
        s.charge = -40;
      }
    } else if (s.charge > 0) s.charge--;
  } else {
    yaw = f(f(f(-f(Math.atan2(me.vx, me.vz))) * 180) / f(Math.PI));
    if (s.charge > 0) s.charge--;
  }
  return { yaw, fireball, charging: s.charge > 10 };
}

// --- EntityFireball ---
// ze(world, shooter, dx, dy, dz): motion zero, each component of the aim gets gauss * 0.4 (x, y, z in that order, on the fireball's own
// Random), then acceleration = aim / |aim| * 0.1. ze(world, x, y, z, ax, ay, az) (the dispenser form) normalises without noise.
export function fireballAcceleration(dx, dy, dz, rand = null) {
  if (rand) { dx += rand.nextGaussian() * FIREBALL.noise; dy += rand.nextGaussian() * FIREBALL.noise; dz += rand.nextGaussian() * FIREBALL.noise; }
  const d = f(Math.sqrt(dx * dx + dy * dy + dz * dz));
  return d === 0 ? [0, 0, 0] : [(dx / d) * FIREBALL.speed, (dy / d) * FIREBALL.speed, (dz / d) * FIREBALL.speed];
}
// ze.h()'s motion step after the sweep: position moves by the old motion, then motion += acceleration and is multiplied by 0.95 (0.8 in water).
export function fireballStep(b, inWater) {
  b.x += b.vx; b.y += b.vy; b.z += b.vz;
  const k = inWater ? FIREBALL.waterFriction : FIREBALL.friction;
  b.vx = (b.vx + b.ax) * k; b.vy = (b.vy + b.ay) * k; b.vz = (b.vz + b.az) * k;
}
// ze.a(ro, F) when a player hits it: motion becomes the look vector, acceleration look * 0.1, the player the owner. Not hurt by water.
export function deflect(b, look) {
  b.vx = look[0]; b.vy = look[1]; b.vz = look[2];
  b.ax = look[0] * 0.1; b.ay = look[1] * 0.1; b.az = look[2] * 0.1;
}
// The block cell a small fireball lights: the cell next to the hit face (azu.e: 0 down, 1 up, 2 north z-1, 3 south z+1, 4 west x-1, 5 east x+1).
export function faceCell(x, y, z, side) {
  const d = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]][side] ?? [0, 0, 0];
  return [x + d[0], y + d[1], z + d[2]];
}
export const ghastPitch = (rand) => f(f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2)) + 1);
// Hurt sounds that are not "mob.<type>.hurt".
export const HURT_SOUNDS = Object.freeze({ blaze: BLAZE.sounds.hurt, ghast: GHAST.sounds.hurt });
// Entity.getLook(1) for a pitch of 0 or not: MathHelper's table sine and cosine, in floats, as the ghast's fireball offset reads it.
export function lookVector(yaw, pitch, mhSin, mhCos) {
  const k = f(0.017453292), a = f(f(-yaw * k) - f(Math.PI)), b = f(-pitch * k), c = mhCos(a), s = mhSin(a), h = f(-mhCos(b)), v = mhSin(b);
  return [f(s * h), v, f(c * h)];
}
export { DEG };
