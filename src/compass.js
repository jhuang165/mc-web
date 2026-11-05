// TextureCompass.updateCompass (bqm.a(ahb,DDDZZ)), Java 1.7.10.
export const ITEM_COMPASS = 380; // original item 345
export const COMPASS_FRAMES = 32;
export const COMPASS_STRIP = "/media/1.7.10/items/compass.png";
export const COMPASS_STATIC = "/media/1.7.10/items/compass_static.png";
const TAU = 2 * Math.PI;

export const createCompass = () => ({ angle: 0, velocity: 0, frame: 0 });

// Spawn is the world's integer spawn coordinate, independent of the player's bed.
export function compassAngle(position, yaw, spawn, surface, random = Math.random) {
  if (!surface) return random() * Math.fround(Math.PI) * 2;
  return Math.atan2(spawn[2] - position.z, spawn[0] - position.x) - ((yaw % 360) - 90) * Math.PI / 180;
}

export function tickCompass(compass, angle) {
  let delta = angle - compass.angle;
  while (delta < -Math.PI) delta += TAU;
  while (delta >= Math.PI) delta -= TAU;
  compass.velocity += Math.max(-1, Math.min(1, delta)) * 0.1;
  compass.velocity *= 0.8;
  compass.angle += compass.velocity;
  const frame = Math.trunc((compass.angle / TAU + 1) * COMPASS_FRAMES) % COMPASS_FRAMES;
  compass.frame = (frame + COMPASS_FRAMES) % COMPASS_FRAMES;
  return compass.frame;
}
