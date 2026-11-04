// Client-side potion presentation of Minecraft 1.7.10: the Night Vision lightmap/fog term, the Blindness fog, the Nausea screen warp,
// the invisible-player visibility scale and the splash-bottle break (world event 2002). Ported from EntityRenderer (blt: getNightVisionBrightness
// a(yz,F), updateLightmap i(F), updateFogColor j(F), setupFog a(I,F), setupCameraTransform), EntityPlayerSP (blk.onLivingUpdate),
// World.getClosestVulnerablePlayer (ahb.b) and RenderGlobal.playAuxSFX case 2002. Evidence: public/research/potion-fx-reference.json
// (tools/verify-potion-fx.mjs); see public/research/potion-fx.md for what is exact and what is approximated.
import { mhSin } from "./lighting.js";
import { ITEM_POTION, potionColor, isInstantPotion } from "./potions.js";

const f = Math.fround, PI = f(3.1415927);
export const NIGHT_VISION = 16, BLINDNESS = 15, NAUSEA = 9, INVISIBILITY = 14;

// EntityRenderer.getNightVisionBrightness: constant 1 above 200 ticks, then 0.7 + sin((duration - partial) * pi * 0.2) * 0.3.
export function nightVisionBrightness(duration, partial = 0) {
  if (duration > 200) return 1;
  return f(f(0.7) + f(mhSin(f(f(f(duration - partial) * PI) * f(0.2))) * f(0.3)));
}

// EntityRenderer.setupFog with Blindness (not in water or lava: it is the first branch): far plane 5 for the whole effect, widening
// back to the render distance over the last 20 ticks; linear fog starts at a quarter of that and ends at it (the sky pass uses 0..0.8).
export function blindnessFog(duration, farPlane) {
  let end = f(5);
  if (duration < 20) end = f(end + f(f(farPlane - f(5)) * f(f(1) - f(duration / f(20)))));
  return { start: f(end * f(0.25)), end, skyStart: 0, skyEnd: f(end * f(0.8)) };
}

// EntityRenderer.updateFogColor tail, after the weather and brightness terms: the void factor (feet y * WorldProvider.getVoidFogYFactor 1/32
// darkens the fog under y 32; Blindness zeroes it and eases back over the last 20 ticks), then Night Vision lifts the colour towards a channel max of 1.
export function adjustFogColor(rgb, { feetY, blindness = 0, nightVision = 0, voidFactor = 0.03125 }) {
  let [r, g, b] = rgb, d = f(feetY * voidFactor);
  if (blindness > 0) d = blindness < 20 ? f(d * f(1 - f(blindness / f(20)))) : 0;
  if (d < 1) {
    if (d < 0) d = 0;
    d = d * d;
    r = f(r * d); g = f(g * d); b = f(b * d);
  }
  if (nightVision > 0) {
    let k = f(1 / r);
    if (k > f(1 / g)) k = f(1 / g);
    if (k > f(1 / b)) k = f(1 / b);
    const lift = (c) => { const v = f(f(c * f(1 - nightVision)) + f(f(c * k) * nightVision)); return Number.isNaN(v) ? 0 : v; }; // Java's 0 * Infinity is NaN too
    r = lift(r); g = lift(g); b = lift(b);
  }
  return [r, g, b];
}

// EntityPlayerSP.onLivingUpdate (timeInPortal / prevTimeInPortal): in a portal +0.0125 (capped at 1), with Nausea longer than 60 ticks
// +1/150, otherwise -0.05 down to 0. There is no Nether here, so only Nausea drives it.
export class PortalTimer {
  constructor() { this.prev = 0; this.cur = 0; }
  tick(nauseaDuration = 0, inPortal = false) {
    this.prev = this.cur;
    if (inPortal) this.cur = Math.min(1, f(this.cur + f(0.0125)));
    else if (nauseaDuration > 60) this.cur = Math.min(1, f(this.cur + f(0.006666667)));
    else {
      if (this.cur > 0) this.cur = f(this.cur - f(0.05));
      if (this.cur < 0) this.cur = 0;
    }
  }
  amount(partial) { return f(this.prev + f(f(this.cur - this.prev) * partial)); }
  reset() { this.prev = this.cur = 0; }
}

