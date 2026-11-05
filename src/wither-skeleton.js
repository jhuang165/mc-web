// EntitySkeleton with skeletonType 1 (yl.cb() == 1): the wither skeleton, ported from the unchanged 1.7.10 class yl
// (bytecode-derived; see public/research/wither.md). It shares the skeleton's code through `isSkeleton`; only the pieces
// below differ: size 0.72 x 2.34 and fire immunity (yl.a(int)), a stone sword and a melee task (yl.bZ), attack damage 4.0
// (yl.a(sy), onSpawnWithEgg), the Wither effect for 200 ticks on a hit (yl.n(sa)), coal instead of arrows (yl.b(boolean,int)),
// and the rare wither skeleton skull (yl.n(int), damage 1).
import { POTION } from './potions.js';

export const WITHER_SKELETON = 'wither_skeleton';
export const isSkeleton = (type) => type === 'skeleton' || type === WITHER_SKELETON;
export const WITHER_SKELETON_STATS = Object.freeze({ health: 20, width: Math.fround(0.72), height: Math.fround(2.34), movement: 0.25, ai: { wander: 1 }, damage: 4, drop: 0, fireImmune: true });
export const WITHER_SKELETON_SCALE = 1.2; // RenderSkeleton.preRenderCallback
export const WITHER_HIT_TICKS = 200; // new PotionEffect(Potion.wither.id, 200), amplifier 0
export const STONE_SWORD = 272, COAL = 263, BONE = 352, SKULL_ITEM = 2050;
// EntitySkeleton.func_70628_a / dropFewItems for type 1: coal nextInt(3 + looting) - 1 times (none below zero), then bones
// nextInt(3 + looting); the rare drop (nextInt(200) - looting < 5 for a player kill) is the wither skeleton skull.
export function witherSkeletonDrops(rand, { looting = 0, playerHit = false } = {}) {
  const out = [], coal = rand.nextInt(3 + looting) - 1;
  for (let i = 0; i < coal; i++) out.push([COAL, 0]);
  for (let i = rand.nextInt(3 + looting); i > 0; i--) out.push([BONE, 0]);
  return out;
}
// EntityLivingBase.onDeath: `rand.nextInt(200) - looting < 5` then dropRareDrop(j <= 0 ? 0 : 1); a type 1 skeleton drops skull damage 1.
export const witherSkeletonRareDrop = (rand, looting = 0) => rand.nextInt(200) - looting < 5 ? [SKULL_ITEM, 1] : null;
// EntitySkeleton.attackEntityAsMob: after a landed hit the Wither effect (ticks, amplifier 0).
export const witherHitEffect = () => ({ id: POTION.WITHER, duration: WITHER_HIT_TICKS, amplifier: 0 });
