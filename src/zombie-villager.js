// EntityZombie (yq) against villagers, 1.7.10: the villager half of the zombie. Pure rules plus the one target task the
// zombie adds (EntityAINearestAttackableTarget (vo) for villagers, priority 2); the world side is in entities.js
// (hitMob, zombieKilledVillager, cure, tickConversion, cureZombie) and the task wiring in ai.js.
//
// Native facts (bytecode of yq, yv, bma; public/research/zombie-villager-reference.json replays them):
//   zombie tasks 0 swim, 1 break door (not run here), 2 attack players, 4 attack villagers (long memory), 5 move towards
//   restriction, 6 move through village (not nocturnal), 7 wander, 8 watch players, 8 look idle; targets 1 hurt by,
//   2 nearest player (sight), 2 nearest villager (no sight).
//   onKillEntity (yq.a(sv)): Normal 50 %, Hard always; Easy/Peaceful never. The villager becomes a zombie villager.
//   interact (yq.a(yz)): golden apple, damage 0, zombie is a villager and has Weakness: the stack shrinks (not in
//   Creative) and startConversion(nextInt(2401) + 3600). onUpdate counts conversionTime down by getConversionTimeBoost.
import { NORMAL, HARD } from "./difficulty.js";
import { IRON_BARS } from "./world.js";

export const GOLDEN_APPLE = 372; // this build's id for the plain golden apple (1.7.10 item 322, damage 0)
export const WEAKNESS = 18, STRENGTH = 5, NAUSEA = 9; // Potion ids (rv.t, rv.g, rv.k)
export const CONVERSION_MIN = 3600, CONVERSION_SPREAD = 2401;
export const CURE_NAUSEA_TICKS = 200;
export const AUX_INFECT = 1016, AUX_CURE = 1017; // World.playAuxSFXAtEntity events; sounds mob.zombie.infect / unfect
export const SOUNDS = Object.freeze({ infect: "mob.zombie.infect", unfect: "mob.zombie.unfect", remedy: "mob.zombie.remedy" });
// getConversionTimeBoost counts iron bars (ajn.aY) and beds (ajn.C). This build has no bed block, so only bars count.
export const BOOST_BLOCKS = new Set([IRON_BARS]);

// yq.a(sv) (onKillEntity): the roll that decides whether a villager killed by a zombie converts. Normal draws
// Entity.rand.nextBoolean() of the killing zombie (true = no conversion); Hard converts without a draw.
export function killConverts(difficulty, rand) {
  if (difficulty !== NORMAL && difficulty !== HARD) return false;
  if (difficulty !== HARD && rand.nextBoolean()) return false;
  return true;
}

// yq.a(yz) (interact) conversion timer: Entity.rand.nextInt(2401) + 3600.
export const startConversionTicks = (rand) => rand.nextInt(CONVERSION_SPREAD) + CONVERSION_MIN;

// yq.ce (getConversionTimeBoost): 1, plus (once a nextFloat < 0.01) every iron bars or bed block found in
// x-4..x+3, y-4..y+3, z-4..z+3 (truncated position, x outermost) adds 1 with probability 0.3, stopping after 14 found.
export function conversionBoost(rand, blockAt, x, y, z, blocks = BOOST_BLOCKS) {
  let boost = 1;
  if (rand.nextFloat() < Math.fround(0.01)) {
    let found = 0;
    const ix = Math.trunc(x), iy = Math.trunc(y), iz = Math.trunc(z);
    for (let a = ix - 4; a < ix + 4 && found < 14; a++)
      for (let b = iy - 4; b < iy + 4 && found < 14; b++)
        for (let c = iz - 4; c < iz + 4 && found < 14; c++)
          if (blocks.has(blockAt(a, b, c))) {
            if (rand.nextFloat() < Math.fround(0.3)) boost++;
            found++;
          }
  }
  return boost;
}

// The condition of yq.a(yz) before the item is used: golden apple of damage 0, a villager zombie, Weakness active.
export const canCure = (zombie, id, damage = 0) =>
  zombie?.type === "zombie" && zombie.villager === true && zombie.health > 0 && zombie.conversionTime === undefined && id === GOLDEN_APPLE && !damage && !!zombie.effects?.some((x) => x.id === WEAKNESS);
export const isConverting = (e) => e?.type === "zombie" && Number.isInteger(e.conversionTime);

// NBT: IsVillager, ConversionTime (-1 = none; the field is only read when above -1), IsBaby. Returns the record fields.
export function readZombieVillager(saved) {
  const out = { villager: saved?.villager === true };
  if (Number.isInteger(saved?.conversionTime) && saved.conversionTime > -1) out.conversionTime = saved.conversionTime;
  return out;
}

// yq.a(int) (startConversion): the countdown starts, Weakness goes, Strength lasts the countdown (amplifier
// Math.min(difficulty - 1, 0) = 0), and entity state 16 plays mob.zombie.remedy. `addEffect` is mob-effects' addMobEffect.
export function startConversion(e, ticks, addEffect) {
  e.conversionTime = ticks;
  e.effects = (e.effects ?? []).filter((x) => x.id !== WEAKNESS);
  addEffect(e, STRENGTH, ticks, 0);
}
// yq.a(byte 16): mob.zombie.remedy at the entity + (0.5, 0.5, 0.5), volume 1 + nextFloat, pitch nextFloat * 0.7 + 0.3.
export const remedySound = (rand, e) => ({ sound: SOUNDS.remedy, volume: Math.fround(1 + rand.nextFloat()), pitch: Math.fround(Math.fround(rand.nextFloat() * Math.fround(0.7)) + Math.fround(0.3)), position: { x: e.x + 0.5, y: e.y + 0.5, z: e.z + 0.5 } });
// RenderGlobal.playAuxSFX 1016 / 1017: infect or unfect at the block centre, volume 2, pitch (r - r) * 0.2 + 1.
export const auxSound = (event, rand, e) => ({ sound: event === AUX_INFECT ? SOUNDS.infect : SOUNDS.unfect, volume: 2, pitch: Math.fround(Math.fround(Math.fround(rand.nextFloat() - rand.nextFloat()) * Math.fround(0.2)) + 1), position: { x: Math.trunc(e.x) + 0.5, y: Math.trunc(e.y) + 0.5, z: Math.trunc(e.z) + 0.5 } });

// EntityAINearestAttackableTarget (vo) for villagers, targetChance 0 (no draw), sight not required: the nearest living
// villager in the follow-range box (grown by 4 vertically) that is inside the home area. `K` is { TargetBase } from ai.js.
export function zombieVillagerTargets(K) {
  class NearestVillager extends K.TargetBase {
    constructor(m) {
      super(m, false);
      this.target = null;
    }
    shouldExecute() {
      const m = this.m, d = this.range();
      let best = null, bd = Infinity;
      for (const o of m.nearby(d, 4, d, (b) => b.e.type === "villager" && b.alive)) {
        const s = m.distSq(o);
        if (s < bd && this.isSuitableTarget(o)) { best = o; bd = s; }
      }
      this.target = best;
      return !!best;
    }
    startExecuting() {
      this.m.attackTarget = this.target;
      super.startExecuting();
    }
  }
  return { NearestVillager };
}