// EntityRenderer.setupCameraTransform: with amount a > 0, rotate by (ticks + partial) * (7 with Nausea, else 20) degrees about (0,1,1),
// scale x by 1 / f6 with f6 = (5 / (a * a + 5) - a * 0.04)^2, rotate back. Returns the column-major 4x4 R * S * R^-1 that is applied to
// eye-space coordinates (multiply the projection matrix by it on the right).
export function warpScale(amount) {
  let s = f(f(5 / f(f(amount * amount) + 5)) - f(amount * f(0.04)));
  return f(s * s);
}
export function warpMatrix(ticks, partial, amount, nausea) {
  const angle = (f(f(ticks + partial) * (nausea ? 7 : 20)) * Math.PI) / 180, c = Math.cos(angle), s = Math.sin(angle), h = Math.SQRT1_2, k = 1 / warpScale(amount);
  // Rotation about u = (0, h, h): R = c I + (1 - c) u u^T + s [u]x.
  const R = [
    [c, -s * h, s * h],
    [s * h, c + (1 - c) * h * h, (1 - c) * h * h],
    [-s * h, (1 - c) * h * h, c + (1 - c) * h * h],
  ];
  const out = new Float64Array(16);
  // W = R diag(k, 1, 1) R^T; column-major.
  for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) {
    let v = 0;
    for (let m = 0; m < 3; m++) v += R[row][m] * (m === 0 ? k : 1) * R[col][m];
    out[col * 4 + row] = v;
  }
  out[15] = 1;
  return out;
}

// World.getClosestVulnerablePlayer: the detection range of a player shrinks to 0.8 when sneaking and to 0.7 * max(0.1, armour pieces / 4)
// when invisible (EntityPlayer.getArmorVisibility). Returns the factor applied to the range (a distance, not its square).
export function detectionRangeScale({ sneaking = false, invisible = false, armorPieces = 0 }) {
  let scale = 1;
  if (sneaking) scale = scale * 0.800000011920929;
  if (invisible) {
    let v = f(armorPieces / 4);
    if (v < f(0.1)) v = f(0.1);
    scale = scale * f(f(0.7) * v);
  }
  return scale;
}

// RenderGlobal.playAuxSFX 2002 (EntityPotion.onImpact): 8 "iconcrack_<potion>_<damage>" bits of glass, then 100 "spell" / "instantSpell"
// particles of the potion colour on a random disc of radius up to 4, each tinted by 0.75 + 0.25 * random and sped up by its radius.
// `rand` is the client's java.util.Random (JavaRandom); `fx` the Fx particle factory. Returns the number of particles spawned.
export function splashBreak(fx, rand, damage, x, y, z) {
  let spawned = 0;
  const glass = "iconcrack_" + ITEM_POTION + "_" + damage;
  for (let i = 0; i < 8; i++) {
    const vx = rand.nextGaussian() * 0.15, vy = rand.nextDouble() * 0.2, vz = rand.nextGaussian() * 0.15;
    if (fx.spawn(glass, x, y, z, vx, vy, vz)) spawned++;
  }
  const colour = potionColor(damage), r = f(((colour >> 16) & 255) / f(255)), g = f(((colour >> 8) & 255) / f(255)), b = f((colour & 255) / f(255)),
    name = isInstantPotion(damage) ? "instantSpell" : "spell";
  for (let i = 0; i < 100; i++) {
    const d = rand.nextDouble() * 4, a = rand.nextDouble() * Math.PI * 2, dx = Math.cos(a) * d, dy = 0.01 + rand.nextDouble() * 0.5, dz = Math.sin(a) * d,
      p = fx.spawn(name, x + dx * 0.1, y + 0.3, z + dz * 0.1, dx, dy, dz);
    if (p) {
      const k = f(f(0.75) + f(rand.nextFloat() * f(0.25)));
      p.r = f(r * k); p.g = f(g * k); p.b = f(b * k);
      const v = f(d); // EntityFX.multiplyVelocity
      p.mx = p.mx * v; p.my = (p.my - 0.10000000149011612) * v + 0.10000000149011612; p.mz = p.mz * v;
      spawned++;
    }
  }
  return spawned;
}
