// Clock item (original 347, ItemClock) and its animation (TextureClock bql.j), Minecraft Java 1.7.10.
// Evidence: public/research/maps-clock-reference.json (tools/probes/MapsClockProbe.java, clockSettle/clockDay records)
// and public/research/maps-clock.md. The non-surface spin (Math.random) is bytecode-derived, not probed.
const f = Math.fround;

export const ITEM_CLOCK = 2080; // original item 347
export const CLOCK_FRAMES = 64; // clock.png is 16x1024 = 64 frames of 16x16

// WorldProvider.calculateCelestialAngle (aqo.a(long, float)) as World.getCelestialAngle(1.0F) calls it.
export function celestialAngle(worldTime, partial = 1) {
  const i = Number(BigInt(Math.trunc(worldTime)) % 24000n);
  let a = f(f(f(i + partial) / 24000) - 0.25);
  if (a < 0) a = f(a + 1);
  if (a > 1) a = f(a - 1);
  const b = a;
  a = f(1 - f((Math.cos(a * Math.PI) + 1) / 2));
  return f(b + f(f(a - b) / 3));
}

export const createClock = () => ({ angle: 0, velocity: 0, frame: 0 }); // bql.i, bql.j, bqd.g

// TextureClock.updateAnimation. `angle` is undefined without a world/player (0), the celestial angle on the surface
// and Math.random() elsewhere. `frames` is the sprite's frame list size (sprite-frames.js; 64 for the vanilla strip). Returns the frame index; `clock.frame` changes only when the texture would be uploaded.
export function tickClock(clock, angle = 0, frames = CLOCK_FRAMES) {
  let d = angle - clock.angle;
  while (d < -0.5) d += 1;
  while (d >= 0.5) d -= 1;
  d = Math.max(-1, Math.min(1, d));
  clock.velocity += d * 0.1;
  clock.velocity *= 0.8;
  clock.angle += clock.velocity;
  let index = Math.trunc((clock.angle + 1) * frames) % frames;
  while (index < 0) index = (index + frames) % frames;
  clock.frame = index;
  return index;
}

// Which angle feeds the clock: the surface world's celestial angle, a random spin in the Nether/End.
export const clockAngle = (worldTime, surface, random = Math.random) => (surface ? celestialAngle(worldTime) : random());
