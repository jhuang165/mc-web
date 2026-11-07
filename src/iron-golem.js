// Minecraft Java 1.7.10 EntityIronGolem (wt): size, attributes, sounds, drops, the melee attack, the rose
// and the pumpkin T-shape that builds one. Checked against the unchanged classes by
// tools/probes/VillageLiveProbe.java (tools/verify-village.mjs, public/research/village-live-reference.json);
// see public/research/iron-golem.md for what runs. The AI tasks live in village-ai.js.
const f = Math.fround;

// EntityIronGolem constructor: setSize(1.4F, 2.9F); applyEntityAttributes: maxHealth 100, movementSpeed 0.25
// (followRange 16 is EntityLiving's default; knockbackResistance stays 0 in 1.7.10, recorded as golemFacts).
export const IRON_GOLEM = Object.freeze({ health: 100, width: f(1.4), height: f(2.9), movement: f(0.25), followRange: 16, knockbackResistance: 0 });
// ENTITY_TYPES entry: EntityAIWander speed 0.6 (the other speeds live in village-ai.js).
export const IRON_GOLEM_TYPE = { health: IRON_GOLEM.health, width: IRON_GOLEM.width, height: IRON_GOLEM.height, movement: IRON_GOLEM.movement, ai: { wander: 0.6 }, drop: 0 };
// getHurtSound, getDeathSound, func_145780_a (step), the attack's throw sound. No living sound.
export const IRON_GOLEM_SOUNDS = Object.freeze({ hit: "mob.irongolem.hit", death: "mob.irongolem.death", walk: "mob.irongolem.walk", throw: "mob.irongolem.throw" });
export const IRON_GOLEM_TEXTURE = "/media/1.7.10/entity/iron_golem.png";
// The poppy RenderIronGolem draws in the raised hand: Blocks.red_flower meta 0 (flower_rose.png in the block atlas).
export const IRON_GOLEM_ROSE_TEXTURE = "/media/1.7.10/blocks/flower_rose.png";
export const IRON_INGOT = 302, POPPY_BLOCK_NAME = "Red flower";

// What an iron golem record adds to an entity: the player-created flag (NBT PlayerCreated), the attack and
// rose timers (attackTimer ro, holdRoseTick bs; neither is saved) and the home area (EntityCreature
// homePosition / maximumHomeDistance, -1 = none; EntityIronGolem does not save it either).
export const ironGolemFields = (playerCreated = false) => ({ playerCreated: playerCreated === true, attackTimer: 0, holdRose: 0, homeRadius: -1, home: null, villageTimer: 0 });

// EntityIronGolem.attackEntityAsMob (wt.n): damage 7 + nextInt(15) (the attribute is not read).
export const golemAttackDamage = (rand) => 7 + rand.nextInt(15);
// EntityIronGolem.dropFewItems (wt.b(ZI)): nextInt(3) poppies, then 3 + nextInt(3) iron ingots (looting is not read).
// Returns [[itemId, count, damage]] with the poppy as `poppy` (the red flower block, meta 0).
export function golemDrops(rand, poppy) {
  const out = [], flowers = rand.nextInt(3);
  for (let i = 0; i < flowers; i++) out.push([poppy, 1, 0]);
  const ingots = 3 + rand.nextInt(3);
  for (let i = 0; i < ingots; i++) out.push([IRON_INGOT, 1, 0]);
  return out;
}
// EntityIronGolem.canAttackClass (wt.a(Class)): a player-created golem leaves players alone, and no golem
// attacks creepers. Anything else follows EntityCreature (true).
export const golemCanAttack = (golem, kind) => !(kind === "player" && golem.playerCreated) && kind !== "creeper";
// IMob (yb) implementors among the registered entities, probe-checked ("imob" record): EntityMob subclasses (Zombie,
// PigZombie, Skeleton, Spider, CaveSpider, Creeper, Enderman, Silverfish, Witch, Blaze, Giant, WitherBoss), EntitySlime,
// EntityMagmaCube, EntityGhast and EntityDragon. The browser type names for them.
export const IMOB_TYPES = new Set(["zombie", "pigman", "skeleton", "wither_skeleton", "spider", "cave_spider", "creeper", "enderman", "silverfish", "witch", "blaze", "giant", "wither", "slime", "magma_cube", "ghast", "ender_dragon"]);
// EntityIronGolem.collideWithEntity (wt.o): touching an IMob entity retargets it with probability 1 in 20 (one
// nextInt(20) on the golem's Random, drawn only for an IMob), before the usual Entity.applyEntityCollision push.
// canAttackClass is not consulted, so a creeper can become the target this way.
export const golemCollideRetargets = (rand, kind) => IMOB_TYPES.has(kind) && rand.nextInt(20) === 0;

