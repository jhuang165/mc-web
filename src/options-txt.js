// options.txt of 1.7.10 (GameSettings.saveOptions / loadOptions; controls.md, controls-reference.json).
// writeOptionsTxt prints every line in the native order with the browser's values for the options
// it has and the GameSettings constructor defaults (or an imported value) for the rest;
// parseOptionsTxt reads a file with the loadOptions rules.
import { BINDINGS, DEFAULT_KEYS } from "./keybindings.js";
import { SOUND_CATEGORIES } from "./settings.js";
import { formatResourcePacksOption, parseResourcePacksOption } from "./resource-packs.js";

const f = Math.fround;
// Float.toString (String.valueOf(float)) for the values options.txt holds: the shortest digits that
// read back as the same float, plain from 1e-3 up to 1e7 and computerized scientific otherwise.
export function javaFloat(v) {
  const x = f(v);
  if (Number.isNaN(x)) return "NaN";
  if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  let digits = "";
  for (let p = 1; p <= 9; p++) {
    digits = x.toPrecision(p);
    if (f(Number(digits)) === x) break;
  }
  const [mant, exp] = Number(digits).toExponential().split("e");
  const e = Number(exp), sign = mant.startsWith("-") ? "-" : "", d = mant.replace(/[-.]/g, "");
  const a = Math.abs(x);
  if (a >= 1e-3 && a < 1e7) {
    if (e < 0) return sign + "0." + "0".repeat(-e - 1) + d;
    const int = d.slice(0, e + 1).padEnd(e + 1, "0"), frac = d.slice(e + 1);
    return sign + int + "." + (frac || "0");
  }
  return sign + d[0] + "." + (d.slice(1) || "0") + "E" + e;
}

// GameSettings.saveOptions lines before the key bindings, with the constructor defaults.
export const OPTION_LINES = [
  ["invertYMouse", "false"], ["mouseSensitivity", "0.5"], ["fov", "0.0"], ["gamma", "0.0"], ["saturation", "0.0"],
  ["renderDistance", "12"], ["guiScale", "0"], ["particles", "0"], ["bobView", "true"], ["anaglyph3d", "false"],
  ["advancedOpengl", "false"], ["maxFps", "120"], ["fboEnable", "true"], ["difficulty", "2"], ["fancyGraphics", "true"],
  ["ao", "2"], ["clouds", "true"], ["resourcePacks", "[]"], ["lastServer", ""], ["lang", "en_US"], ["chatVisibility", "0"],
  ["chatColors", "true"], ["chatLinks", "true"], ["chatLinksPrompt", "true"], ["chatOpacity", "1.0"],
  ["snooperEnabled", "true"], ["fullscreen", "false"], ["enableVsync", "true"], ["hideServerAddress", "false"],
  ["advancedItemTooltips", "false"], ["pauseOnLostFocus", "true"], ["showCape", "true"], ["touchscreen", "false"],
  ["overrideWidth", "0"], ["overrideHeight", "0"], ["heldItemTooltips", "true"], ["chatHeightFocused", "1.0"],
  ["chatHeightUnfocused", "0.44366196"], ["chatScale", "1.0"], ["chatWidth", "1.0"],
  ["showInventoryAchievementHint", "true"], ["mipmapLevels", "4"], ["anisotropicFiltering", "1"],
  ["streamBytesPerPixel", "0.5"], ["streamMicVolume", "1.0"], ["streamSystemVolume", "1.0"], ["streamKbps", "0.5412844"],
  ["streamFps", "0.31690142"], ["streamCompression", "1"], ["streamSendMetadata", "true"], ["streamPreferredServer", ""],
  ["streamChatEnabled", "0"], ["streamChatUserFilter", "0"], ["streamMicToggleBehavior", "0"], ["forceUnicodeFont", "false"],
];
const DEFAULT_LINE = Object.fromEntries(OPTION_LINES);

