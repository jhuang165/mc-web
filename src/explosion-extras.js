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
import { orderTargets, walkedY } from "./candidate-order.js"; // b83 blastorder83

const EYE_HALF = 0.125, EYE_SIZE = 0.25;
const add = (e, push, [kx, ky, kz] = ["vx", "vy", "vz"]) => { e[kx] += push[0]; e[ky] += push[1]; e[kz] += push[2]; };

// b83 blastorder83: doExplosionA's ONE list. World.getEntitiesWithinAABBExcludingEntity (ahb.b(sa, azt)) walks the chunks x outer, z inner, each chunk's vertical slices
// bottom up, each slice list in insertion order (candidate-order.js), and agw.a() hurts and pushes each listed entity in that order, whatever its kind. A row is one listed
// entity: `key` (its candidate-order key), `pos` (the posX/posY/posZ the walk stamps it with) and `run()` (its attackEntityFrom and push, computed at its turn: a nested blast
// before it, an ender crystal or TNT cart hurt earlier in the list, may have cleared blocks of its exposure rays). The list is taken once, before the first hurt, so an entity
// spawned during the pass (a kill's loot, a broken cart's item, a nested blast's orbs or primed TNT) is in no row.
/** The blast an entity row reads: `{ world, x, y, z, size, exploder, placer }`. */
export const blastNear = (b, px, py, pz) => (px - b.x) ** 2 + (py - b.y) ** 2 + (pz - b.z) ** 2 <= (2 * b.size + 1) ** 2; // a cheap superset of the distance gate (run() repeats the exact one)
// The y candidate-order's walk stamps an entity with (stampWalked), so a row's lookup agrees with the walk's cell.
const walkY = walkedY;
/** A row for entity `e` (skipped when dead, the exploder, frozen or out of reach); `py` is the posY that gates the reach. */
export function blastRow(b, e, py, run, extra = null) {
  if (!e || e.dead || e === b.exploder || isFrozen(e) || !blastNear(b, e.x, py, e.z)) return null;
  return { key: e, pos: [e.x, walkY(e), e.z], run, ...extra };
}
const rowsOf = (list, b, py, run) => { const out = []; for (const e of [...(list ?? [])]) { const r = blastRow(b, e, py(e), () => run(e)); if (r) out.push(r); } return out; };
/** Runs rows in the world's list order (players first in their cell: they joined before every entity). */
export function runBlastRows(rows) {
  for (const r of orderTargets(rows.filter(Boolean), rows, (t) => !!t.first)) r.run();
}

/** One large or small fireball or wither skull (a Fireballs system: `list`, `boxOf`, `hitBall`). `placer`: getExplosivePlacedBy ("player", a mob, or null). */
function fireballHit(system, ball, b) {
  if (ball.dead) return;
  const hit = explosionImpact(b.world, b.x, b.y, b.z, b.size, ball.x, ball.y, ball.z, ball.y, system.boxOf(ball)); // EntityFireball: yOffset 0, eye height 0
  if (!hit) return;
  if (ball.large) {
    ball.velocityChanged = true; // ze.a: setBeenAttacked (the tracker sends S12)
    if (b.placer) system.hitBall(ball, b.placer);
  }
  add(ball, hit.push);
}
export const fireballRows = (system, b) => rowsOf(system?.list, b, (e) => e.y, (e) => fireballHit(system, e, b));
/** One firework rocket (FireworkRockets.rockets records: motion mx/my/mz, `box`). */
function rocketHit(r, b) {
  if (r.dead || !r.box) return;
  const hit = explosionImpact(b.world, b.x, b.y, b.z, b.size, r.x, r.y, r.z, r.y, r.box);
  if (!hit) return;
  r.velocityChanged = true;
  add(r, hit.push, ["mx", "my", "mz"]);
}
export const rocketRows = (list, b) => rowsOf(list, b, (e) => e.y, (e) => rocketHit(e, b));
/** One eye of ender (EyesOfEnder.eyes records: posY y, no box field). */
function eyeHit(e, b) {
  if (e.dead) return;
  const box = [e.x - EYE_HALF, e.y, e.z - EYE_HALF, e.x + EYE_HALF, e.y + EYE_SIZE, e.z + EYE_HALF];
  const hit = explosionImpact(b.world, b.x, b.y, b.z, b.size, e.x, e.y, e.z, e.y, box);
  if (!hit) return;
  e.velocityChanged = true;
  add(e, hit.push);
}
export const eyeRows = (list, b) => rowsOf(list, b, (e) => e.y, (e) => eyeHit(e, b));
/** One fishing hook (FishHook: posY y, `bb`). */
function hookHit(h, b) {
  if (h.dead || !h.bb) return;
  const hit = explosionImpact(b.world, b.x, b.y, b.z, b.size, h.x, h.y, h.z, h.y, h.bb);
  if (!hit) return;
  h.velocityChanged = true;
  add(h, hit.push);
}
export const hookRows = (list, b) => rowsOf(list, b, (e) => e.y, (e) => hookHit(e, b));
/**
 * Leash knots (`mobs.knotList`, killed through `mobs.knotAttack`). The knot's posX/Y/Z is the fence cell plus 0.5 (su(ahb, int, int, int)); a summoned knot keeps its own
 * position (horse-gear-live.js, piston-push.js). Only the query box and the distance gate it: the damage is at least 1 and any hit breaks a hanging entity.
 */
