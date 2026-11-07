// EntityWither (xc) and EntityWitherSkull (zp): the pure rules (head positions, head tracking, the chase push, the spawn-time
// invulnerability, the skull's explosion resistance cap, the render choices and the boss bar numbers). Bytecode-derived from the unchanged
// 1.7.10 classes and replayed against public/research/wither-boss-reference.json (tools/probes/WitherBossProbe.java). The engine wiring is
// wither-boss-mobs.js, the model wither-boss-renderer.js, the bar boss-bar.js.
import { WITHER, witherSkullEffectTicks } from "./wither-rules.js";
import { mhSin, mhCos } from "./lighting.js";
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
// xc.u/v/w(head): head 0 is above the body; heads 1 and 2 sit 1.3 blocks to the sides at 2.2 (renderYawOffset turns them). The angle goes
// through MathHelper's sine table (qh.a / qh.b), which differs from Math.sin/cos by up to ~5e-5 blocks (found by the particle replay).
export function headPosition(e, head, bodyYaw = e.renderYawOffset ?? e.rotationYaw ?? 0) {
  if (head <= 0) return { x: e.x, y: e.y + 3, z: e.z };
  const a = f(f(f(bodyYaw + f(180 * (head - 1))) / 180) * f(Math.PI));
  return { x: e.x + mhCos(a) * 1.3, y: e.y + 2.2, z: e.z + mhSin(a) * 1.3 };
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
// xc.e's tail, the particles of the client copy: per head a gaussian (0.3) smoke puff, then (armoured only) one world-Random nextInt(4) roll
// and on 0 a "mobSpell" there; then, while Invul > 0, three bluish "mobSpell" around the body. `z` is the entity Random (Entity.Z), `w` the
// world Random (ahb.s). Draw order is the native one (x, y, z gaussians in turn). Replayed against wither-targets-reference.json.
export function headParticleSpecs(e, z, w) {
  const out = [], g = () => z.nextGaussian() * f(0.3), arm = armored(e.health);
  for (let i = 0; i < 3; i++) {
    const h = headPosition(e, i);
    out.push(["smoke", h.x + g(), h.y + g(), h.z + g(), 0, 0, 0]);
    if (arm && w.nextInt(4) === 0) out.push(["mobSpell", h.x + g(), h.y + g(), h.z + g(), f(0.7), f(0.7), 0.5]);
  }
  if ((e.invul ?? 0) > 0) for (let i = 0; i < 3; i++) out.push(["mobSpell", e.x + z.nextGaussian(), e.y + f(z.nextFloat() * f(3.3)), e.z + z.nextGaussian(), f(0.7), f(0.7), f(0.9)]);
  return out;
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
// ModelWither (bin) pose: boxes are in the renderer; this is bin.a(F x6, sa) (setRotationAngles) and bin.a(sv, F x3) (setLivingAnimations)
// as ModelRenderer point (px) and angles (radians, float), replayed against wither-model-reference.json. `age` is ticksExisted + partial,
// headYaw / headPitch the render arguments (degrees, relative to the body for yaw), `bodyYaw` the current renderYawOffset and `sideYaw` /
// `sidePitch` the entity's tracked side head angles (xc.a(i) / xc.c(i): NOT interpolated and not wrapped). The tail's point follows the spine's nod.
const MODEL_DEG = f(57.295776);
export function witherPose({ age, headYaw, headPitch, bodyYaw, sideYaw = [0, 0], sidePitch = [0, 0] }) {
  const c = mhCos(f(age * f(0.1))), spineX = f(f(f(0.065) + f(f(0.05) * c)) * f(Math.PI));
  return {
    shoulders: { point: [0, 0, 0], rot: [0, 0, 0] },
    spine: { point: [-2, f(6.9), f(-0.5)], rot: [spineX, 0, 0] },
    tail: { point: [-2, f(f(6.9) + f(mhCos(spineX) * 10)), f(f(-0.5) + f(mhSin(spineX) * 10))], rot: [f(f(f(0.265) + f(f(0.1) * c)) * f(Math.PI)), 0, 0] },
    head0: { point: [0, 0, 0], rot: [f(headPitch / MODEL_DEG), f(headYaw / MODEL_DEG), 0] },
    head1: { point: [-8, 4, 0], rot: [f(sidePitch[0] / MODEL_DEG), f(f(sideYaw[0] - bodyYaw) / MODEL_DEG), 0] },
    head2: { point: [10, 4, 0], rot: [f(sidePitch[1] / MODEL_DEG), f(f(sideYaw[1] - bodyYaw) / MODEL_DEG), 0] },
  };
}
// ModelRenderer.render's matrix: translate(point / 16), then rotate Z, Y, X (GL column-major).
export function partMatrix({ point, rot: [rx, ry, rz] }) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  // R = Rz * Ry * Rx
  const m = [
    cz * cy, sz * cy, -sy, 0,
    cz * sy * sx - sz * cx, sz * sy * sx + cz * cx, cy * sx, 0,
    cz * sy * cx + sz * sx, sz * sy * cx - cz * sx, cy * cx, 0,
    point[0] / 16, point[1] / 16, point[2] / 16, 1,
  ];
  return m;
}
// bpc.a(xc, F): glScalef(s, s, s) with s = 2 - (Invul - partial) / 220 * 0.5 while Invul > 0, else 2.
export const witherScalePartial = (invul, partial = 0) => (invul > 0 ? f(2 - f(f(f(invul - partial) / 220) * f(0.5))) : 2);
// bpc.a(xc, int, F) pass 1 (cb(): health <= 150, also while Invul > 0): the same ModelWither again with the invulnerable skin scrolled by
// (cos(age * 0.02) * 3, age * 0.01), colour 0.5, blend ONE/ONE, lighting off, glTranslatef(0, -0.01, 0) then glScalef(1.1) in model space.
export const WITHER_ARMOR_PASS = Object.freeze({ color: 0.5, translateY: -0.01, scale: f(1.1) });
export const armorScroll = (age) => [f(mhCos(f(age * f(0.02))) * 3), f(age * f(0.01))];
// bpc: the texture and scale for the spawn phase. wither.png when not invulnerable, or in the last 80 ticks on every other 5 tick block.
export function witherTexture(invul) {
  return invul <= 0 || (invul <= 80 && Math.trunc(invul / 5) % 2 === 1) ? "wither" : "wither_invulnerable";
}
export const witherScale = (invul) => (invul > 0 ? f(2 - f(f(invul / 220) * f(0.5))) : 2);
// bln / bbv.d: the boss bar: fill width (int)(health / max * 183) of 182, the status counter that fades it, the name.
export const bossFill = (health, max) => Math.trunc(f(f(health) / f(max)) * 183);