// GameSettings.parseFloat: "true" 1, "false" 0, else Float.parseFloat (which trims and takes an f/d suffix).
function parseJavaFloat(s) {
  if (s === "true") return 1;
  if (s === "false") return 0;
  const t = s.trim().replace(/[fFdD]$/, "");
  if (!/^[+-]?(NaN|Infinity|(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?)$/.test(t)) throw new Error("NumberFormatException");
  return f(Number(t));
}
// Integer.parseInt.
function parseJavaInt(s) {
  if (!/^[+-]?\d+$/.test(s)) throw new Error("NumberFormatException");
  const n = Number(s);
  if (n < -2147483648 || n > 2147483647) throw new Error("NumberFormatException");
  return n;
}
const bool = (s) => s === "true";

// The browser's option for each line it implements: the saved text, and the value loadOptions reads.
const int = (key, def) => ({ write: (o) => String(Math.trunc(o[key] ?? def)), read: (s) => ({ [key]: parseJavaInt(s) }) });
const flag = (key, def) => ({ write: (o) => String(o[key] ?? def), read: (s) => ({ [key]: bool(s) }) });
const float = (key, def) => ({ write: (o) => javaFloat(o[key] ?? def), read: (s) => ({ [key]: parseJavaFloat(s) }) });
const FIELDS = {
  invertYMouse: flag("invertMouse", false),
  mouseSensitivity: float("sensitivity", 0.5),
  // fovSetting is saved as (fov - 70) / 40 and read back as value * 40 + 70.
  fov: { write: (o) => javaFloat(f(f(f(o.fov ?? 70) - 70) / 40)), read: (s) => ({ fov: f(f(parseJavaFloat(s) * 40) + 70) }) },
  gamma: float("gamma", 0),
  renderDistance: int("distance", 12),
  guiScale: int("guiScale", 0),
  particles: int("particles", 0),
  bobView: flag("bobbing", true),
  maxFps: int("maxFps", 120),
  difficulty: int("difficulty", 2),
  fancyGraphics: flag("graphics", true),
  // "true" and "false" (saves before Smooth Lighting levels) read as Maximum and Off.
  ao: { write: (o) => String(Math.trunc(o.ao ?? 2)), read: (s) => ({ ao: s === "true" ? 2 : s === "false" ? 0 : parseJavaInt(s) }) },
  clouds: flag("clouds", true),
  // A Gson list of the selected pack names, lowest priority first (resource-packs.js).
  resourcePacks: { write: (o) => formatResourcePacksOption(o.resourcePacks ?? []), read: (s) => ({ resourcePacks: parseResourcePacksOption(s) }) },
  chatVisibility: int("chatVisibility", 0),
  chatColors: flag("chatColors", true),
  chatLinks: flag("chatLinks", true),
  chatLinksPrompt: flag("chatLinksPrompt", true),
  chatOpacity: float("chatOpacity", 1),
  enableVsync: flag("vsync", true),
  advancedItemTooltips: flag("advancedTooltips", false),
  pauseOnLostFocus: flag("pauseOnLostFocus", true),
  showCape: flag("showCape", true),
  chatHeightFocused: float("chatHeightFocused", 1),
  chatHeightUnfocused: float("chatHeightUnfocused", 0.44366196),
  chatScale: float("chatScale", 1),
  chatWidth: float("chatWidth", 1),
  mipmapLevels: int("mipmapLevels", 4),
  anisotropicFiltering: int("anisotropic", 1),
  anaglyph3d: flag("anaglyph", false),
};
// Lines the browser stores but does not use (an imported options.txt keeps them on export).
export const UNUSED_LINES = OPTION_LINES.map(([k]) => k).filter((k) => !(k in FIELDS));

// GameSettings.saveOptions. `options` is the browser settings object (keyBindings: description ->
// code for changed keys; soundLevels by SoundCategory name; optionsTxtExtra: imported unused lines).
export function writeOptionsTxt(options = {}) {
  const lines = OPTION_LINES.map(([k, def]) => k + ":" + (FIELDS[k] ? FIELDS[k].write(options) : options.optionsTxtExtra?.[k] ?? def));
  for (const b of BINDINGS) lines.push("key_" + b.description + ":" + (options.keyBindings?.[b.description] ?? b.defaultKey));
  for (const [name] of SOUND_CATEGORIES) lines.push("soundCategory_" + name + ":" + javaFloat(options.soundLevels?.[name] ?? 1));
  return lines.join("\n") + "\n";
}

// GameSettings.loadOptions: each line is split on ":" and the second part read for a known name; a
// line whose value does not parse is skipped ("Skipping bad option"), unknown names are ignored.
// Returns the browser settings it sets, every key binding that was read and the skipped lines.
export function parseOptionsTxt(text) {
  const options = {}, keyBindings = {}, soundLevels = {}, extra = {}, skipped = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (line === "") continue;
    // String.split drops trailing empty strings, so "lastServer:" has no value to read.
    const parts = line.split(":");
    while (parts.length > 1 && parts.at(-1) === "") parts.pop();
    const [name, value] = parts;
    try {
      const need = () => { if (value === undefined) throw new Error("ArrayIndexOutOfBoundsException"); return value; };
      if (FIELDS[name]) Object.assign(options, FIELDS[name].read(need()));
      else if (name in DEFAULT_LINE) extra[name] = value ?? "";
      else if (name.startsWith("key_") && name.slice(4) in DEFAULT_KEYS) keyBindings[name.slice(4)] = parseJavaInt(need());
      else if (name.startsWith("soundCategory_") && SOUND_CATEGORIES.some(([c]) => "soundCategory_" + c === name)) soundLevels[name.slice(14)] = parseJavaFloat(need());
    } catch {
      skipped.push(line);
    }
  }
  if (Object.keys(soundLevels).length) options.soundLevels = soundLevels;
  if (Object.keys(extra).length) options.optionsTxtExtra = extra;
  return { options, keyBindings, skipped };
}

// loadOptions over the current settings: read values replace the current ones; sound levels and key
// bindings missing from the file keep theirs.
export function applyOptionsTxt(current, text) {
  const { options, keyBindings, skipped } = parseOptionsTxt(text);
  const next = { ...current, ...options };
  if (options.soundLevels) next.soundLevels = { ...current.soundLevels, ...options.soundLevels };
  const codes = { ...DEFAULT_KEYS, ...current.keyBindings, ...keyBindings };
  next.keyBindings = Object.fromEntries(Object.entries(codes).filter(([d, c]) => c !== DEFAULT_KEYS[d]));
  delete next.keys;
  return { options: next, skipped };
}
