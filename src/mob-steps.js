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
//   Creeper, villager, witch   no override: Entity.func_145780_a, the block's SoundType (block-sounds.js)
import { footstepSound } from "./block-sounds.js";
import { countsVertical } from "./ladders.js";

const f = Math.fround;
const own = (name, volume) => ({ name, volume: f(volume), pitch: 1 });
export const MOB_STEP_SOUNDS = {
  zombie: own("mob.zombie.step", 0.15),
  skeleton: own("mob.skeleton.step", 0.15),
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
// Entity.canTriggerWalking: only the silverfish turns it off among the mobs here.
export const canTriggerWalking = (type) => type !== "silverfish" && type !== "squid" && type !== "bat" && type !== "ender_crystal"; // EntitySquid/EntityBat (squid-bat.js) override it to false

// The sound of one step of `type` on the block `block` (internal id) with `above` in the cell over it, or null.
export function mobStepSound(type, block, above = 0) {
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
  const position = { x: e.x, y: e.y, z: e.z };
  if (e.inWater) {
    const volume = Math.min(1, f(Math.sqrt(f(f(f(e.vx * e.vx) * 0.2) + f(e.vy * e.vy) + f(f(e.vz * e.vz) * 0.2))) * f(0.35)));
    const pitch = f(1 + f(f(random() - random()) * 0.4));
    return [{ sound: hostile ? "game.hostile.swim" : "game.neutral.swim", volume, pitch, position }];
  }
  const s = mobStepSound(e.type, block, world.get(x, y + 1, z));
  return s ? [{ sound: s.name, volume: s.volume, pitch: s.pitch, position }] : [];
}
