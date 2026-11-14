// GuiIngame.renderVignette (bbv.a(FII), 1.7.10, bytecode-read in batch 71): the smoothed brightness behind misc/vignette.png.
// It runs once per drawn HUD frame, only with fancy graphics (bao.x()). The brightness is Entity.getBrightness(1.0F) of the
// player (fire-fx.js playerBrightness); the new target is clamp(1 - brightness, 0, 1) and the stored value moves 1 % of the way:
// (float)((double)prev + (double)(target - prev) * 0.01). It starts at 1.0F. The quad is drawn with glColor4f(prev, prev, prev, 1)
// and glBlendFunc(ZERO, ONE_MINUS_SRC_COLOR, ONE, ZERO), so the screen becomes screen * (1 - texture * prev). There is no world
// border tint in 1.7.10 (that came with 1.8).
const f = Math.fround;
export const VIGNETTE_START = 1;
export const VIGNETTE_RATE = 0.01;
export function vignetteTarget(brightness) {
  let t = f(1 - f(brightness));
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  return t;
}
export const vignetteStep = (prev, brightness) => f(prev + f(vignetteTarget(brightness) - prev) * VIGNETTE_RATE);
export class Vignette {
  constructor() { this.level = VIGNETTE_START; }
  // One drawn HUD frame: returns the grey level to draw with, or 0 when the frame is skipped (Fast graphics leave the level untouched).
  frame(fancy, brightness) {
    if (!fancy) return 0;
    return (this.level = vignetteStep(this.level, brightness));
  }
}
