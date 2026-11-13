// Batch 61: the water draws of a client copy of an EntityLivingBase, on the copy's own Entity.rand (draws only, like copy-talk.js: the live path shows the visible splash and bubbles).
// Executed: tools/probes/MobCopies2Probe.java `water` (every mob class dropped into a pool on a client world double, 420 ticks) -> public/research/mobcopies2-reference.json,
// replayed by src/mobcopies2-b61.test.js. Bytecode-read: sv.C (EntityLivingBase.onEntityUpdate) and sv.j (decreaseAirSupply), wt.j (EntityIronGolem).
//  - Entity.handleWaterMovement (sa.N): entering water (not on the copy's first update) plays the splash (two floats for the pitch) then the "bubble" and "splash" particles
//    (fx.js enterWater). It runs at the start of onEntityUpdate and again inside moveEntity (updateFallState) for a copy that is not in water yet.
//  - EntityLivingBase.onEntityUpdate: an alive copy whose eye is in water: air = decreaseAirSupply(air) (Respiration level i > 0: `nextInt(i + 1) > 0` keeps the air), at -20 the
//    air is set to 0 and 8 "bubble" draw six floats each (the drowning damage itself is refused on a client world). Out of water (or dead) the air is 300.
//  - The iron golem overrides decreaseAirSupply to return the air unchanged: its copy never reaches -20. A copy never knows a mob's Water Breathing (a client holds no
//    effects of a mob), so it drowns on its own count whatever the server's mob does. The squid copy has its own code (entity-tracker.js clientAir, entities.js clientEnvironment).
import { enterWater, drownBubbles } from "./fx.js";
import { livingEyeHeight } from "./ai.js";
import { eyeInWater } from "./fluids.js";
import { deathRandom } from "./death-fx.js";

const NO_FX = { spawn() {} };
const NOT_LIVING_WATER = new Set(["squid", "ender_dragon", "ender_crystal"]);

// EntityLivingBase.decreaseAirSupply (sv.j) with the Respiration level of the copy's helmet (a copy holds none: 0).
export const decreaseAirSupply = (air, respiration, rand) => (respiration > 0 && rand.nextInt(respiration + 1) > 0 ? air : air - 1);

// Entity.handleWaterMovement's splash on entering water (c.inWater just recomputed, `wasInWater` its value before): `motion` is the entity's motion at that time.
export function copyWaterEnter(c, m, wasInWater, width, motion = [c.vx, c.vy, c.vz], rand = deathRandom(c)) {
  if (NOT_LIVING_WATER.has(m.type) || !c.inWater || wasInWater !== false) return false;
  enterWater(null, { x: c.x, z: c.z, minY: c.y, width, mx: motion[0], my: motion[1], mz: motion[2] }, rand);
  return true;
}

// updateFallState inside moveEntity: a copy not yet in water asks handleWaterMovement again for the box it moved to (`wet` is that answer). Returns true when it splashed.
export function copyWaterAfterMove(c, m, wet, width, motion, rand = deathRandom(c)) {
  if (NOT_LIVING_WATER.has(m.type) || c.inWater !== false || !wet) return false;
  c.inWater = true;
  enterWater(null, { x: c.x, z: c.z, minY: c.y, width, mx: motion[0], my: motion[1], mz: motion[2] }, rand);
  return true;
}

// The air part of onEntityUpdate on the copy. `eyeWet` is Entity.isInsideOfMaterial(water) at the copy's eye. Returns true on the tick the 8 bubbles are drawn.
export function copyBreatheStep(c, m, eyeWet, rand = deathRandom(c)) {
  if (NOT_LIVING_WATER.has(m.type)) return false;
  if (c.dead || c.deathDone || !eyeWet) { c.air = 300; return false; }
  if (m.type === "iron_golem") return false;
  c.air = decreaseAirSupply(c.air ?? 300, c.respiration ?? 0, rand);
  if (c.air !== -20) return false;
  c.air = 0;
  drownBubbles(NO_FX, { x: c.x, y: c.y, z: c.z, mx: c.vx, my: c.vy, mz: c.vz }, rand);
  return true;
}

export const copyBreathe = (c, m, world, rand) => copyBreatheStep(c, m, eyeInWater(world, c.x, c.y + livingEyeHeight(m.type, c.height), c.z), rand);
