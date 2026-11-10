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
  pigmanProvoke(e, ew.entities.filter((o) => o.type === "pigman"), randOf, near, (o) => { ew.silverfishState(o).target = ew.ai.player; }); // c(sa): entityToAttack
  return true;
}

// yh.h (onUpdate) before EntityZombie's: the angry sound when the counter reaches 0.
export function pigmanTick(ew, e, rand) {
  const s = pigmanAngrySound(e, rand, 1);
  if (s) ew.events.push({ ...s, position: { x: e.x, y: e.y, z: e.z } });
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
