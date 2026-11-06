// Live-world glue for the zombie pigman and the magma cube (rules: nether-melee.js; evidence: magma-pigman-reference.json). entities.js
// calls these from small hooks, in the manner of enderman-live.js.
import { PIGMAN, pigmanProvoke, pigmanAngrySound, pigmanEquipment, pigStruck } from "./nether-melee.js";
import { JavaRandom } from "./java-random.js";

const YAWS = ["rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw"];
// The saved fields of one pigman: Anger (short) and the held sword; the target, attack timer and sound delay start over.
export const pigmanFields = () => ({ angerLevel: 0, randomSoundDelay: 0, pigTarget: false, attackTime: 0, held: null });
export const pigmanFieldsFrom = (e) => ({
  angerLevel: Number.isInteger(e.angerLevel) ? Math.max(-32768, Math.min(32767, e.angerLevel)) : 0, randomSoundDelay: 0, pigTarget: false, attackTime: 0,
  held: e.held && Number.isInteger(e.held.id) ? { id: e.held.id, damage: e.held.damage | 0, count: 1 } : null,
});

// yh.a(ro, F) with a player source (after the invulnerability check): every pigman inside the 32 block box around this one is angered,
// then this one, each on its own Entity.rand.
export function pigmanHurt(ew, e, source, randOf) {
  if (!source.player || e.health <= 0) return false;
  const r = PIGMAN.angerRange, t = { w: PIGMAN.width / 2, h: PIGMAN.height };
  const near = (o) => o.health > 0 && o.x - t.w < e.x + t.w + r && o.x + t.w > e.x - t.w - r && o.z - t.w < e.z + t.w + r && o.z + t.w > e.z - t.w - r && o.y < e.y + t.h + r && o.y + t.h > e.y - r;
  pigmanProvoke(e, ew.entities.filter((o) => o.type === "pigman"), randOf, near);
  return true;
}

// yh.h (onUpdate) before EntityZombie's: the angry sound when the counter reaches 0.
export function pigmanTick(ew, e, rand) {
  const s = pigmanAngrySound(e, rand, 1);
  if (s) ew.events.push({ ...s, position: { x: e.x, y: e.y, z: e.z } });
}

// yh.bk is false: the pigman keeps EntityCreature's legacy flow like the spider (spiderThink). The path refresh and the idle wander
// are adapted (every 10 ticks, a random 6 block target every 80), and the attack is EntityMob.attackEntity: attackTime 20 within 2.0
// blocks when the boxes overlap vertically.
export function pigmanThink(ew, e) {
  const m = ew.ai.brain(e), p = ew.ai.player, s = ew.ai.survival;
  m.despawnEntity();
  m.senseCache.clear();
  if (e.attackTime > 0) e.attackTime--;
  const angry = (e.angerLevel | 0) > 0, distance = p ? Math.sqrt(m.distSq(p)) : Infinity;
  if (!p?.alive || s.creative || !angry) {
    if (e.pigTarget) m.navigator.clearPathEntity();
    e.pigTarget = false;
  } else if (!e.pigTarget && ew.ai.closestVulnerablePlayer(e, 16) && m.canSee(p)) e.pigTarget = true; // yh.bR: super.bR once angry
  if (e.pigTarget) {
    m.attackTarget = p;
    if (e.attackTime <= 0 && distance < 2 && p.y + (p.height ?? 1.8) > e.y && p.y < e.y + PIGMAN.height && m.canSee(p)) {
      e.attackTime = 20;
      ew.hitPlayer(e, s);
    }
    if (e.age % 10 === 0 || m.navigator.noPath()) m.navigator.tryMoveToEntityLiving(p, 1);
    m.lookHelper.setLookPositionWithEntity(p, 30, 30);
  } else {
    m.attackTarget = null;
    if (e.age % 80 === 0) {
      const a = ew.random() * Math.PI * 2;
      m.navigator.tryMoveToXYZ(e.x + Math.sin(a) * 6, e.y, e.z + Math.cos(a) * 6, 1);
    }
  }
  m.navigator.onUpdateNavigation();
  m.moveHelper.onUpdateMoveHelper();
  m.lookHelper.onUpdateLook();
  m.jumpHelper.doJump();
  e.yaw = -e.rotationYaw * Math.PI / 180;
}

// EntityPig.onStruckByLightning (wo.a(xh)): the pig becomes a pigman with a golden sword at its position and rotation; no damage or fire.
export function pigStrike(ew, pig) {
  const at = pigStruck(pig), made = ew.create("pigman", at.x, at.y, at.z);
  made.held = pigmanEquipment();
  made.angerLevel = 0;
  made.growingAge = 0;
  for (const k of YAWS) made[k] = at.rotationYaw;
  made.rotationPitch = at.rotationPitch;
  made.yaw = pig.yaw ?? 0;
  const i = ew.entities.indexOf(pig);
  if (i >= 0) ew.entities.splice(i, 1);
  ew.entities.push(made);
  return made;
}
export const pigmanRandom = (seed) => new JavaRandom(BigInt.asIntN(64, BigInt(seed) * 2654435761n + 7n));
