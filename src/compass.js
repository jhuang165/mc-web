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

// `frames` is the sprite's frame list size (sprite-frames.js: the strip of the active pack), 32 for the vanilla strip.
export function tickCompass(compass, angle, frames = COMPASS_FRAMES) {
  let delta = angle - compass.angle;
  while (delta < -Math.PI) delta += TAU;
  while (delta >= Math.PI) delta -= TAU;
  compass.velocity += Math.max(-1, Math.min(1, delta)) * 0.1;
  compass.velocity *= 0.8;
  compass.angle += compass.velocity;
  compass.frame = compassFrameIndex(compass.angle, frames);
  return compass.frame;
}

// (int)((i / 2pi + 1) * size) % size, with the native loop that lifts a negative remainder (bqm.a).
export function compassFrameIndex(angle, frames = COMPASS_FRAMES) {
  let frame = Math.trunc((angle / TAU + 1) * frames) % frames;
  while (frame < 0) frame = (frame + frames) % frames;
  return frame;
}

// MathHelper.wrapAngleTo180_float (qh.g).
const wrap180 = (a) => { a = Math.fround(a % 360); if (a >= 180) a -= 360; if (a < -180) a += 360; return Math.fround(a); };

// RenderItemFrame (bnx) with a compass: the sprite's angle is set directly (no smoothing, i = j = 0 first) from the frame entity's
// position and the yaw wrapAngleTo180(180 + direction * 90); the Nether and End use a random angle. Returns the frame index shown.
export function itemFrameCompassFrame(x, z, direction, spawn, surface, frames = COMPASS_FRAMES, random = Math.random) {
  const angle = compassAngle({ x, z }, wrap180(180 + direction * 90), spawn, surface, random);
  return compassFrameIndex(angle, frames);
}

// The compass world context the item frame renderer reads (main.js sets it with the player's compass each tick).
export const compassWorld = { spawn: [0, 64, 0], surface: true };
export function setCompassWorld(spawn, surface) { compassWorld.spawn = spawn ?? [0, 64, 0]; compassWorld.surface = surface; }
