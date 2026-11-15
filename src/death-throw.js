// EntityPlayer.onDeath (yz.a(ro), bytecode-read b74): after the inventory drop the player gets motionY 0.10000000149011612 and
//   motionX = -cos((attackedAtYaw + rotationYaw) * PI / 180) * 0.1, motionZ = -sin(...) * 0.1   (source != null; else 0, 0).
// EntityLivingBase.attackEntityFrom (sv.a(ro, F)) sets attackedAtYaw = 0 on every call, then for a fresh hit: the source's entity gives
// (float) atan2(dz, dx) * 180 / PI - rotationYaw (the angle towards the attacker), no entity gives (int)(Math.random() * 2) * 180.
// The server's motion reaches the client player by S12 (velocityChanged from setBeenAttacked), packed as (int)(m * 8000) / 8000.
// Angles here are Java degrees; the port's yaw is PI - yaw of it.
import { mhSin, mhCos } from "./lighting.js";
const f = Math.fround;

// Called by Survival.damage on every landed hit. `from` is the DamageSource entity's {x, z} (or null). Survival does not know the
// player's position, so the angle is taken in deathThrow from the position at death (the same tick in practice).
export function attackedAtOf(fresh, from, random = Math.random) {
  if (!fresh) return { rel: 0 }; // attackedAtYaw = 0 inside the hurt window
  if (from && Number.isFinite(from.x) && Number.isFinite(from.z)) return { from: { x: from.x, z: from.z } };
  return { rel: Math.trunc(random() * 2) * 180 };
}

// The client player's motion after the death. `at` is the player's {x, z}, `yawDeg` the server player's rotationYaw in Java degrees.
export function deathThrow(attackedAt, at, yawDeg, random = Math.random) {
  let sum;
  if (attackedAt?.from) {
    let dx = attackedAt.from.x - at.x, dz = attackedAt.from.z - at.z;
    while (dx * dx + dz * dz < 1e-4) { dx = (random() - random()) * 0.01; dz = (random() - random()) * 0.01; } // the coincident nudge
    const az = f(f((Math.atan2(dz, dx) * 180) / Math.PI) - f(yawDeg));
    sum = f(az + f(yawDeg));
  } else sum = f(f(attackedAt?.rel ?? 0) + f(yawDeg));
  const rad = f(f(sum * f(Math.PI)) / 180);
  const s8000 = (v) => Math.trunc(v * 8000) / 8000;
  return { x: s8000(f(f(-mhCos(rad)) * 0.1)), y: s8000(0.10000000149011612), z: s8000(f(f(-mhSin(rad)) * 0.1)) };
}
