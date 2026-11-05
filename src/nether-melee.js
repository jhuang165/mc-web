// EntityMagmaCube (yf, "LavaSlime", id 62) and EntityPigZombie (yh, "PigZombie", id 57) of Minecraft Java 1.7.10, plus the pig struck by
// lightning (wo.a(xh)) and BlockPortal.updateTick's pigman spawn (amp). Pure rules; nether-melee-live.js and entities.js wire them to the
// live world. Ground truth: public/research/magma-pigman-reference.json (tools/probes/MagmaPigmanProbe.java on the unchanged classes), replayed
// by magma-pigman.test.js. Whatever the probe could not record is marked "bytecode-derived".
const f = Math.fround;

// --- Magma cube (a slime subclass; slime.js already holds size, squish and split rules) ---
export const MAGMA_CREAM = 390; // ade.bs (378 in the original) -> browser id
export const MAGMA = Object.freeze({
  speed: f(0.1), // the slime AI's fixed aiMoveSpeed (the 0.2 attribute is not used by the jump)
  talkInterval: 80,
  shadowSize: 0.25, // RenderMagmaCube (boe)
  particle: "flame", // bP
  texture: "slime/magmacube", // textures/entity/slime/magmacube.png
});
export const isMagma = (e) => e?.type === "magma_cube";
// aV (getTotalArmorValue) = size * 3, probed per size.
export const magmaArmor = (size) => size * 3;
// bU (getAttackStrength): the slime's size plus 2; bT (canDamagePlayer) is always true.
export const magmaDamage = (size) => size + 2;
export const magmaCanDamage = () => true;
// bj (jump): motionY = 0.42F + size * 0.1F.
export const magmaJumpMotion = (size) => f(f(0.42) + f(size * f(0.1)));
// bR (getJumpDelay) is the slime's nextInt(20) + 10 times 4 (the target divides afterwards, in slimeActionState).
export const magmaJumpDelay = (rand) => (rand.nextInt(20) + 10) * 4;
// bS (alterSquishAmount): squishAmount * 0.9 (the slime's is 0.6).
export const MAGMA_SQUISH_DECAY = f(0.9);
// b(boolean, int) dropFewItems: only above size 1, nextInt(4) - 2 plus nextInt(looting + 1) with Looting, that many magma creams.
export function magmaDrops(rand, size, looting = 0) {
  if (size <= 1) return [];
  let n = rand.nextInt(4) - 2;
  if (looting > 0) n += rand.nextInt(looting + 1);
  return Array.from({ length: Math.max(0, n) }, () => MAGMA_CREAM);
}
// c(float) / d(float): always fully lit (packed brightness 15728880, brightness 1.0).
export const MAGMA_BRIGHTNESS = Object.freeze({ packed: 15728880, value: 1 });

