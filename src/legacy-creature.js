// Batch 38: the legacy EntityCreature.updateEntityActionState (td.bq) for the spider (yn), the cave spider (xy) and the zombie pigman (yh),
// with their findPlayerToAttack and attackEntity overrides, on Entity.rand in the native draw order (the flow itself is creatureActionState in
// silverfish.js, proven for the giant and the silverfish). Evidence: village-fight-b38-reference.json (native yn/xy/yh run by VillageFightProbe).
// Bytecode-read: EntitySpider.bR/a(sa,F)/h, EntityMob.bR/a(sa,F)/e, EntityPigZombie.bR/c/h.
import { creatureActionState, pathWeight } from "./silverfish.js";
import { isSpider } from "./spider.js";

const f = Math.fround;
export const isLegacyCreature = (e) => isSpider(e.type) || e.type === "pigman";
const LEAP = 0.800000011920929, KEEP = 0.20000000298023224, UP = 0.4000000059604645;

// EntitySpider.attackEntity (yn.a(sa, F)): in light above 0.5 a 1 in 100 roll forgets the target; 2 < distance < 6 rolls a 1 in 10 leap (only
// from the ground, the roll is spent either way); otherwise EntityMob's melee. Returns true when the melee hit is due.
function spiderAttackEntity(e, st, target, d, light, rand, height) {
  if (light > 0.5 && rand.nextInt(100) === 0) { st.target = null; return false; }
  if (d > 2 && d < 6 && rand.nextInt(10) === 0) {
    if (e.onGround) {
      const dx = target.x - e.x, dz = target.z - e.z, len = f(Math.sqrt(dx * dx + dz * dz));
      e.vx = dx / len * 0.5 * LEAP + e.vx * KEEP;
      e.vz = dz / len * 0.5 * LEAP + e.vz * KEEP;
      e.vy = UP;
    }
    return false;
  }
  return mobAttackEntity(e, st, target, d, height);
}
// EntityMob.attackEntity (yg.a(sa, F)): attackTime <= 0, distance < 2.0 and the boxes overlap vertically.
function mobAttackEntity(e, st, target, d, height) {
  if (st.attackTime <= 0 && d < 2 && target.y + (target.height ?? 1.8) > e.y && target.y < e.y + height) {
    st.attackTime = 20;
    return true;
  }
  return false;
}

// One update of the action state. `ew` is the EntityWorld, `e` the mob. The returned flag is not used; the state lives in
// ew.silverfishState(e) (target, path, entityAge, attackTime) and the results go to e (rotation, moveForward, jumping, idle).
// `hooks` (optional, for other EntityMob subclasses on this flow, e.g. the enderman): { findPlayerToAttack(me) } replaces the spider/pigman/EntityMob search.
export function legacyThink(ew, e, t, aiMoveSpeed, entityRandom, hooks = null) {
  const m = ew.ai.brain(e), p = ew.ai.player, s = ew.ai.survival, st = ew.silverfishState(e), spider = isSpider(e.type), pigman = e.type === "pigman";
  st.x = e.x; st.y = e.y; st.z = e.z; st.width = t.width; st.inWater = e.inWater; st.inLava = e.inLava;
  st.collidedH = e.collidedH; st.rotationYaw = e.rotationYaw; st.rotationPitch = e.rotationPitch || 0;
  if (pigman) e.pigTarget = !!st.target; // yh.h: the speed boost modifier follows the target at the start of the update
  st.speed = aiMoveSpeed(e, 1); // isJumping (bc) is not reset here: td.bq clears it only on its path-following branch, so a jump asked for while airborne is taken on landing (b39 pillar records)
  st.entityAge = e.idle || 0; // the port's idle counter is EntityLiving.entityAge (a hit resets it)
  st.moveForward = f(f(st.moveForward || 0) * f(0.98)); // the previous tick's x 0.98 decay carries over when the action state leaves it unset
  if (st.attackTime > 0) st.attackTime--;
  const bx = Math.floor(e.x), by = Math.floor(e.y + f(t.height * 0.66)), bz = Math.floor(e.z);
  const light = f(ew.ai.brightness(bx, by, bz));
  if (light > 0.5) st.entityAge += 2; // EntityMob.onLivingUpdate
  m.senseCache.clear();
  const world = ew.world, rand = entityRandom(e), path = (make) => (m.navigator.spend() ? make(m.navigator.finder()) : null);
  const env = {
    rand, remote: false,
    closestPlayer: (me, range) => (p?.alive && (range < 0 || m.distSq(p) < range * range) ? p : null),
    // EntitySpider.bR: only in light below 0.5, no sight test. EntityPigZombie.bR: nothing while calm. EntityMob.bR: a visible player.
    findPlayerToAttack: (me) => {
      if (hooks?.findPlayerToAttack) return hooks.findPlayerToAttack(me);
      if (spider) return light < 0.5 ? ew.ai.closestVulnerablePlayer(me, 16) : null;
      if (pigman && !((e.angerLevel | 0) > 0)) return null;
      const c = ew.ai.closestVulnerablePlayer(me, 16);
      return c && m.canSee(c) ? c : null;
    },
    isAlive: (x) => (x === p ? !!p.alive : x.alive !== false),
    isCreative: (x) => x === p && !!s.creative,
    eyeHeight: (x) => (x === st ? f(f(t.height) * f(0.85)) : x === p || x.isPlayer ? f(1.62) : x.eyeHeight),
    boxMidY: (x) => x.y,
    canSee: (me, target) => m.canSee(target),
    attackEntity: (me, target, d) => {
      const due = spider ? spiderAttackEntity(e, st, target, d, light, rand, t.height) : mobAttackEntity(e, st, target, d, t.height);
      if (!due) return;
      if (target === p) ew.hitPlayer(e, s);
      else if (target.e) ew.hitMob(e, target.e);
    },
    pathToEntity: (me, target, range) => path((fn) => fn.createEntityPathToEntity(m, target, range)),
    pathToBlock: (me, x, y, z, range) => path((fn) => fn.createEntityPathToBlock(m, x, y, z, range)),
    pathWeight: (me, x, y, z) => pathWeight(0, ew.ai.brightness(x, y, z)), // yg.a(III)F: 0.5 - getLightBrightness
    setDead: () => ew.ai.despawn(e),
  };
  creatureActionState(st, env);
  st.randomYaw = f(f(st.randomYaw || 0) * f(0.9)); // EntityLivingBase.onLivingUpdate: randomYawVelocity *= 0.9F after the action state
  e.idle = st.entityAge;
  e.rotationYaw = st.rotationYaw; e.rotationPitch = st.rotationPitch;
  e.rotationYawHead = e.rotationYaw; // EntityLiving.onLivingUpdate without AI (sw.e): updateEntityActionState, then rotationYawHead = rotationYaw
  e.moveForward = st.moveForward; e.jumping = st.jumping;
  e.yaw = (-e.rotationYaw * Math.PI) / 180;
}
