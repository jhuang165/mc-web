// GameSettings values of 1.7.10 for the options the browser has (settings-parity-catalogue.md,
// settings-reference.json). Saved device settings carry `settingsVersion`; earlier saves used the
// browser's own scales and are converted once by migrateSettings.
import { normalizeRender } from "./render-settings.js";
const f = Math.fround;
export const SETTINGS_VERSION = 3;
// GameSettings.Options float ranges (FOV and RENDER_DISTANCE step 1).
export const FOV_RANGE = [30, 110];
export const RENDER_DISTANCE_RANGE = [2, 16];
// GuiOptions cycles guiScale with (guiScale + 1) & 3: Auto, Small, Normal, Large.
export const GUI_SCALE_NAMES = ["Auto", "Small", "Normal", "Large"];

// EntityRenderer.updateCameraAndRender: f = sensitivity * 0.6F + 0.2F, f1 = f * f * f * 8.0F, and the
// mouse delta times f1 goes to Entity.setAngles, which adds delta * 0.15 degrees.
export function lookCurve(sensitivity) {
  const a = f(f(f(sensitivity) * f(0.6)) + f(0.2));
  return f(f(f(a * a) * a) * f(8));
}
// Radians per pixel without the cinematic camera.
export const lookScale = (sensitivity) => lookCurve(sensitivity) * 0.15 * Math.PI / 180;
// The sensitivity whose lookScale is `radians` per pixel, within the native 0..1 range.
export function sensitivityForScale(radians) {
  const a = Math.cbrt(radians / (0.15 * Math.PI / 180) / 8);
  return clamp((a - 0.2) / 0.6, 0, 1);
}
// EntityRenderer.setupFog: the far plane is renderDistanceChunks * 16 blocks.
export const renderDistanceBlocks = (chunks) => chunks * 16;

// SoundCategory constants in ordinal order: the options.txt name (soundCategory_<name>) and the
// soundCategory.<name> string of en_US.lang. GameSettings.getSoundLevel returns 1 for a category
// missing from its map; 1 is also every constructor default.
export const SOUND_CATEGORIES = [
  ["master", "Master Volume"], ["music", "Music"], ["record", "Jukebox/Noteblocks"], ["weather", "Weather"],
  ["block", "Blocks"], ["hostile", "Hostile Creatures"], ["neutral", "Friendly Creatures"], ["player", "Players"],
  ["ambient", "Ambient/Environment"],
];
const SOUND_KEYS = new Set(SOUND_CATEGORIES.map(([k]) => k));
export function soundLevel(levels, category) {
  const v = levels?.[category];
  return typeof v === "number" ? v : 1;
}
// SoundManager.getSoundCategoryVolume: no category or MASTER gives 1 (the master level is the sound
// system's master gain instead); otherwise GameSettings.getSoundLevel.
export const categoryVolume = (levels, category) =>
  !category || category === "master" || !SOUND_KEYS.has(category) ? 1 : soundLevel(levels, category);
// SoundManager.getNormalizedVolume: (float) clamp(ISound.getVolume() * SoundPoolEntry.getVolume() *
// category volume, 0, 1) in double arithmetic. The master level multiplies it as the master gain.
export const normalizedVolume = (volume, entryVolume, levels, category) =>
  f(clamp(f(volume) * entryVolume * categoryVolume(levels, category), 0, 1));
// SoundManager.getNormalizedPitch: (float) clamp(ISound.getPitch() * SoundPoolEntry.getPitch(), 0.5, 2).
export const normalizedPitch = (pitch, entryPitch) => f(clamp(f(pitch) * entryPitch, 0.5, 2));

// GameSettings.getKeyBinding strings (en_US.lang in the original JAR) for the slider values.
export function optionLabel(key, v) {
  switch (key) {
    case "fov": return v === 70 ? "Normal" : v === 110 ? "Quake Pro" : String(Math.trunc(v));
    case "sensitivity": return v === 0 ? "*yawn*" : v === 1 ? "HYPERSPEED!!!" : Math.trunc(f(f(v) * 200)) + "%";
    case "distance": return v + " chunks";
    // GuiScreenOptionsSounds.getSoundVolume: options.off at 0, else (int)(level * 100) + "%".
    case "volume": return v === 0 ? "OFF" : Math.trunc(f(f(v) * 100)) + "%";
  }
  return String(v);
}

