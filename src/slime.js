// EntitySlime (ym, EntityList id 55) of Minecraft Java 1.7.10: sizes, jumping, squish, splitting, drops, the swamp and
// slime chunk spawn rules and ModelSlime's geometry. Pure rules; entities.js wires them to the live world. The ground
// truth is public/research/slime-reference.json (tools/probes/SlimeProbe.java, unchanged 1.7.10 classes), replayed by
// slime.test.js. Anything the probe did not record is marked "bytecode-derived".
import { JavaRandom } from "./java-random.js";
import { MOON_FACTORS, moonPhase, PEACEFUL } from "./difficulty.js";

const f = Math.fround;
export const SLIMEBALL = 341;
export const SLIME = Object.freeze({
  sizes: [1, 2, 4], // constructor: 1 << rand.nextInt(3)
  speed: f(0.1), // movement speed attribute (the jump uses moveForward = size)
  followRange: 16,
  talkInterval: 80,
  maxSpawnedInChunk: 4,
  shadowSize: 0.25, // RenderSlime (bytecode-derived)
  chunkSalt: 987234911n,
});
// setSlimeSize (a(I)): setSize(0.6F * size, 0.6F * size), maxHealth = health = size * size, experienceValue = size.
export const slimeWidth = (size) => f(f(0.6) * size);
export const slimeHeight = slimeWidth;
export const slimeHealth = (size) => size * size;
export const slimeExperience = (size) => size;
// EntitySlime.getAttackStrength (bU) is the size; a size 1 slime cannot damage (bT is size > 1).
export const slimeDamage = (size) => size;
export const slimeCanDamage = (size) => size > 1;
export const slimeEyeHeight = (size) => f(slimeHeight(size) * f(0.85));
export const slimeVolume = (size) => f(f(0.4) * size);
export const slimeSoundName = (size) => (size > 1 ? "mob.slime.big" : "mob.slime.small"); // hurt, death and jump
export const slimeMakesJumpSound = (size) => size > 0; // bY
export const slimeMakesLandSound = (size) => size > 2; // bW
export const slimeDeathParticle = "slime";
// Size NBT tag: size - 1 on write; on read a negative value is clamped to 0 and size = value + 1.
export const slimeSizeToNbt = (size) => size - 1;
export const slimeSizeFromNbt = (v) => Math.min(127, Math.max(0, Number.isFinite(v) ? Math.trunc(v) : 0) + 1); // capped at the datawatcher byte
export const randomSize = (rand) => 1 << rand.nextInt(3);
// getJumpDelay (bR) and the constructor's first delay: nextInt(20) + 10.
export const jumpDelay = (rand) => rand.nextInt(20) + 10;
// getDropItem (u): a slimeball for size 1 only; dropFewItems adds nextInt(3), plus nextInt(looting + 1) with Looting.
export function slimeDrops(rand, size, looting = 0) {
  if (size !== 1) return [];
  let n = rand.nextInt(3);
  if (looting > 0) n += rand.nextInt(looting + 1);
  return Array.from({ length: n }, () => SLIMEBALL);
}
// setDead (B): a dead slime above size 1 splits into 2 + nextInt(3) children of size / 2, each at (x + (i % 2 - 0.5) * size / 4,
// y + 0.5, z + (i / 2 - 0.5) * size / 4) with yaw nextFloat() * 360; i / 2 is an int division.
export function slimeChildren(rand, e) {
  if (e.size <= 1 || e.health > 0) return [];
  const count = 2 + rand.nextInt(3), out = [];
  for (let i = 0; i < count; i++) {
    const dx = f(f((i % 2) - 0.5) * e.size / 4), dz = f(f(Math.trunc(i / 2) - 0.5) * e.size / 4);
    out.push({ size: Math.trunc(e.size / 2), x: e.x + dx, y: e.y + 0.5, z: e.z + dz, yaw: f(f(rand.nextFloat()) * 360) });
  }
  return out;
}
// onCollideWithPlayer (b_): size > 1, the player visible and within distance^2 < (0.6 * size)^2 takes `size` mob damage; mob.attack
// (volume 1, pitch (r - r) * 0.2 + 1) plays with it. The 1.7.10 sound manifest has no mob.attack event, so it is silent.
export const slimeTouches = (size, distSq, canSee, canDamage = size > 1) => canDamage && canSee && distSq < f(f(0.6) * size) ** 2;