const knotCentre = (k) => (k.summoned ? { x: k.px, y: k.py, z: k.pz } : { x: k.x + 0.5, y: k.y + 0.5, z: k.z + 0.5 });
function knotHit(mobs, k, b) {
  if (k.dead) return;
  const { x, y, z, size } = b, c = knotCentre(k);
  const r = Math.fround(size) * 2, cube = [x - r - 1, y - r - 1, z - r - 1, x + r + 1, y + r + 1, z + r + 1];
  const bb = [c.x - 0.25, c.y, c.z - 0.25, c.x + 0.25, c.y + 0.5, c.z + 0.25];
  if (!(bb[3] > cube[0] && bb[0] < cube[3] && bb[4] > cube[1] && bb[1] < cube[4] && bb[5] > cube[2] && bb[2] < cube[5])) return;
  const dist = Math.fround(Math.sqrt((c.x - x) ** 2 + (c.y - y) ** 2 + (c.z - z) ** 2));
  if (!(dist / r <= 1) || dist === 0) return;
  mobs.knotAttack(k);
}
export function knotRows(mobs, b) {
  if (!mobs?.knotList?.length || !mobs.knotAttack) return [];
  const out = [];
  for (const k of [...mobs.knotList]) {
    const c = knotCentre(k);
    if (k.dead || k === b.exploder || isFrozen(k) || !blastNear(b, c.x, c.y, c.z)) continue;
    out.push({ key: k, pos: [c.x, walkY(k), c.z], run: () => knotHit(mobs, k, b) });
  }
  return out;
}

// The b82 entry points, one kind at a time (each in its own list order).
const bl = (world, x, y, z, size, exploder, placer = null) => ({ world, x, y, z, size, exploder, placer });
const runEach = (rows) => { for (const r of rows) r.run(); };
export function explodeFireballs(system, world, x, y, z, size, exploder = null, placer = null) { runEach(fireballRows(system, bl(world, x, y, z, size, exploder, placer))); }
export function explodeRockets(list, world, x, y, z, size, exploder = null) { runEach(rocketRows(list, bl(world, x, y, z, size, exploder))); }
export function explodeEyes(list, world, x, y, z, size, exploder = null) { runEach(eyeRows(list, bl(world, x, y, z, size, exploder))); }
export function explodeHooks(list, world, x, y, z, size, exploder = null) { runEach(hookRows(list, bl(world, x, y, z, size, exploder))); }
export function explodeKnots(mobs, x, y, z, size, exploder = null) { runEach(knotRows(mobs, bl(null, x, y, z, size, exploder))); }
