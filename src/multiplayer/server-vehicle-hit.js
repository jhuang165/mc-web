// Batch 75 mpusesweep75: the sprint push of a hit on a minecart or boat (EntityPlayer.attackTargetEntityWithCurrentItem on a non-living entity: EntityMinecart / EntityBoat
// .attackEntityFrom is always true, so a sprinting attacker adds velocity to it, its own motion x 0.6 and sprinting off). The sweep of left clicks found the server skipped it;
// the rule is structure-simulation.js useMinecart / useBoat (copied line for line, those functions need a whole browser state).
import { mhSin, mhCos } from '../lighting.js';

const f = Math.fround;

export function vehicleSprintPush(p, v) {
  if (!p.motion?.sprinting) return false;
  const rad = f(f(f(180 - p.yaw * (180 / Math.PI)) * f(Math.PI)) / 180);
  v.vx += f(f(-mhSin(rad) * 1) * 0.5);
  v.vy += 0.1;
  v.vz += f(f(mhCos(rad) * 1) * 0.5);
  if (p.velocity) { p.velocity.x *= 0.6; p.velocity.z *= 0.6; }
  p.motion.sprinting = false;
  return true;
}
