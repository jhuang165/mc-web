// EntityFireworkRocket (zf, entity id 22 "FireworksRocketEntity"), Minecraft Java 1.7.10. Pure rules; the live list is
// fireworks-live.js. Evidence: public/research/fireworks-reference.json (rocket records).
import { moveParticleEntity } from './particles.js';
import { waterAcceleration, entityWaterBox, inLava } from './fluids.js';
const f = Math.fround, PI_F = f(Math.PI), SIZE = f(0.25);

// zf(world, x, y, z, stack): flight = 1 + Fireworks.Flight; gaussian*0.001 sideways, 0.05 up,
// lifetime 10 * flight + nextInt(6) + nextInt(7). Entity.rand draws: gaussian, gaussian, nextInt(6), nextInt(7).
export function createRocket(x, y, z, stack, rand) {
  const fl = Number.isFinite(stack?.fireworks?.flight) ? stack.fireworks.flight : 0;
  const flight = 1 + fl;
  const mx = rand.nextGaussian() * 0.001, mz = rand.nextGaussian() * 0.001;
  const lifetime = 10 * flight + rand.nextInt(6) + rand.nextInt(7);
  const h = SIZE / 2;
  return { x, y, z, px: x, py: y, pz: z, mx, my: 0.05, mz, yaw: 0, pitch: 0, prevYaw: 0, prevPitch: 0, life: 0, lifetime, stack: stack ? { ...stack } : null,
    box: [x - h, y, z - h, x + h, y + SIZE, z + h], yOffset: 0, width: SIZE, height: SIZE, onGround: false, inWeb: false, noClip: false, dead: false, inWater: false, firstUpdate: true };
}

// zf.h. `remote` (client copy): the spark trail; otherwise (server copy): the death at life > lifetime.
// Returns { launch, spark: [x,y,z,vx,vy,vz] | null, explode: { x, y, z, vx, vy, vz, fireworks } | null }.
export function tickRocket(r, world, rand, { remote = false, server = true, entityBoxes = null } = {}) {
  const out = { launch: false, spark: null, explode: null };
  r.px = r.x; r.py = r.y; r.pz = r.z;
  r.prevPitch = r.pitch; r.prevYaw = r.yaw; // Entity.onEntityUpdate
  // Entity.handleWaterMovement (executed, firework-fluid-reference.json): flowing water pushes the motion by 0.014 along its flow before the rocket's own update; entering
  // water after the first update draws the splash's 32 Entity.rand floats (sound 2, six bubbles x 3, six splashes x 2), which the client copy's spark gaussians then follow.
  const water = waterAcceleration(world, entityWaterBox(r.box));
  if (water.wet) {
    r.mx += water.push[0]; r.my += water.push[1]; r.mz += water.push[2];
    if (!r.inWater && !r.firstUpdate) { for (let k = 0; k < 32; k++) rand.nextFloat(); out.splash = true; }
    r.inWater = true;
  } else r.inWater = false;
  // handleLavaMovement only sets fire (15 s, extinguished by water) and halves fallDistance; neither changes a rocket's flight (fire damage is refused by the rocket's attackEntityFrom).
  r.inLava = inLava(world, r.box);
  r.firstUpdate = false;
  if (r.y < -64) r.dead = true; // ... and its void test (posY < -64: kill(), tested before the move): the rest of the update still runs, no status 17 (executed, firework-collide-reference.json)
  r.mx *= 1.15; r.mz *= 1.15; r.my += 0.04;
  moveParticleEntity(world, r, r.mx, r.my, r.mz, entityBoxes);
  const speed = f(Math.sqrt(r.mx * r.mx + r.mz * r.mz));
  r.yaw = f(Math.atan2(r.mx, r.mz) * 180 / PI_F);
  r.pitch = f(Math.atan2(r.my, speed) * 180 / PI_F);
  while (f(r.pitch - r.prevPitch) < -180) r.prevPitch = f(r.prevPitch - 360);
  while (f(r.pitch - r.prevPitch) >= 180) r.prevPitch = f(r.prevPitch + 360);
  while (f(r.yaw - r.prevYaw) < -180) r.prevYaw = f(r.prevYaw - 360);
  while (f(r.yaw - r.prevYaw) >= 180) r.prevYaw = f(r.prevYaw + 360);
  r.pitch = f(r.prevPitch + f(f(r.pitch - r.prevPitch) * f(0.2)));
  r.yaw = f(r.prevYaw + f(f(r.yaw - r.prevYaw) * f(0.2)));
  if (r.life === 0) out.launch = true; // playSoundAtEntity("fireworks.launch", 3.0, 1.0)
  r.life++;
  if (remote) out.spark = [r.x, r.y - 0.3, r.z, rand.nextGaussian() * 0.05, -r.my * 0.5, rand.nextGaussian() * 0.05];
  if (server && r.life > r.lifetime) {
    out.explode = { x: r.x, y: r.y, z: r.z, vx: r.mx, vy: r.my, vz: r.mz, fireworks: r.stack?.fireworks ?? null };
    r.dead = true;
    r.exploded = true; // World.setEntityState(rocket, 17): the tracker sends the S1A before the destroy (object-tracker.js)
  }
  return out;
}
