// The player's cape and the deadmau5 ears (batch 70 playerrender70), 1.7.10.
//
// Bytecode-read: EntityPlayer.onUpdate (yz.h) chasing position, EntityPlayer.onLivingUpdate (yz.e) and
// EntityOtherPlayerMP.onLivingUpdate (bll.e) cameraYaw, Entity.moveEntity (sa.d) distanceWalkedModified,
// RenderPlayer.renderSpecials (bop.a(blg, float)) ears and cape, ModelBiped (bhm) bipedCloak (k) and bipedEars (j),
// AbstractClientPlayer (blg) n() = cape texture present, o() = skin texture present, EntityPlayer.getHideCape (yz.bT, metadata 16 bit 1;
// EntityPlayerMP sets it from `!C15PacketClientSettings.showCape`).
import { mhSin, mhCos } from "./lighting.js";

const f = Math.fround, RAD = Math.PI / 180;

// ModelBiped constructor: bipedCloak = ModelRenderer(0, 0), box(-5, 0, -1, 10, 16, 1, f); bipedEars = ModelRenderer(24, 0),
// box(-3, -6, -1, 6, 6, 1, f). RenderPlayer builds ModelBiped(0.0F), so both have no extra expansion.
export const CLOAK_BOX = Object.freeze({ uv: [0, 0], box: [-5, 0, -1, 10, 16, 1] });
export const EARS_BOX = Object.freeze({ uv: [24, 0], box: [-3, -6, -1, 6, 6, 1] });
// RenderPlayer.renderSpecials: glTranslatef(0, 0, 0.125) before the cape's rotations.
export const CLOAK_OFFSET_Z = 0.125;
// RenderPlayer: the ears' scale and the lateral offset of each ear (0.375 * (2 i - 1)), then glTranslatef(0, -0.375, 0).
export const EARS_SCALE = f(1.3333334), EARS_SPREAD = f(0.375), EARS_LIFT = -f(0.375);

// The fields EntityPlayer keeps for the cape. `chase` is (field_71091_bM.. prev, bx.. current) chasingPos, `camera` is
// prevCameraYaw / cameraYaw, `walked` is prevDistanceWalkedModified / distanceWalkedModified.
export function newCapeState(position) {
  return {
    chase: { x: position.x, y: position.y, z: position.z, px: position.x, py: position.y, pz: position.z },
    prevCameraYaw: 0, cameraYaw: 0, prevWalked: 0, walked: 0,
  };
}

// EntityPlayer.onUpdate tail (yz.h 274..500): prevChasing = chasing; d = pos - chasing; a difference beyond 10 snaps both the
// chasing and previous chasing coordinate to the position (x, then z, then y for > 10; the same order for < -10);
// finally chasing += d * 0.25 using the differences taken before any snap.
export function chaseStep(chase, pos) {
  chase.px = chase.x; chase.py = chase.y; chase.pz = chase.z;
  const d0 = pos.x - chase.x, d1 = pos.y - chase.y, d2 = pos.z - chase.z;
  if (d0 > 10) chase.x = chase.px = pos.x;
  if (d2 > 10) chase.z = chase.pz = pos.z;
  if (d1 > 10) chase.y = chase.py = pos.y;
  if (d0 < -10) chase.x = chase.px = pos.x;
  if (d2 < -10) chase.z = chase.pz = pos.z;
  if (d1 < -10) chase.y = chase.py = pos.y;
  chase.x += d0 * 0.25; chase.z += d2 * 0.25; chase.y += d1 * 0.25;
}

// onLivingUpdate's cameraYaw (the first-person view bob also reads it): `motion` is the entity's motionX/Y/Z, or null for
// EntityOtherPlayerMP, whose motion fields stay 0 (its position is set from packets, the tracker sends no velocity for players).
export function cameraYawStep(state, motion, onGround = true) {
  state.prevCameraYaw = state.cameraYaw;
  let v = f(Math.sqrt((motion?.x ?? 0) * (motion?.x ?? 0) + (motion?.z ?? 0) * (motion?.z ?? 0)));
  if (v > f(0.1)) v = f(0.1);
  if (!onGround) v = 0;
  state.cameraYaw = f(state.cameraYaw + f(f(v - state.cameraYaw) * f(0.4)));
}