// --- Spawning ---
// Chunk.getRandomWithSeed: new Random(worldSeed + (long)(cx*cx*4987142) + (long)(cx*5947611) + (long)(cz*cz)*4392871L
// + (long)(cz*389711) ^ salt); the int products wrap before they widen.
export function chunkRandom(worldSeed, cx, cz, salt = SLIME.chunkSalt) {
  const i = (n) => BigInt(n | 0);
  const sum = BigInt(worldSeed) + i(Math.imul(Math.imul(cx, cx), 4987142)) + i(Math.imul(cx, 5947611)) + i(Math.imul(cz, cz)) * 4392871n + i(Math.imul(cz, 389711));
  return new JavaRandom(BigInt.asIntN(64, sum) ^ salt);
}
export const isSlimeChunk = (worldSeed, cx, cz) => chunkRandom(worldSeed, cx, cz).nextInt(10) === 0;
export const SWAMPLAND = 6;
// EntitySlime.getCanSpawnHere (by), in the original's order: a superflat world only when nextInt(4) == 1; a size other than 1 never
// on Peaceful; the swamp rule (swampland, 50 < y < 70, nextFloat() < 0.5, nextFloat() < moon phase factor, block light <=
// nextInt(8)); then the chunk rule (nextInt(10) == 0, a slime chunk, y < 40). Either rule ends in EntityLiving's own checks.
// `env`: {flat, difficulty, biome, blockLight(), chunkX, chunkZ, worldSeed, worldTime, base() -> EntityLiving.getCanSpawnHere}.
export function slimeCanSpawnHere(rand, size, y, env) {
  if (env.flat && rand.nextInt(4) !== 1) return false;
  if (size !== 1 && env.difficulty === PEACEFUL) return false;
  if (env.biome === SWAMPLAND && y > 50 && y < 70 && f(rand.nextFloat()) < 0.5 && rand.nextFloat() < f(MOON_FACTORS[moonPhase(env.worldTime)]) && env.blockLight() <= rand.nextInt(8))
    return env.base();
  if (rand.nextInt(10) === 0 && env.worldSeed !== undefined && isSlimeChunk(env.worldSeed, env.chunkX, env.chunkZ) && y < 40) return env.base();
  return false;
}

// --- Movement and squish ---
const wrap = (v) => { v = f(v % 360); if (v >= 180) v = f(v - 360); if (v < -180) v = f(v + 360); return v; };
// EntityLiving.updateRotation: turn at most `limit` degrees toward the target.
export const updateRotation = (current, target, limit) => f(current + Math.max(-limit, Math.min(limit, wrap(target - current))));
// EntityLiving.faceEntity(target, 10, 20): `target.y` is the target's eye height position.
export function faceEntity(s, target, yawLimit = 10, pitchLimit = 20) {
  const dx = target.x - s.x, dz = target.z - s.z, dy = target.eyeY - (s.y + slimeEyeHeight(s.size)), h = Math.sqrt(dx * dx + dz * dz);
  const yaw = f(f(Math.atan2(dz, dx) * 180 / Math.PI) - 90), pitch = f(-f(Math.atan2(dy, h) * 180 / Math.PI));
  s.rotationPitch = updateRotation(s.rotationPitch || 0, pitch, pitchLimit);
  s.rotationYaw = updateRotation(s.rotationYaw, yaw, yawLimit);
}
// onUpdate (h) before the movement: squishFactor chases squishAmount by half.
export function slimeSquishStart(s) {
  s.squishFactor = f(s.squishFactor + f(f(s.squishAmount - s.squishFactor) * 0.5));
  s.prevSquishFactor = s.squishFactor;
  s.wasOnGround = s.onGround;
}
// updateEntityActionState (bq) after despawnEntity: `target` is the closest vulnerable player within 16 (or null). On the ground the
// jump delay counts down; at 0 it re-rolls (a third of it with a target), the slime jumps with the jump sound and picks
// moveStrafing = 1 - nextFloat() * 2, moveForward = size; otherwise it stops jumping and, on the ground, stops moving.
export function slimeActionState(s, rand, target, sound) {
  if (target) faceEntity(s, target);
  if (s.onGround && s.jumpDelay-- <= 0) {
    s.jumpDelay = jumpDelay(rand);
    if (s.type === "magma_cube") s.jumpDelay *= 4; // yf.bR: the slime's delay times 4
    if (target) s.jumpDelay = Math.trunc(s.jumpDelay / 3);
    s.jumping = true;
    if (slimeMakesJumpSound(s.size)) sound(s.type === "magma_cube" ? magmaSoundName(s.size) : slimeSoundName(s.size), slimeVolume(s.size), f(f(f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2)) + 1) * f(0.8)));
    s.moveStrafing = f(1 - f(rand.nextFloat() * 2));
    s.moveForward = s.size;
  } else {
    s.jumping = false;
    if (s.onGround) s.moveForward = s.moveStrafing = 0;
  }
}
// onUpdate (h) after the movement: a landing spawns size * 8 slime particles (sin/cos(angle) * size * 0.5 * f at the box floor)
// and, above size 2, the landing sound (pitch / 0.8) and squishAmount = -0.5; leaving the ground sets 1.0; then squishAmount * 0.6.
export function slimeSquishEnd(s, rand, fx, sound) {
  if (s.onGround && !s.wasOnGround) {
    for (let i = 0; i < s.size * 8; i++) {
      const angle = f(f(rand.nextFloat() * f(Math.PI)) * 2), r = f(f(rand.nextFloat() * 0.5) + 0.5);
      fx(f(f(Math.sin(angle) * s.size) * 0.5 * r), f(f(Math.cos(angle) * s.size) * 0.5 * r));
    }
    if (s.type === "magma_cube" || slimeMakesLandSound(s.size)) sound(s.type === "magma_cube" ? magmaSoundName(s.size) : slimeSoundName(s.size), slimeVolume(s.size), f(f(f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2)) + 1) / f(0.8)));
    s.squishAmount = -0.5;
  } else if (!s.onGround && s.wasOnGround) s.squishAmount = 1;
  s.squishAmount = f(s.squishAmount * f(s.type === "magma_cube" ? 0.9 : 0.6)); // yf.bS keeps 0.9
}
export const magmaSoundName = (size) => (size > 1 ? "mob.magmacube.big" : "mob.magmacube.small"); // yf.bV; hurt and death stay slimeSoundName
export const slimeSquishFields = () => ({ squishAmount: 0, squishFactor: 0, prevSquishFactor: 0, moveStrafing: 0 });

