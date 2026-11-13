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
// The copy's own rearing amount is its client animation (stepHorseAnim) of the synced flag 64, not the live horse's.
export function copySeat(c, live) {
  if (!c) return null;
  if (live.type === "pig") return { x: c.x, y: c.y + PIG_MOUNTED_OFFSET - 0.5, z: c.z };
  const r = rearSeat(c.horse?.rearAmount ?? 0, c.renderYawOffset);
  return { x: c.x + r.dx, y: c.y + mountedOffset({ age: live.growingAge ?? 0 }) - 0.5 + r.dy, z: c.z + r.dz };
}

// wi.ac(): the rearing horse's rider shifts 0.7 * bM back along the body yaw and rises 0.15 * bM (bytecode-read; zero when not rearing).
export function rearSeat(rearAmount, bodyYaw) {
  if (!rearAmount) return { dx: 0, dy: 0, dz: 0 };
  const bM = f(rearAmount), shift = f(f(0.7) * bM), a = f(f(bodyYaw * f(Math.PI)) / f(180));
  return { dx: f(shift * mhSin(a)), dy: f(f(0.15) * bM), dz: -f(shift * mhCos(a)) };
}

// Batch 55: EntityHorse's animation counters (wi.h(), onUpdate; executed in horse-rear-reference.json `anim`: the copy's own h() on a client world with only watcher 16 written).
// Watcher 16 bits (wi.x(I), cc/cg/co/cm/cn): 2 tame, 4 saddled, 8 chest, 16 bred, 32 eating (cm), 64 rearing (cn), 128 mouth open. The animation reads only 32, 64 and 128.
export const HORSE_EATING = 32, HORSE_REARING = 64, HORSE_MOUTH = 128;
// The watcher value of a live horse mob (what the server's DataWatcher holds; the tracker sends it to the client copy).
export function horseFlagsOf(e) {
  const h = e.horse ?? {};
  return (h.tame ? 2 : 0) | (h.saddled ? 4 : 0) | (h.chested ? 8 : 0) | (h.bred ? 16 : 0) | (h.eating ? HORSE_EATING : 0) | (e.rearing ? HORSE_REARING : 0) | (e.mouthTicks > 0 ? HORSE_MOUTH : 0);
}
// The animation fields of one horse object (the client copy's, or the live horse's own): bJ/bK head lean, bL/bM rearing amount, bN/bO mouth openness, and the tail (bp) and bq counters.
export const newHorseAnim = () => ({ headLean: 0, prevHeadLean: 0, rearAmount: 0, prevRearAmount: 0, mouth: 0, prevMouth: 0, tail: 0, counter: 0, flags: 0 });
// The animation half of wi.h(), after the super call: float arithmetic in the bytecode's operation order. `a.flags` is the watcher value the object holds.
export function stepHorseAnim(a) {
  const flags = a.flags | 0;
  if (a.tail > 0) { a.tail++; if (a.tail > 8) a.tail = 0; } // bp, started by the tail roll (wi.cR), ends above 8
  if (a.counter > 0) { a.counter++; if (a.counter > 300) a.counter = 0; } // bq: only ever started elsewhere
  a.prevHeadLean = a.headLean;
  if (flags & HORSE_EATING) { a.headLean = f(a.headLean + f(f(f(1 - a.headLean) * f(0.4)) + f(0.05))); if (a.headLean > 1) a.headLean = 1; }
  else { a.headLean = f(a.headLean + f(f(f(0 - a.headLean) * f(0.4)) - f(0.05))); if (a.headLean < 0) a.headLean = 0; }
  a.prevRearAmount = a.rearAmount;
  if (flags & HORSE_REARING) { // a rearing horse's head lean is zeroed (both the value and its previous one)
    a.prevHeadLean = a.headLean = 0;
    a.rearAmount = f(a.rearAmount + f(f(f(1 - a.rearAmount) * f(0.4)) + f(0.05))); if (a.rearAmount > 1) a.rearAmount = 1;
  } else {
    const r = a.rearAmount;
    const cube = f(f(f(f(0.8) * r) * r) * r); // 0.8F * bL * bL * bL
    a.rearAmount = f(r + f(f(f(cube - r) * f(0.6)) - f(0.05)));
    if (a.rearAmount < 0) a.rearAmount = 0;
  }
  a.prevMouth = a.mouth;
  if (flags & HORSE_MOUTH) { a.mouth = f(a.mouth + f(f(f(1 - a.mouth) * f(0.7)) + f(0.05))); if (a.mouth > 1) a.mouth = 1; }
  else { a.mouth = f(a.mouth + f(f(f(0 - a.mouth) * f(0.7)) - f(0.05))); if (a.mouth < 0) a.mouth = 0; }
}
// wi.e(), before EntityAnimal's: nextInt(200) == 0 starts the tail swish (wi.cR sets bp = 1); both sides draw it, from the entity's own Random.
export function horseTailRoll(a, rand) { if (rand.nextInt(200) === 0) a.tail = 1; }
// wi.p / q / r (partial ticks) for the renderer: head lean, rearing amount, mouth openness.
export const horseLean = (a, t) => f(a.prevHeadLean + f(f(a.headLean - a.prevHeadLean) * t));
export const horseRear = (a, t) => f(a.prevRearAmount + f(f(a.rearAmount - a.prevRearAmount) * t));
export const horseMouth = (a, t) => f(a.prevMouth + f(f(a.mouth - a.prevMouth) * t));
