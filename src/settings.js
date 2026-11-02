// GameSettings values of 1.7.10 for the options the browser has (settings-parity-catalogue.md,
// settings-reference.json). Saved device settings carry `settingsVersion`; earlier saves used the
// browser's own scales and are converted once by migrateSettings.
const f = Math.fround;
export const SETTINGS_VERSION = 2;
// GameSettings.Options float ranges (FOV and RENDER_DISTANCE step 1).
export const FOV_RANGE = [30, 110];
export const RENDER_DISTANCE_RANGE = [2, 16];
// GuiOptions cycles guiScale with (guiScale + 1) & 3: Auto, Small, Normal, Large.
export const GUI_SCALE_NAMES = ["Auto", "Small", "Normal", "Large"];

// EntityRenderer.updateCameraAndRender: f = sensitivity * 0.6F + 0.2F, f1 = f * f * f * 8.0F, and the
// mouse delta times f1 goes to Entity.setAngles, which adds delta * 0.15 degrees. Radians per pixel.
export function lookScale(sensitivity) {
  const a = f(f(f(sensitivity) * f(0.6)) + f(0.2));
  return f(f(f(a * a) * a) * f(8)) * 0.15 * Math.PI / 180;
}
// The sensitivity whose lookScale is `radians` per pixel, within the native 0..1 range.
export function sensitivityForScale(radians) {
  const a = Math.cbrt(radians / (0.15 * Math.PI / 180) / 8);
  return clamp((a - 0.2) / 0.6, 0, 1);
}
// EntityRenderer.setupFog: the far plane is renderDistanceChunks * 16 blocks.
export const renderDistanceBlocks = (chunks) => chunks * 16;

// GameSettings.getKeyBinding strings (en_US.lang in the original JAR) for the slider values.
export function optionLabel(key, v) {
  switch (key) {
    case "fov": return v === 70 ? "Normal" : v === 110 ? "Quake Pro" : String(Math.trunc(v));
    case "sensitivity": return v === 0 ? "*yawn*" : v === 1 ? "HYPERSPEED!!!" : Math.trunc(f(f(v) * 200)) + "%";
    case "distance": return v + " chunks";
    case "volume": return v === 0 ? "OFF" : Math.trunc(f(f(v) * 100)) + "%";
  }
  return String(v);
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v) => typeof v === "number" && Number.isFinite(v);
// Saved settings before version 2 used FOV 50-100 (default 75), a 0.2-2x multiplier of 0.002 rad/px
// (default 1), a view distance of 70-200 blocks (default 155), volume default 0.65 and a fifth GUI
// scale "Larger" (4). Old defaults become the native defaults; changed values keep their effect.
export function migrateSettings(saved) {
  const s = saved && typeof saved === "object" && !Array.isArray(saved) ? { ...saved } : {};
  if (s.settingsVersion !== SETTINGS_VERSION) {
    if (s.fov === 75) delete s.fov;
    if (s.sensitivity === 1) delete s.sensitivity;
    else if (num(s.sensitivity)) s.sensitivity = sensitivityForScale(0.002 * s.sensitivity);
    if (s.distance === 155) delete s.distance;
    else if (num(s.distance)) s.distance = Math.round(s.distance / 16);
    if (s.volume === 0.65) delete s.volume;
    if (s.guiScale === 4) s.guiScale = 3;
  }
  s.settingsVersion = SETTINGS_VERSION;
  if (s.fov !== undefined) num(s.fov) ? (s.fov = clamp(Math.round(s.fov), ...FOV_RANGE)) : delete s.fov;
  if (s.distance !== undefined) num(s.distance) ? (s.distance = clamp(Math.round(s.distance), ...RENDER_DISTANCE_RANGE)) : delete s.distance;
  if (s.sensitivity !== undefined) num(s.sensitivity) ? (s.sensitivity = clamp(s.sensitivity, 0, 1)) : delete s.sensitivity;
  if (s.volume !== undefined) num(s.volume) ? (s.volume = clamp(s.volume, 0, 1)) : delete s.volume;
  if (s.guiScale !== undefined) num(s.guiScale) ? (s.guiScale = clamp(Math.trunc(s.guiScale), 0, 3)) : delete s.guiScale;
  return s;
}
