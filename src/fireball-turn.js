// EntityFireball.onUpdate's turn toward its flight (ze.h, bytecode-read; the wither skull zp inherits it) and RenderWitherSkull's (bpd)
// rotation interpolation, in Java float arithmetic. Batch 80 renderfx80; the render half is executed in public/research/renderfx80-reference.json.
const f = Math.fround, PI_F = 3.1415927410125732;

// After posX/Y/Z += motion (and before the acceleration): yaw and pitch of the motion, the previous values brought within 180 degrees
// (the prev fields themselves move by 360, as Java writes them back), then 1/5 of the way there. `e` keeps yaw, pitch, prevYaw, prevPitch
// (Entity.rotationYaw / rotationPitch / prevRotationYaw / prevRotationPitch); the prev pair was set from the current pair at the start
// of the tick (Entity.onEntityUpdate).
export function fireballTurn(e, mx, my, mz) {
  const horizontal = f(Math.sqrt(mx * mx + mz * mz));
  let yaw = f(f((Math.atan2(mz, mx) * 180) / PI_F) + 90), pitch = f(f((Math.atan2(horizontal, my) * 180) / PI_F) - 90);
  let prevPitch = f(e.prevPitch ?? 0), prevYaw = f(e.prevYaw ?? 0);
  while (f(pitch - prevPitch) < -180) prevPitch = f(prevPitch - 360);
  while (f(pitch - prevPitch) >= 180) prevPitch = f(prevPitch + 360);
  while (f(yaw - prevYaw) < -180) prevYaw = f(prevYaw - 360);
  while (f(yaw - prevYaw) >= 180) prevYaw = f(prevYaw + 360);
  e.prevPitch = prevPitch;
  e.prevYaw = prevYaw;
  e.pitch = f(prevPitch + f(f(pitch - prevPitch) * f(0.2)));
  e.yaw = f(prevYaw + f(f(yaw - prevYaw) * f(0.2)));
  return e;
}

// RenderWitherSkull.func_82400_a: the yaw delta wrapped to [-180, 180), then prev + partial * delta. The pitch is a plain lerp.
export function interpolateRotation(prev, now, partial) {
  let d = f(f(now) - f(prev));
  while (d < -180) d = f(d + 360);
  while (d >= 180) d = f(d - 360);
  return f(f(prev) + f(f(partial) * d));
}
export const lerpPitch = (prev, now, partial) => f(f(prev) + f(f(f(now) - f(prev)) * f(partial)));
