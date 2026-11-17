// b78 mphorseview78: what a viewer draws of a remote rider, and of the horse in the horse window.
// Bytecode-read (1.7.10 jar): RendererLivingEntity.doRender (boh.a(sv,DDDFF)): for a rider whose ridingEntity is an EntityLivingBase (a pig or horse; boats and carts are not)
//   f4 = interpolateRotation(mount.prevRenderYawOffset, mount.renderYawOffset, partial); f5 = wrapAngleTo180(rotationYawHead(interp) - f4) clamped to +-85;
//   renderYawOffset(drawn) = head - f5, and + f5 * 0.2 when f5 * f5 > 2500. The rider's own renderYawOffset is not used while riding such a mount.
// ModelBiped.isRiding (arms -PI/5, legs -2PI/5 with y +-PI/10) is bipedPose's `riding` branch in player-renderer.js; the seat is client-ride-seat.js mountSeat (feet at mount seat + getYOffset -0.5).
import { interpolateRotation, wrapDegrees } from '../entities.js';

const f = Math.fround;

// `head`: the rider's interpolated head yaw, `mountBody`: the mount's interpolated renderYawOffset (both Java degrees).
// Returns the body yaw to draw and the head yaw relative to it (what ModelBiped turns the head by).
export function riderYaws(head, mountBody) {
  let d = wrapDegrees(f(head - mountBody));
  d = Math.min(Math.max(d, -85), 85);
  let body = f(head - d);
  if (d * d > 2500) body = f(body + f(d * f(0.2)));
  return { body, head: f(head - body) };
}

// The attached mount's interpolated renderYawOffset for a players row's seat key ('m<wire id>': pig or horse copy), or null for a boat, cart or unknown mount.
export function mountBodyYaw(key, mobs, partial) {
  if (typeof key !== 'string' || key[0] !== 'm') return null;
  const c = mobs?.copies?.get(Number(key.slice(1))) ?? mobs?.copies?.get(key.slice(1));
  const k = c?.client;
  if (!k || typeof k.renderYawOffset !== 'number') return null;
  return interpolateRotation(k.prevRenderYawOffset ?? k.renderYawOffset, k.renderYawOffset, partial);
}

// The pose of a PlayerRenderer.update pose (mobPose result) after the riding clamp; `mountBody` null leaves it unchanged.
export function ridingPose(pose, mountBody) {
  if (mountBody === null || mountBody === undefined) return pose;
  const head = f(pose.bodyYaw + pose.headYaw), r = riderYaws(head, mountBody);
  return { ...pose, bodyYaw: r.body, headYaw: r.head };
}

// GuiScreenHorseInventory shows the client's own EntityHorse (world.getEntityByID(S2D horse id)); the wire window only knows type / chested / tame, so the look
// (variant, armour, saddle, foal) comes from the copy's stand-in. `base` is the window's horse state, `mobs` RemoteMobs; the stacks (S30) later refresh saddle and armour via syncGear.
export function previewHorse(base, mobs) {
  const c = mobs?.copies?.get(Number(base.id)) ?? mobs?.copies?.get(String(base.id)), mob = c?.mob;
  if (!mob || mob.type !== 'horse') return base;
  const live = mob.horse ?? {};
  return { ...base, variant: live.variant, armor: live.armor ?? base.armor ?? 0, saddled: !!live.saddled, age: mob.growingAge ?? 0 };
}
