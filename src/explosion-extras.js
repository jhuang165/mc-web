// b82 spblast82: the entities of Explosion.doExplosionA's list that explodeNonLiving (explosion-simulation.js) did not reach yet.
//
// Bytecode-read agw.a(): one World.getEntitiesWithinAABBExcludingEntity(exploder, box) list; for each entity with getDistance / size <= 1 and a non-zero distance to its
// eye (posY + getEyeHeight), attackEntityFrom(DamageSource.setExplosionSource(this), damage) and then, whatever that returned, motion += unit * impact
// (EnchantmentProtection.func_92092_a only scales an EntityLivingBase). So every kind is pushed, not only the living ones and items:
//   - EntityLargeFireball (ze.a(ro, F)): setBeenAttacked; the explosion's source entity (ro.a(agw): "explosion.player" with getExplosivePlacedBy, a TNT's placer or a
//     living exploder, else a plain "explosion" with none) turns the ball to its look and becomes the shooter (the punch rule, Fireballs.hitBall). Then the push.
//   - EntitySmallFireball (zi.a) and EntityWitherSkull (zp.a) return false at once (no setBeenAttacked); the push still lands.
//   - EntityFireworkRocket (zf), EntityEnderEye (zd) and EntityFishHook (xe) keep Entity.attackEntityFrom (sa.a: setBeenAttacked, false). Eye height 0; the eye and the hook
//     are 0.25 cubes from posY (zd's constructor sets yOffset 0).
//   - EntityLeashKnot (su, an EntityHanging): ss.a breaks it (setDead, onBroken does nothing for a knot); the push is moot.
import { explosionImpact } from "./explosion.js";
import { isFrozen } from "./saved-order.js";

const EYE_HALF = 0.125, EYE_SIZE = 0.25;
const add = (e, push, [kx, ky, kz] = ["vx", "vy", "vz"]) => { e[kx] += push[0]; e[ky] += push[1]; e[kz] += push[2]; };

/** Large and small fireballs or wither skulls (a Fireballs system: `list`, `boxOf`, `hitBall`). `placer`: getExplosivePlacedBy ("player", a mob, or null). */
export function explodeFireballs(system, world, x, y, z, size, exploder = null, placer = null) {
  for (const b of [...(system?.list ?? [])]) {
    if (b.dead || b === exploder || isFrozen(b)) continue;
    const hit = explosionImpact(world, x, y, z, size, b.x, b.y, b.z, b.y, system.boxOf(b)); // EntityFireball: yOffset 0, eye height 0
    if (!hit) continue;
    if (b.large) {
      b.velocityChanged = true; // ze.a: setBeenAttacked (the tracker sends S12)
      if (placer) system.hitBall(b, placer);
    }
    add(b, hit.push);
  }
}
/** Firework rockets (FireworkRockets.rockets records: motion mx/my/mz, `box`). */
export function explodeRockets(list, world, x, y, z, size, exploder = null) {
  for (const r of [...(list ?? [])]) {
    if (r.dead || r === exploder || isFrozen(r) || !r.box) continue;
    const hit = explosionImpact(world, x, y, z, size, r.x, r.y, r.z, r.y, r.box);
    if (!hit) continue;
    r.velocityChanged = true;
    add(r, hit.push, ["mx", "my", "mz"]);
  }
}
/** Eyes of ender (EyesOfEnder.eyes records: posY y, no box field). */
export function explodeEyes(list, world, x, y, z, size, exploder = null) {
  for (const e of [...(list ?? [])]) {
    if (e.dead || e === exploder || isFrozen(e)) continue;
    const box = [e.x - EYE_HALF, e.y, e.z - EYE_HALF, e.x + EYE_HALF, e.y + EYE_SIZE, e.z + EYE_HALF];
    const hit = explosionImpact(world, x, y, z, size, e.x, e.y, e.z, e.y, box);
    if (!hit) continue;
    e.velocityChanged = true;
    add(e, hit.push);
  }
}
/** Fishing hooks (FishHook: posY y, `bb`). */
export function explodeHooks(list, world, x, y, z, size, exploder = null) {
  for (const h of [...(list ?? [])]) {
    if (!h || h.dead || h === exploder || isFrozen(h) || !h.bb) continue;
    const hit = explosionImpact(world, x, y, z, size, h.x, h.y, h.z, h.y, h.bb);
    if (!hit) continue;
    h.velocityChanged = true;
    add(h, hit.push);
  }
}
/**
 * Leash knots (`mobs.knotList`, killed through `mobs.knotAttack`). The knot's posX/Y/Z is the fence cell plus 0.5 (su(ahb, int, int, int)); a summoned knot keeps its own
 * position (horse-gear-live.js, piston-push.js). Only the query box and the distance gate it: the damage is at least 1 and any hit breaks a hanging entity.
 */
export function explodeKnots(mobs, x, y, z, size, exploder = null) {
  const list = mobs?.knotList;
  if (!list?.length || !mobs.knotAttack) return;
  const r = Math.fround(size) * 2, cube = [x - r - 1, y - r - 1, z - r - 1, x + r + 1, y + r + 1, z + r + 1];
  for (const k of [...list]) {
    if (k.dead || k === exploder || isFrozen(k)) continue;
    const c = k.summoned ? { x: k.px, y: k.py, z: k.pz } : { x: k.x + 0.5, y: k.y + 0.5, z: k.z + 0.5 };
    const bb = [c.x - 0.25, c.y, c.z - 0.25, c.x + 0.25, c.y + 0.5, c.z + 0.25];
    if (!(bb[3] > cube[0] && bb[0] < cube[3] && bb[4] > cube[1] && bb[1] < cube[4] && bb[5] > cube[2] && bb[2] < cube[5])) continue;
    const dist = Math.fround(Math.sqrt((c.x - x) ** 2 + (c.y - y) ** 2 + (c.z - z) ** 2));
    if (!(dist / r <= 1) || dist === 0) continue;
    mobs.knotAttack(k);
  }
}
