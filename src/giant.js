// Minecraft Java 1.7.10 EntityGiantZombie (ye, entity id 53 "Giant") and RenderGiantZombie (bnu).
// Bytecode-derived (public/research/giant.md): extends EntityMob (yg), not EntityZombie, so there is no zombie
// AI-task list, sounds, sunlight burning or drops. It runs EntityCreature's legacy action state (creatureActionState
// in silverfish.js) at 0.1 land speed. Not natural-spawning and has no spawn egg: /summon, spawners and saves only.
const f = Math.fround;
// The constructor multiplies width, height and yOffset by 6.0F, then setSize(width * 6, height * 6) on the inherited 0.6 x 1.8.
export const GIANT = Object.freeze({
  health: 100, // aD: generic.maxHealth
  movement: 0.5, // generic.movementSpeed
  attackDamage: 50, // generic.attackDamage
  followRange: 16, // EntityLiving default
  scale: 6, // RenderGiantZombie.preRenderCallback glScalef(6, 6, 6); shadowSize 0.5 * 6
  width: f(f(0.6) * f(6)),
  height: f(f(1.8) * f(6)),
  yOffset: f(0 * f(6)),
  experience: 5, // EntityMob.experienceValue
  range: 16, // EntityMob.findPlayerToAttack (bR): getClosestVulnerablePlayerToEntity(this, 16.0)
  texture: "zombie",
});
// EntityGiantZombie.getBlockPathWeight (a(III)F): world.getLightBrightness(x, y, z) - 0.5F (the opposite sign to EntityMob's).
export const giantPathWeight = (brightness) => f(brightness - f(0.5));
// EntityMob.attackEntity (yg.a(sa, F)): attackTime <= 0, distance < 2.0 and the boxes overlap in Y; the cooldown is 20.
export function giantAttackReady(e, targetMinY, targetMaxY, distance) {
  return (e.attackTime ?? 0) <= 0 && distance < f(2) && targetMaxY > e.y && targetMinY < e.y + GIANT.height;
}
// yg: hurt, death and swim sounds are the shared hostile set; fall damage plays small (<= 4) or big. getLivingSound is null (no idle sound).
export const GIANT_SOUNDS = Object.freeze({ hurt: "game.hostile.hurt", death: "game.hostile.die", say: null });
export const isGiant = (type) => type === "giant";
