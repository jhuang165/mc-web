// EntityCreeper (xz), EntityAICreeperSwell (vi), ModelCreeper (bhj) and RenderCreeper
// (bni) from Minecraft Java 1.7.10. The replays in creeper.test.js compare these with
// public/research/creeper-reference.json (tools/verify-creepers.mjs, CreeperProbe).
// Notes: public/research/creepers.md.
import { mhSin, mhCos } from "./lighting.js";

const f = Math.fround;
// xz.br fuseTime and xz.bs explosionRadius (NBT "Fuse" and "ExplosionRadius").
export const CREEPER_FUSE = 30, CREEPER_RADIUS = 3;
// Items.gunpowder (original 289): EntityCreeper.getDropItem.
export const GUNPOWDER = 330;

// The creeper's fields: creeperState is datawatcher 16 (byte, -1 idle, 1 swelling),
// `fuseTime` is timeSinceIgnited (bq), `lastActive` lastActiveTime (bp), `powered`
// datawatcher 17 and `ignited` datawatcher 18. timeSinceIgnited is not saved.
// `maxFuse` is fuseTime (br, NBT "Fuse", a short) and `explosionRadius` bs (NBT "ExplosionRadius", a byte); both are saved.
export const creeperFields = () => ({ creeperState: -1, fuseTime: 0, lastActive: 0, powered: false, ignited: false, maxFuse: CREEPER_FUSE, explosionRadius: CREEPER_RADIUS });
// EntityCreeper.readEntityFromNBT (xz.a(dh)): Fuse is read with getShort and ExplosionRadius with getByte, only when the tag is numeric.
export const creeperSavedFields = (e) => ({
  maxFuse: Number.isInteger(e.maxFuse) ? (e.maxFuse << 16) >> 16 : CREEPER_FUSE,
  explosionRadius: Number.isInteger(e.explosionRadius) ? (e.explosionRadius << 24) >> 24 : CREEPER_RADIUS,
});
const maxFuse = (e) => e.maxFuse ?? CREEPER_FUSE;

// The head of EntityCreeper.onUpdate (xz.h), run before EntityLivingBase.onUpdate while
// the creeper is alive: an ignited creeper swells; the first swelling tick plays
// creeper.primed (volume 1, pitch 0.5); timeSinceIgnited moves by the state, floored at
// 0; at the fuse it explodes (xz.ce): radius 3, or 6 when powered, at the feet, with
// mobGriefing deciding whether blocks break, and the creeper is removed.
// Returns { sound, explode } (either may be absent).
export function creeperTick(e) {
  const out = {};
  e.lastActive = e.fuseTime;
  if (e.ignited) e.creeperState = 1;
  const state = e.creeperState;
  if (state > 0 && e.fuseTime === 0) out.sound = { name: "creeper.primed", volume: 1, pitch: 0.5 };
  e.fuseTime += state;
  if (e.fuseTime < 0) e.fuseTime = 0;
  if (e.fuseTime >= maxFuse(e)) {
    e.fuseTime = maxFuse(e);
    // xz.ce: explosionRadius * 2 (an int product) when powered, else explosionRadius, converted to float.
    out.explode = { x: e.x, y: e.y, z: e.z, size: f((e.explosionRadius ?? CREEPER_RADIUS) * (e.powered ? 2 : 1)) };
  }
  return out;
}

// EntityCreeper.getCreeperFlashIntensity (xz.a(F)):
// (lastActiveTime + (timeSinceIgnited - lastActiveTime) * partial) / (fuseTime - 2).
export const creeperFlash = (e, partial) => f(f(e.lastActive + f((e.fuseTime - e.lastActive) * partial)) / (maxFuse(e) - 2));

// EntityCreeper.fall (xz.b(F)): after the usual fall damage, the fall pushes the fuse on
// by distance * 1.5, at most to fuseTime - 5.
export function creeperFall(e, distance) {
  e.fuseTime = Math.trunc(f(e.fuseTime + f(distance * f(1.5))));
  if (e.fuseTime > maxFuse(e) - 5) e.fuseTime = maxFuse(e) - 5;
}

