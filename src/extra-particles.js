// EntityReddustFX (bku, "reddust") and EntityEnchantmentTableParticleFX (bjz, "enchantmenttable"), Java 1.7.10.
// Evidence: public/research/extra-particle-reference.json (tools/probes/ExtraParticleProbe.java), replayed by
// extra-particles.test.js. Both go through Fx.spawn, so the Particles setting and 16-block filter apply first.
import { D01 } from "./effect-renderer.js";

const f = Math.fround;
const D02 = 0.20000000298023224; // (double)0.2F, the colour jitter's multiplier
const D01F = 0.10000000149011612; // (double)0.1F: the motion factor of the reddust constructor

// new EntityReddustFX(world, x, y, z, (float)r, (float)g, (float)b), scale 1: the EntityFX 7-argument constructor
// with zero velocity, motion * 0.1F, then Math.random for the brightness, the three colours and the lifetime.
// A zero red argument becomes 1 (so a bare spawn is pure red); green and blue are used as given.
export function makeReddustParticle(fx, x, y, z, vx, vy, vz, scale = 1) {
  const r = fx.random, p = fx.base("reddust", x, y, z, 0, 0, 0);
  p.mx *= D01F;
  p.my *= D01F;
  p.mz *= D01F;
  let red = f(vx);
  const green = f(vy), blue = f(vz);
  if (red === 0) red = 1;
  const k = f(f(f(r()) * f(0.4)) + f(0.6));
  const channel = (c) => f(f(f(f(r() * D02) + f(0.8)) * c) * k);
  p.r = channel(red);
  p.g = channel(green);
  p.b = channel(blue);
  p.scale = f(f(p.scale * f(0.75)) * scale);
  p.base = p.scale;
  p.max = Math.trunc(8 / (r() * 0.8 + 0.2));
  p.max = Math.trunc(f(f(p.max) * scale));
  p.noClip = false;
  return p;
}

// EntityReddustFX.onUpdate (the texture steps 7 down to 0 over the life; no gravity, 0.96 drag).
export function reddustTexture(p) {
  return 7 - Math.trunc((p.age * 8) / p.max);
}

// new EntityEnchantmentTableParticleFX(world, x, y, z, vx, vy, vz): the particle flies from its origin by the
// velocity, drifting up the curve in `stepEnchantParticle`. Entity.rand gives brightness and size; Math.random
// the lifetime (30-39) and the glyph (particles.png cells 225-250).
export function makeEnchantParticle(fx, x, y, z, vx, vy, vz) {
  const p = fx.base("enchant", x, y, z, vx, vy, vz);
  p.mx = vx;
  p.my = vy;
  p.mz = vz;
  p.originX = x;
  p.originY = y;
  p.originZ = z;
  const k = f(f(p.rand.nextFloat() * f(0.6)) + f(0.4));
  p.scale = f(f(p.rand.nextFloat() * f(0.5)) + f(0.2));
  p.base = p.scale;
  p.r = f(k * f(0.9));
  p.g = f(k * f(0.9));
  p.b = k;
  p.max = Math.trunc(fx.random() * 10) + 30;
  p.noClip = true;
  p.tex = Math.trunc(fx.random() * 26 + 1 + 224);
  return p;
}

export function stepEnchantParticle(p) {
  p.px = p.x;
  p.py = p.y;
  p.pz = p.z;
  const t = f(1 - f(p.age / p.max));
  let q = f(1 - t);
  q = f(q * q);
  q = f(q * q);
  p.x = p.originX + p.mx * t;
  p.y = p.originY + p.my * t - f(q * f(1.2));
  p.z = p.originZ + p.mz * t;
  if (p.age++ >= p.max) p.dead = true;
}

void D01;