// --- Render (RenderSlime.preRenderCallback and ModelSlime, bytecode-derived and ModelProbe's dump) ---
// glScalef(f5 * size, size / f5, f5 * size).
export function slimeScale(size, prevSquish, squish, partial) {
  const f4 = f(f(prevSquish + f(f(squish - prevSquish) * partial)) / f(f(size * 0.5) + 1)), f5 = f(1 / f(f4 + 1));
  return [f(f5 * size), f(size / f5), f(f5 * size)];
}
// bie(16): the body, bie(0): the outer shell (second pass, SRC_ALPHA / ONE_MINUS_SRC_ALPHA). Boxes are [from, to, uv].
export const SLIME_MODEL = Object.freeze({
  texture: [64, 32],
  inner: [
    { name: "body", from: [-3, 17, -3], size: [6, 6, 6], uv: [0, 16] },
    { name: "rightEye", from: [-3.25, 18, -3.5], size: [2, 2, 2], uv: [32, 0] },
    { name: "leftEye", from: [1.25, 18, -3.5], size: [2, 2, 2], uv: [32, 4] },
    { name: "mouth", from: [0, 21, -3.5], size: [1, 1, 1], uv: [32, 8] },
  ],
  outer: [{ name: "shell", from: [-4, 16, -4], size: [8, 8, 8], uv: [0, 0] }],
});

// Magma cubes (nether-melee.js) are slimes with their own numbers; type "magma_cube" shares every slime code path.
export const isSlimeLike = (e) => e?.type === "slime" || e?.type === "magma_cube";
// Live-mob helpers (entities.js). The collision box scale: a slime is size times 0.6 x 0.6, an adult 1, a child 0.5.
export const mobScale = (e) => (isSlimeLike(e) ? e.size : e.growingAge < 0 ? 0.5 : 1);
// The fields of one live slime. `size` null rolls the constructor's 1 << nextInt(3); the first jump delay is nextInt(20) + 10.
// Health is size * size (setSlimeSize heals to full), restore() clamps a saved value afterwards.
export function slimeFields(size, random) {
  const s = size ?? 1 << Math.floor(random() * 3);
  return { size: s, health: slimeHealth(s), jumpDelay: Math.floor(random() * 20) + 10, ...slimeSquishFields(), wasOnGround: false, slimeForward: 0, slimeStrafe: 0 };
}
// A saved size (Size NBT + 1, kept as `size`): any integer from 1 up to the byte range Size can store.
export const savedSize = (v) => (Number.isInteger(v) && v >= 1 && v <= 127 ? v : 1);
export const slimeFieldsFrom = (e) => ({ size: savedSize(e.size), health: slimeHealth(savedSize(e.size)) });
// EntitySlime.readEntityFromNBT calls setSlimeSize, which heals to full: the saved Health is replaced by size * size.
export const slimeRestore = (e, fresh) => ({ ...slimeFields(savedSize(e.size), () => 0), jumpDelay: fresh.jumpDelay });
