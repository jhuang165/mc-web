// b87 boatcheck87: the entities ItemBoat.onItemRightClick (abj.a) tests, per kind, as `{ bb, collide, border, listed }` rows for Boats.place (boats.js).
//
// Bytecode-read (javap -c -p, unchanged 1.7.10 jar) and executed (tools/probes/BoatEntityProbe.java, public/research/boat-entity-reference.json):
//   - The sight test lists World.getEntitiesWithinAABBExcludingEntity(player, boundingBox.addCoord(look * 5).expand(1, 1, 1)) and refuses on any entity with
//     canBeCollidedWith (sa.R) whose box grown by getCollisionBorderSize (sa.af) holds the trace start (azt.a(azw), strict). The box test is
//     getCollidingBoundingBoxes(boat, boat box - 0.1): every entity listed in that box grown by 0.25 adds getBoundingBox (J) and EntityBoat.getCollisionBox (xi.h),
//     which returns the other entity's box. So EVERY entity whose box meets the shrunk boat box refuses, whatever its kind (the player's own box too).
//   - canBeCollidedWith: EntityLivingBase (sv), EntityBoat (xi), EntityMinecart (xl), EntityFallingBlock (xj), EntityTNTPrimed (xw) `!isDead`; EntityHanging (ss: paintings,
//     item frames, leash knots), EntityDragonPart (wy), EntityEnderCrystal (wz) and EntityFireball (ze, so the large fireball zg) true; EntityDragon (xa), EntitySmallFireball (zi)
//     and EntityWitherSkull (zp) false; items (xk), orbs (sq), arrows (zc), throwables (zk), eyes (zd), rockets (zf) and hooks (xe) keep Entity's false.
//   - getCollisionBorderSize: 0.1, EntityFireball 1.0 (zi and zp inherit 1.0 but are not collidable).
//   - Boxes (executed, setPosition at posY = bottom + yOffset): item 0.25 (yOffset 0.125), orb 0.5 (0.25), arrow 0.5, throwable / eye / hook / rocket 0.25, large fireball 1.0,
//     small fireball / skull 0.3125 (all yOffset 0), falling block and primed TNT 0.98 (0.49), ender crystal 2.0 with yOffset 1 (box [posY - 1, posY + 1]), leash knot the 0.5
//     cube from the fence cell + 0.5, boat 1.5 x 0.6, minecart 0.98 x 0.7.
//   - Living entities stay (isDead false) through the 20-tick death animation; the dragon's parts are listed only while its body is (apx.a: dragon-parts.js reachesDragon).
// Port y conventions (port-read): item, orb, falling block and primed TNT records hold the box bottom (y), arrows, balls, eyes and hooks posY (= bottom), crystals posY.
import { isFrozen } from "./saved-order.js";
import { isDragon, dragonBox, reachesDragon } from "./dragon-parts.js";
import { FALLING_SIZE } from "./falling.js";
import { TNT_SIZE } from "./explosion.js";
import { crystalBox } from './ender-crystal.js'; // b88 boatray88: the one definition (ender-crystal.js)

const f = Math.fround;
export const BOAT_ENTITY_SIZES = { item: 0.25, orb: 0.5, arrow: 0.5, ball: 0.25, eye: 0.25, hook: 0.25, rocket: 0.25, fireball: 1, smallFireball: 0.3125, witherSkull: 0.3125, falling: f(FALLING_SIZE), tnt: TNT_SIZE, crystal: 2, knot: 0.5 };
// A `size` cube whose bottom is `y`.
export const boxFrom = (x, y, z, s) => [x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2];
// EntityEnderCrystal: posY is the box centre (wz.<init> yOffset = 1).
export { crystalBox };
const gone = (e) => !e || e.dead || isFrozen(e);
// b88 boatray88: a dead server player (`dead`, `deathTime` from server-survival.js) is still in the chunk lists through the tick its deathTime reaches 20. Bytecode-read:
// sv.aF (onDeathUpdate) does ++deathTime and calls setDead (sa.B: isDead = true) at 20; EntityPlayerMP runs it only from processPlayer (nh.a(jd) -> mw.i -> yz.h; mw.h never
// calls aF, and neither yz nor mw overrides it), i.e. in the network tick. The chunk query (apx.a(sa, azt, List, sj)) has no isDead test, and only World.updateEntities
// (ahb.h, "remove" section: if isDead -> apx.b(sa), list.remove, onEntityRemoved) takes it out, in the next tick's world pass, before that tick's packets. A respawn replaces it.
export const playerListed = (q) => !q?.dead || (q.deathTime ?? 0) <= 20;
const livingPresent = (e) => e.health > 0 || (e.death ?? 0) < 20;
const knotBox = (k) => { const c = k.summoned ? { x: k.px, y: k.py, z: k.pz } : { x: k.x + 0.5, y: k.y + 0.5, z: k.z + 0.5 }; return [c.x - 0.25, c.y, c.z - 0.25, c.x + 0.25, c.y + 0.5, c.z + 0.25]; };

