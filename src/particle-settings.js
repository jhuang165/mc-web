// RenderGlobal.doSpawnParticle (bma.b), Java 1.7.10. Filtering happens
// before EntityFX construction; Decreased draws even for distant/exempt effects.
export const particleSetting = value => [0, 1, 2].includes(value) ? value : 0;

export function acceptsParticle(kind, setting, random, x, y, z, viewer) {
  let selected = particleSetting(setting);
  if (selected === 1 && random.nextInt(3) === 0) selected = 2;
  if (kind === "hugeexplosion" || kind === "largeexplode" || kind === "fireworksSpark") return true;
  if (viewer && (x - viewer[0]) ** 2 + (y - viewer[1]) ** 2 + (z - viewer[2]) ** 2 > 256) return false;
  return selected <= 1;
}

// EntityRenderer.addRainParticles (blt.l), separate from RenderGlobal filtering.
export function rainParticleAttempts(strength, setting) {
  const count = Math.trunc(Math.fround(Math.fround(100 * strength) * strength));
  return setting === 2 ? 0 : setting === 1 ? count >> 1 : count;
}