// --- Zombie pigman ---
export const GOLD_NUGGET = 394, GOLD_INGOT = 304, ROTTEN_FLESH = 206, GOLDEN_SWORD = 119;
export const GOLDEN_SWORD_DURABILITY = 32;
export const PIGMAN = Object.freeze({
  health: 20, width: 0.6, height: 1.8, movement: 0.5, attackDamage: 5, followRange: 40, armor: 2, experience: 5,
  talkInterval: 80, angerRange: 32, boost: 0.45, // "Attacking speed boost", operation 0
  sounds: Object.freeze({ say: "mob.zombiepig.zpig", hurt: "mob.zombiepig.zpighurt", death: "mob.zombiepig.zpigdeath", angry: "mob.zombiepig.zpigangry" }),
  texture: "zombie_pigman",
  equipmentDropChance: f(0.085),
});
export const isPigman = (e) => e?.type === "pigman";
// c(target): the angry target is set with angerLevel = 400 + nextInt(400) and randomSoundDelay = nextInt(40), in that order, on the
// pigman's own Entity.rand. The counter never decrements in yh: anger is permanent (bytecode-derived and probed over 120 ticks).
export function pigmanAnger(rand) {
  const angerLevel = 400 + rand.nextInt(400);
  return { angerLevel, randomSoundDelay: rand.nextInt(40) };
}
// a(ro, F) attackEntityFrom with a player source: every pigman in the 32 block box around the hit one (self excluded) is angered
// first, then the hit one, each with its own rand. `others` are the live pigmen; `near` tests the grown box.
export function pigmanProvoke(target, pigmen, randOf, near) {
  for (const o of pigmen) if (o !== target && near(o)) Object.assign(o, pigmanAnger(randOf(o)), { pigTarget: true });
  Object.assign(target, pigmanAnger(randOf(target)), { pigTarget: true });
}
// h (onUpdate): when randomSoundDelay is above 0 and the pre-decrement count reaches 0 after `--`, the angry sound plays at volume * 2
// and pitch ((r - r) * 0.2 + 1) * 1.8; the speed boost modifier follows the target (aiMoveSpeed in entities.js).
export function pigmanAngrySound(e, rand, volume = 1) {
  if (e.randomSoundDelay > 0 && --e.randomSoundDelay === 0)
    return { sound: PIGMAN.sounds.angry, volume: f(volume * 2), pitch: f(f(f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2)) + 1) * f(1.8)) };
  return null;
}
// bR (findPlayerToAttack): nothing while calm, otherwise EntityMob's closest visible vulnerable player within 16.
export const pigmanSeeksPlayer = (e) => (e.angerLevel | 0) > 0;
// dropFewItems: nextInt(2 + looting) rotten flesh, then nextInt(2 + looting) gold nuggets.
export function pigmanDrops(rand, looting = 0) {
  const out = [];
  for (let i = rand.nextInt(2 + looting); i > 0; i--) out.push(ROTTEN_FLESH);
  for (let i = rand.nextInt(2 + looting); i > 0; i--) out.push(GOLD_NUGGET);
  return out;
}
// n (dropRareDrop): one gold ingot (the zombie's iron/carrot/potato roll is replaced). It draws nothing from Entity.rand.
export const pigmanRareDrop = () => GOLD_INGOT;
// dropEquipment: the gold sword at 0.085 (+ nothing from looting except the nextFloat - looting * 0.01 test) for a player kill, damaged
// like any damageable drop (skeleton bow rule): maxDamage - nextInt(1 + nextInt(maxDamage - 25)) kept within [1, maxDamage - 25].
export function pigmanSwordDrop(rand, held, playerHit, looting = 0) {
  if (!held || !playerHit) return null;
  if (!(f(rand.nextFloat() - f(looting * f(0.01))) < PIGMAN.equipmentDropChance)) return null;
  const k = Math.max(GOLDEN_SWORD_DURABILITY - 25, 1);
  return { id: held.id, damage: Math.min(k, Math.max(1, GOLDEN_SWORD_DURABILITY - rand.nextInt(rand.nextInt(k) + 1))) };
}
// getExperiencePoints: 5, plus 1 + nextInt(3) for the held sword (its drop chance is 0.085 <= 1).
export const pigmanExperience = (rand, held) => 5 + (held ? 1 + rand.nextInt(3) : 0);
// bC (addRandomArmor): only the golden sword in slot 0, no random armour and no super call.
export const pigmanEquipment = () => ({ id: GOLDEN_SWORD, damage: 0, count: 1 });
// By lightning (wo.a(xh), server side): the pig is removed and a pigman with the golden sword appears at its position, yaw and pitch.
// The pig itself takes nothing (no super call). Baby pigs give an adult pigman (probed).
export function pigStruck(pig) {
  return { x: pig.x, y: pig.y, z: pig.z, rotationYaw: pig.rotationYaw ?? 0, rotationPitch: pig.rotationPitch ?? 0, held: pigmanEquipment(), angerLevel: 0 };
}
// BlockPortal.updateTick (amp.a): in a surface world with doMobSpawning, nextInt(2000) < difficulty id (Peaceful 0 .. Hard 3); the column
// is searched down for the first block with a solid top (while none and y > 0); the block above it must not be a normal cube. The
// pigman is created at (x + 0.5, floorY + 1.1, z + 0.5) and gets the 300 tick portal cooldown. `column` = { top(y), normal(y) }.
export function portalPigmanSpawn(rand, { difficulty, doMobSpawning = true, surfaceWorld = true }, x, y, z, column) {
  if (!surfaceWorld || !doMobSpawning) return null;
  if (!(rand.nextInt(2000) < difficulty)) return null;
  let l = y;
  while (!column.top(l) && l > 0) l--;
  if (l <= 0 || column.normal(l + 1)) return null;
  return { x: x + 0.5, y: l + 1.1, z: z + 0.5, portalCooldown: 300 };
}
