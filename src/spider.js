// Minecraft Java 1.7.10 EntitySpider (yn), EntityMob (yg), ModelSpider (big).
import { mhSin, mhCos } from "./lighting.js";
const f = Math.fround;
export const STRING = 321, SPIDER_EYE = 326;
const nextInt = (random, n) => typeof random === "function" ? Math.floor(random() * n) : random.nextInt(n);
export const spiderFindsPlayer = (brightness) => f(brightness) < 0.5;
export function spiderDrops(playerHit, random = Math.random, looting = 0) {
  const string = nextInt(random, 3) + (looting > 0 ? nextInt(random, looting + 1) : 0);
  const eye = playerHit && (nextInt(random, 3) === 0 || nextInt(random, looting + 1) > 0) ? 1 : 0;
  return { string, eye };
}
// Called only with a visible target. Returns "forget", "leap", "hit" or "none".
// The 1-in-10 leap roll happens before onGround is checked, exactly as yn.a.
export function spiderAttack(e, target, distance, brightness, random = Math.random) {
  if (f(brightness) > 0.5 && nextInt(random, 100) === 0) return "forget";
  distance = f(distance);
  if (distance > 2 && distance < 6 && nextInt(random, 10) === 0) {
    if (!e.onGround) return "none";
    const dx = target.x - e.x, dz = target.z - e.z, length = f(Math.sqrt(dx * dx + dz * dz));
    if (length > 0) {
      e.vx = dx / length * 0.5 * 0.800000011920929 + e.vx * 0.20000000298023224;
      e.vz = dz / length * 0.5 * 0.800000011920929 + e.vz * 0.20000000298023224;
      e.vy = 0.4000000059604645;
    }
    return "leap";
  }
  if (e.attack <= 0 && distance < 2 && target.y + target.height > e.y && target.y < e.y + f(0.9)) {
    e.attack = 20;
    return "hit";
  }
  return "none";
}
// ModelSpider.setRotationAngles, returned in Java axes (Y and Z flip in three.js).
export function spiderLegs(swing, amount) {
  const phase = f(f(swing) * f(0.6662)), a = f(amount), quarter = f(0.3926991), roll = f(0.7853982);
  const offsets = [0, f(Math.PI), f(Math.PI / 2), f(Math.PI * 1.5)];
  return offsets.flatMap((off, pair) => {
    const yaw = f(f(-f(mhCos(f(f(phase * 2) + off)) * f(0.4))) * a),
      lift = f(Math.abs(f(mhSin(f(phase + off)) * f(0.4))) * a),
      baseYaw = f(quarter * [2, 1, -1, -2][pair]), baseRoll = pair === 0 || pair === 3 ? roll : f(roll * f(0.74));
    return [[f(baseYaw + yaw), f(-baseRoll + lift)], [f(-baseYaw - yaw), f(baseRoll - lift)]];
  });
}
