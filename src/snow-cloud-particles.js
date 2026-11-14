// EntitySnowShovelFX (bkw, "snowshovel"), EntityCloudFX (bks, "cloud") and EntityFootStepFX (bkg, "footstep"), Java 1.7.10.
// Evidence: public/research/snowcloud-particle-reference.json (tools/probes/SnowCloudParticleProbe.java through
// tools/verify-snowcloud-particles.mjs), replayed by snow-cloud-particles-b70.test.js. All three go through Fx.spawn.
// Callers in 1.7.10 (bytecode-read over every class of the jar): only BlockPumpkin.onBlockAdded (amw.b) spawns
// "snowshovel" (120 of them when a snow golem is built); nothing but RenderGlobal.doSpawnParticle names "cloud" or
// "footstep", so those two have no native emitter (no /particle command exists in 1.7.10).
import { moveParticleEntity } from "./particles.js";

const f = Math.fround;
const D01F = 0.10000000149011612; // (double)0.1F
const D03F = 0.30000001192092896; // (double)0.3F

// new EntitySnowShovelFX(world, x, y, z, vx, vy, vz[, scale]): the EntityFX constructor WITH the velocity (unlike
// the cloud, which passes zeros), then motion * 0.1F plus the velocity again, then Math.random for the grey (1 - r * 0.3F) and the lifetime (8 / (r * 0.8 + 0.2)).
export function makeSnowShovelParticle(fx, x, y, z, vx, vy, vz, scale = 1) {
  const r = fx.random, p = fx.base("snowshovel", x, y, z, vx, vy, vz);
  shovel(p, vx, vy, vz);
  const grey = f(1 - f(r() * D03F));
  p.r = p.g = p.b = grey;
  p.scale = f(f(p.scale * f(0.75)) * scale);
  p.base = p.scale;
  p.max = Math.trunc(f(f(Math.trunc(8 / (r() * 0.8 + 0.2))) * scale));
  p.noClip = false;
  return p;
}

// new EntityCloudFX(world, x, y, z, vx, vy, vz): the same with scale 2.5F and the lifetime 8 / (r * 0.8 + 0.3).
export function makeCloudParticle(fx, x, y, z, vx, vy, vz) {
  const r = fx.random, scale = f(2.5), p = fx.base("cloud", x, y, z, 0, 0, 0);
  shovel(p, vx, vy, vz);
  const grey = f(1 - f(r() * D03F));
  p.r = p.g = p.b = grey;
  p.scale = f(f(p.scale * f(0.75)) * scale);
  p.base = p.scale;
  p.max = Math.trunc(f(f(Math.trunc(8 / (r() * 0.8 + 0.3))) * scale));
  p.noClip = false;
  return p;
}

function shovel(p, vx, vy, vz) {
  p.mx = p.mx * D01F + vx;
  p.my = p.my * D01F + vy;
  p.mz = p.mz * D01F + vz;
}

// EntitySnowShovelFX.onUpdate: the texture runs 7 down to 0 over the life, gravity 0.03, drag 0.99, 0.7 on the ground.
export function stepSnowShovel(world, p) {
  p.px = p.x;
  p.py = p.y;
  p.pz = p.z;
  if (p.age++ >= p.max) p.dead = true;
  p.tex = 7 - Math.trunc((p.age * 8) / p.max);
  p.my -= 0.03;
  moveParticleEntity(world, p, p.mx, p.my, p.mz);
  p.mx *= 0.9900000095367432;
  p.my *= 0.9900000095367432;
  p.mz *= 0.9900000095367432;
  if (p.onGround) {
    p.mx *= 0.699999988079071;
    p.mz *= 0.699999988079071;
  }
}

// EntityCloudFX.onUpdate: no gravity, drag 0.96. A player (World.getClosestPlayerToEntity, 2 blocks) whose box floor
// is below the cloud pulls it down by a fifth of the gap and its motionY a fifth toward the player's. `player` is
// `{minY, my}` or null; Fx supplies it from `nearestPlayer(p, 2)`.
export function stepCloud(world, p, player = null) {
  p.px = p.x;
  p.py = p.y;
  p.pz = p.z;
  if (p.age++ >= p.max) p.dead = true;
  p.tex = 7 - Math.trunc((p.age * 8) / p.max);
  moveParticleEntity(world, p, p.mx, p.my, p.mz);
  p.mx *= 0.9599999785423279;
  p.my *= 0.9599999785423279;
  p.mz *= 0.9599999785423279;
  if (player && p.y > player.minY) {
    p.y += (player.minY - p.y) * 0.2;
    p.my += (player.my - p.my) * 0.2;
    const b = p.box, h = p.width / 2;
    // setPosition(posX, posY, posZ): the box is rebuilt around the new position.
    b[0] = p.x - h; b[1] = p.y - p.yOffset; b[2] = p.z - h;
    b[3] = p.x + h; b[4] = b[1] + p.height; b[5] = p.z + h;
  }
  if (p.onGround) {
    p.mx *= 0.699999988079071;
    p.mz *= 0.699999988079071;
  }
}

// new EntityFootStepFX(textureManager, world, x, y, z): no motion, its own 200-tick counter (EntityFX.particleAge and
// the random lifetime are never used), render layer 3, textures/particle/footprint.png.
export function makeFootstepParticle(fx, x, y, z) {
  const p = fx.base("footstep", x, y, z, 0, 0, 0);
  p.mx = p.my = p.mz = 0;
  p.layer = 3;
  p.steps = 0;
  p.stepsMax = 200;
  return p;
}

export function stepFootstep(p) {
  if (++p.steps === p.stepsMax) p.dead = true;
}

// EntityFootStepFX.renderParticle: alpha ((2 - 2t^2) capped at 1) * 0.2 with t = (steps + partial) / 200, then a flat
// 0.25-block quad at the particle's height, colour = the block light brightness (0..1) in all three channels.
export function footstepAlpha(p, partial) {
  let t = f(f(p.steps + f(partial)) / p.stepsMax);
  t = f(t * t);
  let a = f(2 - f(t * 2));
  if (a > 1) a = 1;
  return f(a * f(0.2));
}

// The four corners [x, y, z, u, v] relative to the camera base (x, y, z of the particle minus interpPos), in the draw order.
export function footstepQuad(p, interp) {
  const h = f(0.125), x = f(p.x - interp[0]), y = f(p.y - interp[1]), z = f(p.z - interp[2]);
  return [
    [f(x - h), y, f(z + h), 0, 1],
    [f(x + h), y, f(z + h), 1, 1],
    [f(x + h), y, f(z - h), 1, 0],
    [f(x - h), y, f(z - h), 0, 0],
  ];
}
