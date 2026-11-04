// EntityPortalFX (bkt), Minecraft Java 1.7.10. Constructor randomness is
// client-side Entity.rand/Math.random; it never consumes the pearl's RNG.
const f = Math.fround;

export function makePortalParticle(fx, x, y, z, vx, vy, vz) {
  const p = fx.base('portal', x, y, z, vx, vy, vz);
  p.mx = vx; p.my = vy; p.mz = vz;
  p.originX = x; p.originY = y; p.originZ = z;
  const brightness = f(f(p.rand.nextFloat() * f(0.6)) + f(0.4));
  p.base = p.scale = f(f(p.rand.nextFloat() * f(0.2)) + f(0.5));
  p.r = f(brightness * f(0.9)); p.g = f(brightness * f(0.3)); p.b = brightness;
  p.max = Math.trunc(fx.random() * 10) + 40;
  p.noClip = true;
  p.tex = Math.trunc(fx.random() * 8);
  return p;
}

export function stepPortalParticle(p) {
  p.px = p.x; p.py = p.y; p.pz = p.z;
  const age = f(p.age / p.max), path = f(1 - f(-age + f(f(age * age) * 2)));
  p.x = p.originX + p.mx * path;
  p.y = p.originY + p.my * path + f(1 - age);
  p.z = p.originZ + p.mz * path;
  if (p.age++ >= p.max) p.dead = true;
}

export function portalParticleScale(p, partial) {
  const remaining = f(1 - f(f(p.age + f(partial)) / p.max));
  return f(p.base * f(1 - f(remaining * remaining)));
}

export function portalParticleLight(p, packed) {
  let age = f(p.age / p.max);
  age = f(age * age); age = f(age * age);
  const sky = Math.min(240, ((packed >> 16) & 255) + Math.trunc(f(f(age * 15) * 16)));
  return (packed & 255) | (sky << 16);
}