// The rows of one mob list (`mobs.entities`, `mobs.size(e)`): living mobs and crystals collide; the dragon body does not and its parts do, both gated by the body's listing.
export function mobRows(mobs, out = []) {
  for (const e of mobs?.entities ?? []) {
    if (gone(e) || !livingPresent(e)) continue;
    if (e.type === "ender_crystal") { out.push({ bb: crystalBox(e.x, e.y, e.z), collide: true, ref: e }); continue; }
    if (isDragon(e)) {
      const listed = (area) => reachesDragon(e, area);
      out.push({ bb: dragonBox(e), collide: false, listed, ref: e });
      for (const p of e.dragon.parts) if (p.box) out.push({ bb: p.box, collide: true, listed, ref: e });
      continue;
    }
    const [w, h] = mobs.size(e);
    out.push({ bb: [e.x - w / 2, e.y, e.z - w / 2, e.x + w / 2, e.y + h, e.z + w / 2], collide: true, ref: e });
  }
  for (const k of mobs?.knotList ?? []) if (!gone(k)) out.push({ bb: knotBox(k), collide: true, ref: k });
  return out;
}

/**
 * Every entity of one world as boat-check rows. Each argument is optional:
 * `players` boxes (or { bb }) of the other players; `mobs` a Mobs system (entities, size, knotList, _fireballs, _skulls, potions, _golemBalls); `items`, `orbs`, `arrows`,
 * `falling`, `primed`, `eyes`, `hooks`, `rockets` record arrays; `balls` an array of thrown-ball arrays; `fireballs` Fireballs systems (list, boxOf, large);
 * `vehicles` boat / cart arrays; `hanging` an array of hanging entities (bb).
 */
export function boatPlaceEntities({ players = [], mobs = null, items = [], orbs = [], arrows = [], balls = [], fireballs = [], falling = [], primed = [], eyes = [], hooks = [], rockets = [], vehicles = [], hanging = [] } = {}) {
  const out = [], S = BOAT_ENTITY_SIZES;
  for (const p of players) if (p) out.push({ bb: p.bb ?? p, collide: true });
  mobRows(mobs, out);
  for (const list of vehicles) for (const c of list ?? []) if (!gone(c) && c.bb) out.push({ bb: c.bb, collide: true, ref: c });
  for (const e of hanging) if (!gone(e) && e.bb) out.push({ bb: e.bb, collide: true, ref: e });
  for (const e of falling) if (!gone(e)) out.push({ bb: boxFrom(e.x, e.y, e.z, S.falling), collide: true, ref: e });
  for (const t of primed) if (!gone(t)) out.push({ bb: boxFrom(t.x, t.y, t.z, S.tnt), collide: true, ref: t });
  for (const e of items) if (!gone(e)) out.push({ bb: boxFrom(e.x, e.y, e.z, S.item), collide: false, ref: e });
  for (const o of orbs) if (!gone(o)) out.push({ bb: o.bb ?? boxFrom(o.x, o.y, o.z, S.orb), collide: false, ref: o });
  for (const a of arrows) if (!gone(a)) out.push({ bb: boxFrom(a.x, a.y, a.z, S.arrow), collide: false, ref: a });
  for (const list of balls) for (const b of list ?? []) if (!gone(b)) out.push({ bb: boxFrom(b.x, b.y, b.z, S.ball), collide: false, ref: b });
  for (const sys of fireballs) for (const b of sys?.list ?? []) if (!gone(b)) out.push({ bb: sys.boxOf(b), collide: !!b.large, border: 1, ref: b });
  for (const r of rockets) if (!gone(r)) out.push({ bb: r.box ?? boxFrom(r.x, r.y, r.z, S.rocket), collide: false, ref: r });
  for (const e of eyes) if (!gone(e)) out.push({ bb: boxFrom(e.x, e.y, e.z, S.eye), collide: false, ref: e });
  for (const h of hooks) if (!gone(h)) out.push({ bb: h.bb ?? boxFrom(h.x, h.y, h.z, S.hook), collide: false, ref: h });
  return out;
}

// The thrown-ball lists of a Mobs system (witch potions, snow golem snowballs) for `balls`.
export const mobBallLists = (mobs) => [mobs?.potions?.projectiles?.balls ?? mobs?.potions?.balls, mobs?._golemBalls?.projectiles?.balls ?? mobs?._golemBalls?.balls];
