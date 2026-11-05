// EntityWither (xc) and EntityWitherSkull (zp): the pure rules (head positions, head tracking, the chase push, the spawn-time
// invulnerability, the skull's explosion resistance cap, the render choices and the boss bar numbers). Bytecode-derived from the unchanged
// 1.7.10 classes and replayed against public/research/wither-boss-reference.json (tools/probes/WitherBossProbe.java). The engine wiring is
// wither-boss-mobs.js, the model wither-boss-renderer.js, the bar boss-bar.js.
import { WITHER, witherSkullEffectTicks } from "./wither-rules.js";
const f = Math.fround, DEG = 180 / Math.PI;
export { WITHER, witherSkullEffectTicks };
// Entity eye height of the wither: EntityLivingBase.getEyeHeight = height * 0.85.
export const WITHER_EYE = f(f(WITHER.height) * f(0.85));
export const wrapDegrees = (a) => { a %= 360; if (a >= 180) a -= 360; if (a < -180) a += 360; return a; };
// xc.b(a, b, max): move `a` towards `b` by at most `max` degrees.
export function approachAngle(a, b, max) {
  let d = wrapDegrees(b - a);
  if (d > max) d = max;
  if (d < -max) d = -max;
  return a + d;
}
// xc.u/v/w(head): head 0 is above the body; heads 1 and 2 sit 1.3 blocks to the sides at 2.2 (renderYawOffset turns them).
export function headPosition(e, head, bodyYaw = e.renderYawOffset ?? e.rotationYaw ?? 0) {
  if (head <= 0) return { x: e.x, y: e.y + 3, z: e.z };
  const a = f(f(f(bodyYaw + f(180 * (head - 1))) / 180) * f(Math.PI));
  return { x: e.x + Math.cos(a) * 1.3, y: e.y + 2.2, z: e.z + Math.sin(a) * 1.3 };
}
// xc.e (onLivingUpdate) before the walk: motionY *= 0.6, then, with a head 0 target, the climb towards it (hover 5 blocks above while
// unarmoured) and the horizontal pull while more than 3 blocks away; yaw follows the motion when it is fast enough.
export function chase(e, target, armored) {
  e.vy *= f(0.6);
  if (target) {
    if (e.y < target.y || (!armored && e.y < target.y + 5)) {
      if (e.vy < 0) e.vy = 0;
      e.vy += (0.5 - e.vy) * f(0.6);
    }
    const dx = target.x - e.x, dz = target.z - e.z, d = dx * dx + dz * dz;
    if (d > 9) {
      const s = f(Math.sqrt(d));
      e.vx += (dx / s * 0.5 - e.vx) * f(0.6);
      e.vz += (dz / s * 0.5 - e.vz) * f(0.6);
    }
  }
  if (e.vx * e.vx + e.vz * e.vz > 0.05) e.rotationYaw = f(f(Math.atan2(e.vz, e.vx) * f(57.295776)) - 90);
}
// xc.e after super.e: a side head turns towards its target (pitch 40, yaw 10 degrees a tick) or back to the body.
export function trackHead(e, head, target, bodyYaw) {
  const s = (e.headYaw ??= [0, 0]), p = (e.headPitch ??= [0, 0]), i = head - 1;
  e.prevHeadYaw = [...s]; e.prevHeadPitch = [...p];
  if (target) {
    const h = headPosition(e, head, bodyYaw), dx = target.x - h.x, dy = target.y + (target.eyeHeight ?? 1.62) - h.y, dz = target.z - h.z, dh = f(Math.sqrt(dx * dx + dz * dz));
    const yaw = f(f(Math.atan2(dz, dx) * 180 / Math.PI) - 90), pitch = f(-f(Math.atan2(dy, dh) * 180 / Math.PI));
    p[i] = approachAngle(p[i], pitch, 40);
    s[i] = approachAngle(s[i], yaw, 10);
  } else s[i] = approachAngle(s[i], bodyYaw, 10);
}
// xc.bn: the invulnerable spawn tick. Returns the new Invul, whether the explosion fires now and the heal of this tick.
export function invulStep(invul, ticksExisted) {
  const next = invul - 1;
  return { invul: next, explode: next <= 0, heal: ticksExisted % 10 === 0 ? 10 : 0 };
}
export const startHealth = () => f(WITHER.maxHealth / 3);
// xc.cb: armoured at or below half health.
export const armored = (health) => health <= WITHER.maxHealth / 2;
// zp.a(Explosion, World, x, y, z, Block): an invulnerable (blue) skull caps a block's resistance at 0.8, bedrock, end portal, end portal
// frame and command block keep the real one (`proof`: the block is one of WITHER_PROOF_IDS / WITHER_PROOF_INTERNAL).
export const WITHER_PROOF_IDS = Object.freeze([7, 119, 120, 137]);
export const WITHER_PROOF_INTERNAL = Object.freeze([11, 149, 104, 139]); // the same four as this build's block ids
export function skullResistance(charged, proof, resistance) {
  return charged && !proof ? Math.min(f(0.8), resistance) : resistance;
}
// zp: motion factor 0.73 when blue, else EntityFireball's 0.95; the box is 0.3125.
export const SKULL = Object.freeze({ size: 0.3125, factorBlue: f(0.73), factor: f(0.95), power: 1 });
// bpc: the texture and scale for the spawn phase. wither.png when not invulnerable, or in the last 80 ticks on every other 5 tick block.
export function witherTexture(invul) {
  return invul <= 0 || (invul <= 80 && Math.trunc(invul / 5) % 2 === 1) ? "wither" : "wither_invulnerable";
}
export const witherScale = (invul) => (invul > 0 ? f(2 - f(f(invul / 220) * f(0.5))) : 2);
// bln / bbv.d: the boss bar: fill width (int)(health / max * 183) of 182, the status counter that fades it, the name.
export const bossFill = (health, max) => Math.trunc(f(f(health) / f(max)) * 183);