// The tail of EntityIronGolem.onLivingUpdate (wt.e) after EntityLiving's: attackTimer and holdRoseTick count down,
// then with horizontal speed^2 > 2.5E-7 a 1 in 5 roll throws a blockcrack of the block 0.2 below the feet across
// its width (draws: x, z, motionX, motionZ; none when that block is air). `blockAt(x, y, z)` returns the
// { id, meta } there or null; the returned spec feeds the particle system, null means nothing was spawned.
export function golemTail(e, rand, blockAt) {
  if (e.attackTimer > 0) --e.attackTimer;
  if (e.holdRose > 0) --e.holdRose;
  if (!(e.vx * e.vx + e.vz * e.vz > 2.500000277905201e-7) || rand.nextInt(5) !== 0) return null;
  const block = blockAt(Math.floor(e.x), Math.floor(e.y - 0.2), Math.floor(e.z));
  if (!block) return null;
  const w = IRON_GOLEM.width, x = e.x + (rand.nextFloat() - 0.5) * w, z = e.z + (rand.nextFloat() - 0.5) * w;
  return { id: block.id, meta: block.meta ?? 0, x, y: e.y + 0.1, z, vx: 4 * (rand.nextFloat() - 0.5), vy: 0.5, vz: (rand.nextFloat() - 0.5) * 4 };
}

// EntityIronGolem.func_70682_h (j(int)): the air supply is not reduced.
export const golemDecreaseAir = (air) => air;

// ModelIronGolem (bij) boxes, recorded by the probe (the "model" record): [name, point, boxes, mirror]; boxes are
// [x, y, z, w, h, d, u, v, grow] on a 128 x 128 texture. Parts: head, body, right arm, left arm, left leg, right leg.
export const IRON_GOLEM_MODEL = Object.freeze({
  texture: [128, 128],
  head: { point: [0, -7, -2], boxes: [[-4, -12, -5.5, 8, 10, 8, 0, 0, 0], [-1, -5, -7.5, 2, 4, 2, 24, 0, 0]] },
  body: { point: [0, -7, 0], boxes: [[-9, -2, -6, 18, 12, 11, 0, 40, 0], [-4.5, 10, -3, 9, 5, 6, 0, 70, 0.5]] },
  rightArm: { point: [0, -7, 0], boxes: [[-13, -2.5, -3, 4, 30, 6, 60, 21, 0]] },
  leftArm: { point: [0, -7, 0], boxes: [[9, -2.5, -3, 4, 30, 6, 60, 58, 0]] },
  leftLeg: { point: [-4, 11, 0], boxes: [[-3.5, -3, -3, 6, 16, 5, 37, 0, 0]], mirror: false },
  rightLeg: { point: [5, 11, 0], boxes: [[-3.5, -3, -3, 6, 16, 5, 60, 0, 0]], mirror: true },
});

// ModelIronGolem.func_78172_a (a(F F)): a triangle wave, (|a % b - b / 2| - b / 4) / (b / 4); Java's float %.
export function triangle(a, b) {
  const m = f(a) % b, r = f(Math.abs(f(m - f(b * f(0.5)))) - f(b * f(0.25)));
  return f(r / f(b * f(0.25)));
}
// ModelIronGolem.setLivingAnimations + setRotationAngles: the arm and leg X angles (radians, the model's sign).
// `attackTimer` and `holdRose` are the entity's counters, `partial` the render fraction.
export function ironGolemAngles(limbSwing, limbSwingAmount, attackTimer, holdRose, partial) {
  const leg = f(f(f(-1.5) * triangle(limbSwing, 13)) * limbSwingAmount);
  const out = { leftLeg: leg, rightLeg: f(-leg), rightArm: 0, leftArm: 0 };
  if (attackTimer > 0) {
    out.rightArm = out.leftArm = f(f(-2) + f(f(1.5) * triangle(f(attackTimer - partial), 10)));
  } else if (holdRose > 0) {
    out.rightArm = f(f(-0.8) + f(f(0.025) * triangle(holdRose, 70)));
    out.leftArm = 0;
  } else {
    const t = f(f(1.5) * triangle(limbSwing, 13));
    out.rightArm = f(f(f(-0.2) + t) * limbSwingAmount);
    out.leftArm = f(f(f(-0.2) - t) * limbSwingAmount);
  }
  return out;
}

// BlockPumpkin.onBlockAdded (aky.b, the golem half): a pumpkin on top of two iron blocks with an iron block on
// each side of the middle one (x or z) builds an iron golem. `isIron(x, y, z)` and `isPumpkin(x, y, z)` read the
// world; the pumpkin is the cell just placed. Returns the cells to clear and where the golem stands, or null.
// (This build has no jack-o'-lantern; the original accepts it as well.)
export function ironGolemShape(isIron, x, y, z) {
  if (!isIron(x, y - 1, z) || !isIron(x, y - 2, z)) return null;
  const alongX = isIron(x - 1, y - 1, z) && isIron(x + 1, y - 1, z);
  const alongZ = isIron(x, y - 1, z - 1) && isIron(x, y - 1, z + 1);
  if (!alongX && !alongZ) return null;
  const cells = [[x, y, z], [x, y - 1, z], [x, y - 2, z]];
  if (alongX) cells.push([x - 1, y - 1, z], [x + 1, y - 1, z]);
  else cells.push([x, y - 1, z - 1], [x, y - 1, z + 1]);
  return { cells, at: { x: x + 0.5, y: y - 1.95, z: z + 0.5 } };
}