// Entity.moveEntity (sa.d 1665): while the entity is not riding, distanceWalkedModified += float(sqrt(dx^2 + dz^2)) * 0.6, dx/dz
// being the position change of the move. Entity.onEntityUpdate copies it to prevDistanceWalkedModified first. A moveEntity-less
// entity (EntityOtherPlayerMP) keeps 0.
export function walkedStep(state, delta) {
  state.prevWalked = state.walked;
  if (delta) state.walked = f(state.walked + f(Math.sqrt(delta.x * delta.x + delta.z * delta.z)) * 0.6); // (float)((double)P + (double)sqrtF * 0.6)
}

// One 20 Hz tick, in native order (living update, then the chasing step at the end of onUpdate). `motion` is
// { x, y, z, onGround, walked: { x, z } | null } for the locally simulated player and null for a remote one.
export function capeTick(state, { position, motion = null, riding = false, frozen = false, delta = null }) {
  if (motion) cameraYawStep(state, motion, motion.onGround !== false); else cameraYawStep(state, null, true);
  walkedStep(state, motion && !riding && !frozen ? delta : null);
  chaseStep(state.chase, position);
}

// RenderPlayer.renderSpecials cape part (bop.a 436..826): the three rotations applied after translate(0, 0, 0.125), in degrees.
// `at` is the interpolated entity position (lastTickPos + (pos - lastTickPos) * partial); `bodyYaw` the interpolated
// renderYawOffset. Returns the glRotatef angles: x about X, z about Z and the Y turn (-f14 / 2 + 180).
export function capeAngles(state, { at, bodyYaw, partial, sneak = false }) {
  const p = f(partial), c = state.chase;
  const d0 = c.px + (c.x - c.px) * p - at.x, d1 = c.py + (c.y - c.py) * p - at.y, d2 = c.pz + (c.z - c.pz) * p - at.z;
  const rad = f(f(bodyYaw * f(3.1415927)) / 180), s = mhSin(rad), co = -mhCos(rad);
  let f12 = f(f(d1) * 10);
  if (f12 < -6) f12 = -6;
  if (f12 > 32) f12 = 32;
  let f13 = f(f(d0 * s + d2 * co) * 100);
  const f14 = f(f(d0 * co - d2 * s) * 100);
  if (f13 < 0) f13 = 0;
  const camera = f(state.prevCameraYaw + f(f(state.cameraYaw - state.prevCameraYaw) * p));
  const walk = f(state.prevWalked + f(f(state.walked - state.prevWalked) * p));
  f12 = f(f12 + f(f(mhSin(f(walk * 6)) * 32) * camera));
  if (sneak) f12 = f(f12 + 25);
  return { x: f(f(6 + f(f13 / 2)) + f12), z: f(f14 / 2), y: f(180 - f(f14 / 2)) };
}

// The cloak is drawn only for a loaded cape texture on a player who is neither invisible nor hiding it (bop.a 430..441:
// n() && !isInvisible() && !getHideCape()).
export const capeVisible = ({ hasCape, invisible = false, hideCape = false }) => !!hasCape && !invisible && !hideCape;

// The ears: the name is compared exactly and the skin texture must be present (o()). They follow neither invisibility nor sneaking.
export const earsVisible = ({ name, hasSkin }) => name === "deadmau5" && !!hasSkin;

// The transform chain of one ear (bop.a 281..421), as three.js Euler angles in radians. `headYaw` is rotationYaw - renderYawOffset
// (degrees, interpolated) and `headPitch` rotationPitch. First glRotatef(yaw, Y) then glRotatef(pitch, X), the translation, then
// the opposite rotations (X, then Y) and the scale. `side` is 0 or 1 (the 0.375 * (2 side - 1) offset).
export function earTransform(headYaw, headPitch, side) {
  return {
    outer: { y: headYaw * RAD, x: headPitch * RAD },
    position: [f(EARS_SPREAD * (side * 2 - 1)), EARS_LIFT, 0],
    inner: { x: -headPitch * RAD, y: -headYaw * RAD },
    scale: EARS_SCALE,
  };
}