// EntityAICreeperSwell (vi, mutex 1). shouldExecute: already swelling, or an attack target
// closer than 3 blocks (getDistanceSqToEntity < 9). `distSq` is null without a target.
export const swellShould = (state, distSq) => state > 0 || (distSq !== null && distSq < 9);
// updateTask: no target, a target beyond 7 blocks (distSq > 49) or out of sight
// (EntitySenses.canSee) releases the fuse (-1); otherwise it swells (1).
export const swellState = (distSq, canSee) => (distSq === null || distSq > 49 || !canSee ? -1 : 1);

// EntityCreeper.getMaxSafePointTries (xz.ax): 3 without a target, else 3 + (health - 1).
export const creeperSafeTries = (hasTarget, health) => (hasTarget ? 3 + Math.trunc(f(health - 1)) : 3);

// EntityLiving.dropFewItems with getDropItem = gunpowder: rand.nextInt(3) items, killed by
// a player or not (the music disc for a skeleton's arrow is combat.js mobDrops).
export const creeperDrops = (nextInt) => nextInt(3);

// EntityCreeper.interact (xz.a(yz)) with flint and steel: fire.ignite at the creeper (+0.5 each way) with pitch nextFloat() * 0.4 + 0.8 drawn on the
// creeper's own Entity.rand, then func_146079_cb sets datawatcher 18 (ignited). The caller wears the tool out. Returns the sound.
export function creeperIgnite(e, rand) {
  const pitch = f(f(rand.nextFloat() * f(0.4)) + f(0.8));
  e.ignited = true;
  return { name: "fire.ignite", volume: 1, pitch, position: { x: e.x + 0.5, y: e.y + 0.5, z: e.z + 0.5 } };
}

// EntityCreeper.onStruckByLightning: datawatcher 17 = 1 (after Entity's 5 fire damage).
export function powerCreeper(e) {
  e.powered = true;
}

// ModelCreeper.setRotationAngles (bhj): head yaw/pitch in degrees / 57.295776, legs
// (pivot order d (-2,16,4), e (2,16,4), f (-2,16,-4), g (2,16,-4)) at
// cos(swing * 0.6662 [+ pi]) * 1.4 * amount through MathHelper's table.
// Returns [rotX, rotY, rotZ] for [head, d, e, f, g].
export function creeperPose(swing, amount, yaw, pitch) {
  [swing, amount, yaw, pitch] = [swing, amount, yaw, pitch].map(f);
  const a = f(f(mhCos(f(swing * f(0.6662))) * f(1.4)) * amount),
    b = f(f(mhCos(f(f(swing * f(0.6662)) + f(Math.PI))) * f(1.4)) * amount);
  return [[f(pitch / f(57.295776)), f(yaw / f(57.295776)), 0], [a, 0, 0], [b, 0, 0], [b, 0, 0], [a, 0, 0]];
}

// RenderCreeper.preRenderCallback (bni.a(xz, F)): the swell scale (x, y, z) from the
// flash intensity, with a small sine wobble.
export function creeperScale(flash) {
  let k = flash;
  const wobble = f(1 + f(f(mhSin(f(k * 100)) * k) * f(0.01)));
  if (k < 0) k = 0;
  if (k > 1) k = 1;
  k = f(k * k);
  k = f(k * k);
  const xz = f(f(1 + f(k * f(0.4))) * wobble), y = f(f(1 + f(k * f(0.1))) / wobble);
  return [xz, y, xz];
}

// RenderCreeper.getColorMultiplier (bni.a(xz, F, F)): white with alpha
// (int)(flash * 0.2 * 255) / 255 on the ticks where (int)(flash * 10) is odd, else none.
export function creeperWhite(flash) {
  if (Math.trunc(f(flash * 10)) % 2 === 0) return 0;
  const a = Math.trunc(f(f(flash * f(0.2)) * 255));
  return Math.max(0, Math.min(255, a)) / 255;
}

// RenderCreeper.shouldRenderPass (bni.a(xz, I, F)) for a powered creeper, pass 1: the
// armor texture (creeper_armor.png on ModelCreeper(2.0F)) scrolled by (ticks + partial)
// * 0.01 on u and v, colour 0.5, additive (GL_ONE, GL_ONE), lighting off.
export const armorScroll = (ticks) => f(ticks * f(0.01));
