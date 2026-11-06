// Mob footsteps: the tail of Entity.moveEntity (distanceWalkedOnStepModified / nextStepDistance) and the
// per-class func_145780_a overrides. Notes and limits in public/research/mob-steps.md.
//
// moveEntity: while canTriggerWalking and not riding, distanceWalkedOnStepModified grows by
// sqrt(dx^2 + dy^2 + dz^2) * 0.6 (float32; dy counts only on a ladder). When it passes nextStepDistance
// (starts at 1) and the cell at floor(y - 0.2 - yOffset) is not air, nextStepDistance becomes
// (int)distance + 1 and the entity plays either its swim sound (in water) or func_145780_a.
//   Zombie (and pig zombie)    mob.zombie.step     0.15  1.0
//   Skeleton                   mob.skeleton.step   0.15  1.0
//   Spider (and cave spider)   mob.spider.step     0.15  1.0
//   Pig / Cow / Sheep / Chicken mob.<name>.step    0.15  1.0
//   Iron golem                 mob.irongolem.walk  1.0   1.0
//   Silverfish                 canTriggerWalking() is false: silent
//   Horse                      mob.horse.soft / wood / gallop (horseStep)
//   Creeper, villager, witch   no override: Entity.func_145780_a, the block's SoundType (block-sounds.js)
import { footstepSound } from "./block-sounds.js";
import { countsVertical } from "./ladders.js";

const f = Math.fround;
const own = (name, volume) => ({ name, volume: f(volume), pitch: 1 });
export const MOB_STEP_SOUNDS = {
  zombie: own("mob.zombie.step", 0.15),
  pigman: own("mob.zombie.step", 0.15), // EntityPigZombie extends EntityZombie
  skeleton: own("mob.skeleton.step", 0.15),
  wither_skeleton: own("mob.skeleton.step", 0.15), // EntitySkeleton type 1
  spider: own("mob.spider.step", 0.15),
  cave_spider: own("mob.spider.step", 0.15),
  pig: own("mob.pig.step", 0.15),
  cow: own("mob.cow.step", 0.15),
  mooshroom: own("mob.cow.step", 0.15),
  sheep: own("mob.sheep.step", 0.15),
  chicken: own("mob.chicken.step", 0.15),
  wolf: own("mob.wolf.step", 0.15),
  iron_golem: own("mob.irongolem.walk", 1),
};
// EntityMob subclasses (sa.H swim sound "game.hostile.swim", EntityLivingBase.func_146067_o "game.hostile.hurt.fall.*").
// Slime, magma cube, ghast, golems and animals are not EntityMobs, whatever their sound category.
const ENTITY_MOBS = new Set(["zombie", "pigman", "skeleton", "wither_skeleton", "spider", "cave_spider", "creeper", "enderman", "silverfish", "witch", "blaze", "wither"]);
export const isEntityMob = (type) => ENTITY_MOBS.has(type);
// Entity.canTriggerWalking: only the silverfish turns it off among the mobs here.
export const canTriggerWalking = (type) => type !== "silverfish" && type !== "squid" && type !== "bat" && type !== "ender_crystal"; // EntitySquid/EntityBat (squid-bat.js) override it to false

// EntityHorse.func_145780_a: the block's SoundType (the snow type under a snow layer, nothing over liquids) picks the clip.
// A ridden horse, zombie horse or skeleton horse (types 0, 3, 4; not donkey or mule) counts its steps in `gallopSteps`
// (field_110285_bP, not saved): steps 1-5 play mob.horse.wood, then every third step (6, 9, ...) mob.horse.gallop and the
// others stay silent. Otherwise a wood block gives mob.horse.wood and everything else mob.horse.soft. Volume and pitch are
// the SoundType's (volume x 0.15, frequency).
function horseStep(e, block, above) {
  // EntityHorse checks the stepped block's own material for liquid (Entity's version tests the snow layer instead).
  if (!footstepSound(block, 0)) return null;
  const s = footstepSound(block, above);
  const clip = (name) => ({ name, volume: s.volume, pitch: s.pitch });
  const type = e.horse?.type ?? 0;
  if (e.rider && type !== 1 && type !== 2) {
    e.gallopSteps = (e.gallopSteps || 0) + 1;
    if (e.gallopSteps > 5 && e.gallopSteps % 3 === 0) return clip("mob.horse.gallop");
    return e.gallopSteps <= 5 ? clip("mob.horse.wood") : null;
  }
  return clip(s.name === "step.wood" ? "mob.horse.wood" : "mob.horse.soft");
}

// The sound of one step of `type` on the block `block` (internal id) with `above` in the cell over it, or null. `e` is
// the entity (the horse needs its type, rider and step counter).
export function mobStepSound(type, block, above = 0, e = {}) {
  if (type === "horse") return horseStep(e, block, above);
  return MOB_STEP_SOUNDS[type] ?? footstepSound(block, above);
}

// Advances `e.stepDistance` / `e.nextStep` for a move from `from` ({x, y, z}) to the entity's position and returns the
// sound events it makes (zero or one). `hostile` picks game.hostile.swim over game.neutral.swim; `random` is the entity's
// Random (drawn twice, only for the swim sound). `e.inWater` is the entity's own flag.
export function mobStepEvents(world, e, from, { hostile = false, random } = {}) {
  if (!canTriggerWalking(e.type) || e.riding) return [];
  const dx = e.x - from.x, dz = e.z - from.z;
  const dy = countsVertical(world, e.x, e.y, e.z) ? e.y - from.y : 0;
  e.stepDistance = f((e.stepDistance || 0) + f(Math.sqrt(dx * dx + dy * dy + dz * dz) * 0.6));
  const x = Math.floor(e.x), y = Math.floor(e.y - 0.2), z = Math.floor(e.z), block = world.get(x, y, z);
  if (!(e.stepDistance > (e.nextStep ?? 1)) || !block) return [];
  e.nextStep = Math.floor(e.stepDistance) + 1;
  const position = { x: e.x, y: e.y, z: e.z }, events = [];
  // Entity.moveEntity plays the swim sound when isInWater() and then func_145780_a regardless (the step is silent over liquids).
  if (e.inWater) {
    const volume = Math.min(1, f(Math.sqrt(f(f(f(e.vx * e.vx) * 0.2) + f(e.vy * e.vy) + f(f(e.vz * e.vz) * 0.2))) * f(0.35)));
    const pitch = f(1 + f(f(random() - random()) * 0.4));
    events.push({ sound: hostile ? "game.hostile.swim" : "game.neutral.swim", volume, pitch, position });
  }
  const s = mobStepSound(e.type, block, world.get(x, y + 1, z), e);
  if (s) events.push({ sound: s.name, volume: s.volume, pitch: s.pitch, position });
  return events;
}