// GameSettings chat fields (bbj.m chatVisibility, n chatColours, o chatLinks, p chatLinksPrompt, q chatOpacity, C chatScale, D chatWidth,
// E chatHeightFocused, F chatHeightUnfocused) with their constructor defaults; showCape is the SHOW_CAPE boolean (default true).
export const CHAT_SETTING_DEFAULTS = Object.freeze({
  chatVisibility: 0, chatColors: true, chatLinks: true, chatLinksPrompt: true, chatOpacity: 1, chatScale: 1, chatWidth: 1,
  chatHeightFocused: 1, chatHeightUnfocused: 0.44366196, showCape: true,
});
export const CHAT_FLOAT_KEYS = ["chatOpacity", "chatScale", "chatWidth", "chatHeightFocused", "chatHeightUnfocused"];
export const CHAT_BOOL_KEYS = ["chatColors", "chatLinks", "chatLinksPrompt", "showCape"];

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
const num = (v) => typeof v === "number" && Number.isFinite(v);
const plain = (v) => v && typeof v === "object" && !Array.isArray(v);
// Saved settings before version 2 used FOV 50-100 (default 75), a 0.2-2x multiplier of 0.002 rad/px
// (default 1), a view distance of 70-200 blocks (default 155), volume default 0.65 and a fifth GUI
// scale "Larger" (4). Old defaults become the native defaults; changed values keep their effect.
// Version 3 keeps one level per SoundCategory in `soundLevels`; the single `volume` becomes the master.
export function migrateSettings(saved) {
  const s = plain(saved) ? { ...saved } : {};
  const version = num(s.settingsVersion) ? s.settingsVersion : 1;
  if (version < 2) {
    if (s.fov === 75) delete s.fov;
    if (s.sensitivity === 1) delete s.sensitivity;
    else if (num(s.sensitivity)) s.sensitivity = sensitivityForScale(0.002 * s.sensitivity);
    if (s.distance === 155) delete s.distance;
    else if (num(s.distance)) s.distance = Math.round(s.distance / 16);
    if (s.volume === 0.65) delete s.volume;
    if (s.guiScale === 4) s.guiScale = 3;
  }
  if (version < 3 && "volume" in s) {
    const levels = plain(s.soundLevels) ? { ...s.soundLevels } : {};
    if (num(s.volume) && !("master" in levels)) levels.master = s.volume;
    delete s.volume;
    s.soundLevels = levels;
  }
  s.settingsVersion = SETTINGS_VERSION;
  if (s.fov !== undefined) num(s.fov) ? (s.fov = clamp(Math.round(s.fov), ...FOV_RANGE)) : delete s.fov;
  if (s.distance !== undefined) num(s.distance) ? (s.distance = clamp(Math.round(s.distance), ...RENDER_DISTANCE_RANGE)) : delete s.distance;
  if (s.sensitivity !== undefined) num(s.sensitivity) ? (s.sensitivity = clamp(s.sensitivity, 0, 1)) : delete s.sensitivity;
  if (s.guiScale !== undefined) num(s.guiScale) ? (s.guiScale = clamp(Math.trunc(s.guiScale), 0, 3)) : delete s.guiScale;
  if (s.invertMouse !== undefined && typeof s.invertMouse !== "boolean") delete s.invertMouse;
  // Only known categories with numeric levels are kept (soundLevel falls back to 1), clamped to 0..1.
  if (s.soundLevels !== undefined) {
    const levels = {};
    if (plain(s.soundLevels))
      for (const [k] of SOUND_CATEGORIES) if (num(s.soundLevels[k])) levels[k] = clamp(s.soundLevels[k], 0, 1);
    s.soundLevels = levels;
  }
  // Video settings (render-settings.js): invalid values are dropped, out-of-range numbers are clamped.
  for (const k of ["graphics", "clouds"]) if (s[k] !== undefined && typeof s[k] !== "boolean") delete s[k];
  if (s.ao !== undefined || s.mipmapLevels !== undefined || s.anisotropic !== undefined) {
    const n = normalizeRender(s);
    for (const k of ["ao", "mipmapLevels", "anisotropic"]) if (s[k] !== undefined) num(s[k]) ? (s[k] = n[k]) : delete s[k];
  }
  // Chat Settings (chat.js, menus.js): EnumChatVisibility ordinal 0..2, booleans, and 0..1 sliders.
  if (s.chatVisibility !== undefined) num(s.chatVisibility) ? (s.chatVisibility = clamp(Math.trunc(s.chatVisibility), 0, 2)) : delete s.chatVisibility;
  for (const k of CHAT_BOOL_KEYS) if (s[k] !== undefined && typeof s[k] !== "boolean") delete s[k];
  for (const k of CHAT_FLOAT_KEYS) if (s[k] !== undefined) num(s[k]) ? (s[k] = clamp(s[k], 0, 1)) : delete s[k];
  // Max Framerate 10..260 in steps of 10 (260 Unlimited); Use VSync, pauseOnLostFocus, advancedItemTooltips.
  if (s.maxFps !== undefined) num(s.maxFps) ? (s.maxFps = clamp(Math.round(s.maxFps / 10) * 10, 10, 260)) : delete s.maxFps;
  for (const k of ["vsync", "pauseOnLostFocus", "advancedTooltips"]) if (s[k] !== undefined && typeof s[k] !== "boolean") delete s[k];
  // Key bindings: description -> LWJGL code (keybindings.js storedKeyCodes validates each entry).
  for (const k of ["keyBindings", "keys", "optionsTxtExtra"]) if (s[k] !== undefined && !plain(s[k])) delete s[k];
  return s;
}
