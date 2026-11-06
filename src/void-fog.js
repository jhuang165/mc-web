// 1.7.10 void fog: WorldProvider.getWorldHasVoidParticles / getVoidFogYFactor, the distance term of
// EntityRenderer.setupFog and the depthsuspend roll of WorldClient.doVoidFogParticles
// (tools/probes/VoidFogProbe.java, public/research/void-fog-reference.json, void-fog.md).
const f = Math.fround;

// aqo.j(): terrainType != FLAT && !hasNoSky. `dimension` is 0, -1 (Nether) or 1 (End).
export function hasVoidParticles({ worldType = "default", dimension = 0 } = {}) {
  return worldType !== "flat" && dimension === 0;
}
// aqo.k(): 1.0 on a flat world, otherwise 1/32.
export function voidFogYFactor(worldType = "default") {
  return worldType === "flat" ? 1 : 0.03125;
}
// setupFog (mode >= 0 or < 0 unchanged): `far` is the fog far plane before the void term, `skyLight` the
// 0..15 sky component of Entity.getBrightnessForRender, `y` the player's posY (the eye on the client),
// `creative` the capability flag that skips the term. Returns the new far plane.
export function voidFogFar({ far, skyLight, y, creative = false, hasVoid = true }) {
  if (!hasVoid || creative) return far;
  let d = skyLight / 16 + (y + 4) / 32;
  if (d < 1) {
    if (d < 0) d = 0;
    d = d * d;
    let g = f(100 * f(d));
    if (g < 5) g = 5;
    if (far > g) return g;
  }
  return far;
}
// WorldClient.doVoidFogParticles: `roll` is World.rand.nextInt(8) drawn before the provider test.
export function voidParticleSpawns(roll, y, hasVoid = true) {
  return !(roll <= y) && hasVoid;
}
