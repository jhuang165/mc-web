// EntityPlayer.addMovementStat (yz.k) and addMountedMovementStat (yz.l), Minecraft Java 1.7.10 (bytecode-read; executed in
// public/research/movement-stats-reference.json, tools/probes/MovementStatProbe.java). One move gives one distance stat, in whole centimetres,
// and the exhaustion EntityPlayer.addExhaustion is handed for it. No imports: player-environment.js (the exhaustion) and stats-live.js (the stats)
// both read it.
//
//   ridingEntity != null          nothing (the vehicle's own tick adds the mounted stat, never exhaustion)
//   eye in water (dive)           round(|d| 3-D * 100) -> stat.diveOneCm,  0.015F * cm * 0.01F
//   else isInWater (swim)         round(|d| horizontal * 100) -> stat.swimOneCm,  0.015F * cm * 0.01F
//   else isOnLadder (climb)       dy > 0: (int) Math.round(dy * 100.0D) -> stat.climbOneCm; no exhaustion
//   else onGround (walk)          round(|d| horizontal * 100) -> stat.walkOneCm,  (sprinting 0.099999994F, else 0.01F) * cm * 0.01F
//   else (airborne)               round(|d| horizontal * 100) -> stat.flyOneCm when over 25 cm; no exhaustion
// The distances are MathHelper.sqrt_double (a float) times 100.0F, rounded with Math.round(float); each stat and charge needs cm > 0.
const f32 = Math.fround;
// A move longer than this in one tick is a teleport (portal, respawn, /tp, ender pearl): vanilla never reports one as movement (no stat, no exhaustion).
export const TELEPORT_SQUARED = 100;
const SWIM = f32(0.015), WALK = f32(0.01), SPRINT = f32(0.099999994), CM = f32(0.01);
const length = (x, y, z) => f32(Math.sqrt(x * x + y * y + z * z));
const round = (v) => Math.floor(v + 0.5);
const centimetres = (x, y, z) => round(f32(length(x, y, z) * 100));
const charge = (factor, cm) => f32(f32(factor * cm) * CM);

// { stat: 'dive'|'swim'|'climb'|'walk'|'fly'|null, amount, exhaustion } for a move of (dx, dy, dz) and the state it left.
export function movementStat({ dx, dy, dz, dive = false, swim = false, ladder = false, ground = false, sprinting = false, riding = false }) {
  const none = { stat: null, amount: 0, exhaustion: 0 };
  if (riding) return none;
  if (dive) { const cm = centimetres(dx, dy, dz); return cm > 0 ? { stat: "dive", amount: cm, exhaustion: charge(SWIM, cm) } : none; }
  if (swim) { const cm = centimetres(dx, 0, dz); return cm > 0 ? { stat: "swim", amount: cm, exhaustion: charge(SWIM, cm) } : none; }
  if (ladder) return dy > 0 ? { stat: "climb", amount: round(dy * 100), exhaustion: 0 } : none;
  if (ground) { const cm = centimetres(dx, 0, dz); return cm > 0 ? { stat: "walk", amount: cm, exhaustion: charge(sprinting ? SPRINT : WALK, cm) } : none; }
  const cm = centimetres(dx, 0, dz);
  return cm > 25 ? { stat: "fly", amount: cm, exhaustion: 0 } : none;
}
export const movementExhaustion = (move) => movementStat(move).exhaustion;
// yz.l: the 3-D distance, for the vehicle's class.
export const mountedCentimetres = (dx, dy, dz) => centimetres(dx, dy, dz);
