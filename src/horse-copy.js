// Batch 54: the client copy of a mount the local player rides (EntityHorse, EntityPig).
// Bytecode-read (wi.e(FF), wi.ac(), sa.a(sa), yz.a(sa), mw.a(sa), sv.m(sa), nh's C0B handler):
// - wi.e(FF) (EntityHorse.moveEntityWithHeading) with a rider that is an EntityLivingBase and a saddle (cu()): prevRotationYaw (A) = rotationYaw (y) = rider.rotationYaw,
//   rotationPitch (z) = rider.rotationPitch * 0.5F, setRotation(y, z) (each % 360.0F), then renderYawOffset (aM) = rotationYawHead (aO) = the new rotationYaw. The movement
//   below it (setAIMoveSpeed, EntityLiving.moveEntityWithHeading with the rider's moveForward / moveStrafing) is wrapped in `if (!worldObj.isRemote)`, and the jump
//   (jumpPower bt > 0 sets motionY) only runs with a jump power that wi.w(I) writes, which only the server's C0B handler (nh) calls. So the client copy of a ridden saddled horse
//   does not move or jump on its own: its position is the packets' (S14 / S18 / S12 interpolation), and only its angles follow the rider. The earlier note that the client
//   "steers and jumps" the horse was wrong about the motion.
// - wi.ac() (updateRiderPosition): with rearing amount bM > 0 the rider is set at x + 0.7 * bM * sin(aM), y + ae() + rider.ad() + 0.15 * bM, z - 0.7 * bM * cos(aM).
// - Mounting: mw.a(sa) sends S1B then S08 with the server player's position. Nothing moves the player on a mount (sa.a(sa) with a mount only links the two), so the visible
//   jump is the first updateRiderPosition. Dismounting: yz.a(null) runs EntityLivingBase.dismountEntity (sv.m, server only), which puts the server player on the first
//   clear spot beside the mount (or on top of it), S08 carries that spot to the client, so the client player jumps from the copy's seat to it. See dismountSpot in minecarts.js.
import { mhSin, mhCos } from "./lighting.js";
import { mountedOffset } from "./horse.js";
import { PIG_MOUNTED_OFFSET } from "./pig-saddle.js";

const f = Math.fround;
const wrap = (v) => f(v % 360); // Java float %

// Whether the copy of this live mob is steered by its rider (the saddled horse the local player rides).
export const copySteered = (e) => e.type === "horse" && !!e.rider && !!e.horse?.saddled;

// The rider branch of wi.e(FF) on the client copy. `look` is the local player's { yaw, pitch } in native degrees.
export function steerHorseCopy(c, look) {
  if (!look) return;
  c.prevRotationYaw = f(look.yaw);
  c.rotationYaw = wrap(look.yaw);
  c.rotationPitch = wrap(f(look.pitch * f(0.5)));
  c.renderYawOffset = c.rotationYawHead = c.rotationYaw;
}

// Entity.updateRiderPosition for the player's feet (the seat minus the player's 0.5 yOffset), from the client copy of a horse or pig.
// The copy's own rearing amount is its client animation of the synced rear flag; the live horse's amount stands in for it (equal but for the watcher's delay).
export function copySeat(c, live) {
  if (!c) return null;
  if (live.type === "pig") return { x: c.x, y: c.y + PIG_MOUNTED_OFFSET - 0.5, z: c.z };
  const r = rearSeat(live.rearAmount, c.renderYawOffset);
  return { x: c.x + r.dx, y: c.y + mountedOffset({ age: live.growingAge ?? 0 }) - 0.5 + r.dy, z: c.z + r.dz };
}

// wi.ac(): the rearing horse's rider shifts 0.7 * bM back along the body yaw and rises 0.15 * bM (bytecode-read; zero when not rearing).
export function rearSeat(rearAmount, bodyYaw) {
  if (!rearAmount) return { dx: 0, dy: 0, dz: 0 };
  const bM = f(rearAmount), shift = f(f(0.7) * bM), a = f(f(bodyYaw * f(Math.PI)) / f(180));
  return { dx: f(shift * mhSin(a)), dy: f(f(0.15) * bM), dz: -f(shift * mhCos(a)) };
}
