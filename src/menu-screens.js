// Layouts, strings and value rules of the Minecraft Java 1.7.10 menu screens (GuiMainMenu,
// GuiSelectWorld, GuiCreateWorld, GuiYesNo, GuiRenameWorld, GuiIngameMenu, GuiOptions,
// GuiVideoSettings, GuiControls, GuiScreenOptionsSounds, GuiLanguage), read from the 1.7.10 client
// with javap and the MCP mappings. Every coordinate is in scaled GUI units (ScaledResolution);
// menu-ui.js draws them. No DOM here, so node tests can check the numbers.
const f = Math.fround;

// The en_US.lang strings the screens use (assets/minecraft/lang/en_US.lang in the 1.7.10 JAR).
export const LANG = {
  "gui.done": "Done", "gui.cancel": "Cancel", "gui.achievements": "Achievements", "gui.stats": "Statistics",
  "menu.game": "Game menu", "menu.singleplayer": "Singleplayer", "menu.multiplayer": "Multiplayer",
  "menu.online": "Minecraft Realms", "menu.options": "Options...", "menu.quit": "Quit Game",
  "menu.returnToMenu": "Save and Quit to Title", "menu.returnToGame": "Back to Game", "menu.shareToLan": "Open to LAN",
  "lanServer.title": "LAN World", "lanServer.start": "Start LAN World", "lanServer.otherPlayers": "Settings for Other Players",
  "selectWorld.gameMode.adventure": "Adventure", "selectWorld.gameMode.adventure.line1": "Same as survival mode, but blocks can't",
  "selectWorld.gameMode.adventure.line2": "be added or removed",
  "selectWorld.title": "Select World", "selectWorld.world": "World", "selectWorld.select": "Play Selected World",
  "selectWorld.create": "Create New World", "selectWorld.recreate": "Re-Create", "selectWorld.delete": "Delete",
  "selectWorld.rename": "Rename", "selectWorld.deleteQuestion": "Are you sure you want to delete this world?",
  "selectWorld.deleteWarning": "will be lost forever! (A long time!)", "selectWorld.deleteButton": "Delete",
  "selectWorld.renameButton": "Rename", "selectWorld.renameTitle": "Rename World", "selectWorld.newWorld": "New World",
  "selectWorld.newWorld.copyOf": "Copy of %s", "selectWorld.enterName": "World Name",
  "selectWorld.resultFolder": "Will be saved in:", "selectWorld.enterSeed": "Seed for the World Generator",
  "selectWorld.seedInfo": "Leave blank for a random seed", "selectWorld.cheats": "Cheats",
  "selectWorld.customizeType": "Customize", "selectWorld.gameMode": "Game Mode",
  "selectWorld.gameMode.survival": "Survival", "selectWorld.gameMode.survival.line1": "Search for resources, crafting, gain",
  "selectWorld.gameMode.survival.line2": "levels, health and hunger", "selectWorld.gameMode.creative": "Creative",
  "selectWorld.gameMode.creative.line1": "Unlimited resources, free flying and",
  "selectWorld.gameMode.creative.line2": "destroy blocks instantly", "selectWorld.gameMode.hardcore": "Hardcore",
  "selectWorld.moreWorldOptions": "More World Options...", "selectWorld.mapFeatures": "Generate Structures:",
  "selectWorld.mapFeatures.info": "Villages, dungeons etc", "selectWorld.mapType": "World Type:",
  "selectWorld.allowCommands": "Allow Cheats:", "selectWorld.allowCommands.info": "Commands like /gamemode, /xp",
  "selectWorld.bonusItems": "Bonus Chest:",
  "gameMode.survival": "Survival Mode", "gameMode.creative": "Creative Mode", "gameMode.adventure": "Adventure Mode",
  "generator.default": "Default", "generator.flat": "Superflat", "generator.largeBiomes": "Large Biomes", "generator.amplified": "Amplified",
  "generator.amplified.info": "Notice: Just for fun, requires beefy computer",
  "options.off": "OFF", "options.on": "ON", "options.title": "Options", "options.controls": "Controls...",
  "options.video": "Video Settings...", "options.language": "Language...", "options.stream": "Broadcast Settings...",
  "options.sounds": "Music & Sounds...", "options.sounds.title": "Music & Sound Options",
  "options.languageWarning": "Language translations may not be 100%% accurate", "options.videoTitle": "Video Settings",
  "options.invertMouse": "Invert Mouse", "options.fov": "FOV", "options.fov.min": "Normal", "options.fov.max": "Quake Pro",
  "options.gamma": "Brightness", "options.gamma.min": "Moody", "options.gamma.max": "Bright",
  "options.sensitivity": "Sensitivity", "options.sensitivity.min": "*yawn*", "options.sensitivity.max": "HYPERSPEED!!!",
  "options.renderDistance": "Render Distance", "options.viewBobbing": "View Bobbing", "options.ao": "Smooth Lighting",
  "options.ao.min": "Minimum", "options.ao.max": "Maximum", "options.anaglyph": "3D Anaglyph",
  "options.framerateLimit": "Max Framerate", "options.framerateLimit.max": "Unlimited", "options.difficulty": "Difficulty",
  "options.difficulty.peaceful": "Peaceful", "options.difficulty.easy": "Easy", "options.difficulty.normal": "Normal",
  "options.difficulty.hard": "Hard", "options.graphics": "Graphics", "options.graphics.fancy": "Fancy",
  "options.graphics.fast": "Fast", "options.guiScale": "GUI Scale", "options.guiScale.auto": "Auto",
  "options.guiScale.small": "Small", "options.guiScale.normal": "Normal", "options.guiScale.large": "Large",
  "options.renderClouds": "Clouds", "options.particles": "Particles", "options.particles.all": "All",
  "options.particles.decreased": "Decreased", "options.particles.minimal": "Minimal",
  "options.multiplayer.title": "Multiplayer Settings...", "options.snooper.view": "Snooper Settings...",
  "options.resourcepack": "Resource Packs...", "options.fullscreen": "Fullscreen", "options.vsync": "Use VSync",
  "options.touchscreen": "Touchscreen Mode", "options.mipmapLevels": "Mipmap Levels",
  "options.anisotropicFiltering": "Anisotropic Filtering", "options.forceUnicodeFont": "Force Unicode Font",
  "controls.title": "Controls", "controls.reset": "Reset", "controls.resetAll": "Reset Keys", "key.mouseButton": "Button %1$s",
  "key.sprint": "Sprint", "key.forward": "Walk Forwards", "key.left": "Strafe Left", "key.back": "Walk Backwards",
  "key.right": "Strafe Right", "key.jump": "Jump", "key.inventory": "Inventory", "key.drop": "Drop Item",
  "key.chat": "Open Chat", "key.sneak": "Sneak", "key.playerlist": "List Players", "key.attack": "Attack/Destroy",
  "key.use": "Use Item/Place Block", "key.pickItem": "Pick Block", "key.command": "Open Command",
  "key.screenshot": "Take Screenshot", "key.togglePerspective": "Toggle Perspective",
  "key.smoothCamera": "Toggle Cinematic Camera", "key.fullscreen": "Toggle Fullscreen",
  "key.streamStartStop": "Start/Stop Stream", "key.streamPauseUnpause": "Pause/Unpause Stream",
  "key.streamCommercial": "Show Stream Commercials", "key.streamToggleMic": "Push To Talk/Mute",
  "key.categories.movement": "Movement", "key.categories.misc": "Miscellaneous",
  "key.categories.multiplayer": "Multiplayer", "key.categories.gameplay": "Gameplay",
  "key.categories.inventory": "Inventory", "key.categories.stream": "Streaming",
  "soundCategory.master": "Master Volume", "soundCategory.music": "Music", "soundCategory.record": "Jukebox/Noteblocks",
  "soundCategory.weather": "Weather", "soundCategory.hostile": "Hostile Creatures",
  "soundCategory.neutral": "Friendly Creatures", "soundCategory.player": "Players", "soundCategory.block": "Blocks",
  "soundCategory.ambient": "Ambient/Environment",
};
for (let i = 1; i <= 9; i++) LANG["key.hotbar." + i] = "Hotbar Slot " + i;
// I18n.format: String.format over the translation (%s, %1$s and %%).
export function t(key, ...args) {
  const s = LANG[key] ?? key;
  let n = 0;
  return s.replace(/%(?:(\d+)\$)?([sd%])/g, (_, pos, kind) => (kind === "%" ? "%" : String(args[pos ? pos - 1 : n++])));
}

// FontRenderer.charWidth for ascii.png codes 32-126 (the minecraft-1710.ttf advances match).
const ASCII_WIDTHS = [4, 2, 5, 6, 6, 6, 6, 3, 5, 5, 5, 6, 2, 6, 2, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 2, 2, 5, 6, 5, 6, 7, 6, 6, 6, 6, 6, 6, 6, 6, 4, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 4, 6, 4, 6, 6, 3, 6, 6, 6, 6, 6, 5, 6, 6, 2, 6, 5, 3, 6, 6, 6, 6, 6, 6, 6, 4, 6, 6, 6, 6, 6, 6, 5, 2, 5, 7];
export const charWidth = (c) => { const i = c.charCodeAt(0) - 32; return i >= 0 && i < ASCII_WIDTHS.length ? ASCII_WIDTHS[i] : 6; };
// FontRenderer.getStringWidth: formatting codes (section sign + one character) take no width.
export function textWidth(s) {
  let w = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "§" && i + 1 < s.length) { i++; continue; }
    w += charWidth(s[i]);
  }
  return w;
}
// FontRenderer.trimStringToWidth (forward).
export function trimToWidth(s, width) {
  let w = 0, i = 0;
  for (; i < s.length; i++) { w += charWidth(s[i]); if (w > width) break; }
  return s.slice(0, i);
}
// FontRenderer.listFormattedStringToWidth / drawSplitString: word wrap at `width`, 9 units per line.
export function splitLines(s, width) {
  const lines = [];
  for (const para of s.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const next = line ? line + " " + word : word;
      if (line && textWidth(next) > width) { lines.push(line); line = word; } else line = next;
      while (textWidth(line) > width) { const head = trimToWidth(line, width) || line[0]; lines.push(head); line = line.slice(head.length); }
    }
    lines.push(line);
  }
  return lines;
}
// Text colours: EnumChatFormatting codes 0-f, and the drawString shadow (colour & 0xFCFCFC) >> 2.
export const FORMAT_COLORS = [0x000000, 0x0000aa, 0x00aa00, 0x00aaaa, 0xaa0000, 0xaa00aa, 0xffaa00, 0xaaaaaa, 0x555555, 0x5555ff, 0x55ff55, 0x55ffff, 0xff5555, 0xff55ff, 0xffff55, 0xffffff];
export const shadowColor = (c) => (c & 0xfcfcfc) >> 2;
export const COLOR = { white: 0xffffff, label: 0xa0a0a0, gray: 0x808080, button: 0xe0e0e0, hover: 0xffffa0, disabled: 0xa0a0a0, splash: 0xffff00 };

// java.lang.String.hashCode.
export function javaHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}
// GuiMainMenu: a random non-empty splashes.txt line, never the one whose hash is 125780783 ("This
// message will never appear on the splash screen, isn't that weird?"); initGui swaps in the dates.
export function pickSplash(text, date = new Date(), random = Math.random) {
  const lines = String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let splash = "missingno";
  if (lines.length) do splash = lines[Math.floor(random() * lines.length)]; while (javaHash(splash) === 125780783);
  const m = date.getMonth() + 1, d = date.getDate();
  if (m === 11 && d === 9) return "Happy birthday, ez!";
  if (m === 6 && d === 1) return "Happy birthday, Notch!";
  if (m === 12 && d === 24) return "Merry X-mas!";
  if (m === 1 && d === 1) return "Happy new year!";
  if (m === 10 && d === 31) return "OOoooOOOoooo! Spooky!";
  return splash;
}
// GuiMainMenu.drawScreen: the splash's pulsing scale for Minecraft.getSystemTime().
export function splashScale(splash, ms) {
  const s = f(1.8 - Math.abs(f(Math.sin(f(f(f((ms % 1000) / 1000) * f(Math.PI)) * 2)) * f(0.1))));
  return f((s * 100) / (textWidth(splash) + 32));
}
// The logo's drawTexturedModalRect pieces [u, v, w, h, dx] from gui/title/minecraft.png, at (w/2 - 137, 30).
// A random float below 1.0E-4 spells "Minceraft".
export const LOGO = [[0, 0, 155, 44, 0], [0, 45, 155, 44, 155]];
export const MINCERAFT_LOGO = [[0, 0, 99, 44, 0], [129, 0, 27, 44, 99], [126, 0, 3, 44, 125], [99, 0, 26, 44, 128], [0, 45, 155, 44, 155]];

const btn = (x, y, w = 200, h = 20) => ({ x, y, w, h });
const half = (n) => Math.trunc(n / 2);
// ScaledResolution: the GUI is ceil(display / scale) units wide and high.
export const scaledSize = (width, height, scale) => ({ w: Math.ceil(width / scale), h: Math.ceil(height / scale) });

// --- Screen layouts. Buttons are { x, y, w, h }; text is [x, y]. ---
export function mainMenuLayout(w, h) {
  const j = Math.trunc(h / 4) + 48, c = half(w);
  return {
    buttons: {
      singleplayer: btn(c - 100, j), multiplayer: btn(c - 100, j + 24), online: btn(c - 100, j + 48),
      options: btn(c - 100, j + 84, 98), quit: btn(c + 2, j + 84, 98), language: btn(c - 124, j + 84, 20, 20),
    },
    logo: [c - 137, 30], splash: [c + 90, 70], version: [2, h - 10], copyright: [w - 2, h - 10],
  };
}
export function selectWorldLayout(w, h) {
  const c = half(w);
  return {
    title: [c, 20], list: { top: 32, bottom: h - 64, slotHeight: 36, width: 220, scrollbarX: c + 124 },
    buttons: {
      select: btn(c - 154, h - 52, 150), create: btn(c + 4, h - 52, 150), rename: btn(c - 154, h - 28, 72),
      delete: btn(c - 76, h - 28, 72), recreate: btn(c + 4, h - 28, 72), cancel: btn(c + 82, h - 28, 72),
      // Browser additions in the empty header band: import a .blockworld.json, export the selection.
      import: btn(c - 154, 6, 72), export: btn(c + 82, 6, 72),
      // Endless copy of a finite Java world, in the gap between Import and the title (endless-world.js).
      endless: btn(c - 80, 6, 44),
    },
  };
}
export function createWorldLayout(w, h) {
  const c = half(w);
  return {
    title: [c, 20],
    buttons: {
      create: btn(c - 155, h - 28, 150), cancel: btn(c + 5, h - 28, 150), gameMode: btn(c - 75, 115, 150),
      moreOptions: btn(c - 75, 187, 150), mapFeatures: btn(c - 155, 100, 150), bonusItems: btn(c + 5, 151, 150),
      mapType: btn(c + 5, 100, 150), allowCommands: btn(c - 155, 151, 150), customize: btn(c + 5, 120, 150),
    },
    field: btn(c - 100, 60, 200),
    labels: {
      enterName: [c - 100, 47], resultFolder: [c - 100, 85], line1: [c - 100, 137], line2: [c - 100, 149],
      enterSeed: [c - 100, 47], seedInfo: [c - 100, 85], mapFeaturesInfo: [c - 150, 122], allowCommandsInfo: [c - 150, 172],
    },
    // drawSplitString under the World Type button: (x + 2, y + 22), button width, 0xA0A0A0.
    notice: [c + 5 + 2, 100 + 22, 150],
  };
}
export function yesNoLayout(w, h) {
  const c = half(w), y = Math.trunc(h / 6) + 96;
  return { line1: [c, 70], line2: [c, 90], buttons: { yes: btn(c - 155, y, 150), no: btn(c - 155 + 160, y, 150) } };
}
export function renameWorldLayout(w, h) {
  const c = half(w), q = Math.trunc(h / 4);
  return { title: [c, 20], label: [c - 100, 47], field: btn(c - 100, 60, 200), buttons: { rename: btn(c - 100, q + 96 + 12), cancel: btn(c - 100, q + 120 + 12) } };
}
export function ingameMenuLayout(w, h) {
  const c = half(w), q = Math.trunc(h / 4), b0 = -16;
  return {
    title: [c, 40],
    buttons: {
      returnToMenu: btn(c - 100, q + 120 + b0), returnToGame: btn(c - 100, q + 24 + b0),
      options: btn(c - 100, q + 96 + b0, 98), shareToLan: btn(c + 2, q + 96 + b0, 98),
      achievements: btn(c - 100, q + 48 + b0, 98), stats: btn(c + 2, q + 48 + b0, 98),
      // Browser addition in the empty row between Statistics and Options...: download the world.
      export: btn(c - 100, q + 72 + b0),
    },
  };
}
// GuiShareToLan.initGui / drawScreen.
export function shareToLanLayout(w, h) {
  const c = half(w);
  return {
    title: [c, 50], otherPlayers: [c, 82],
    buttons: { start: btn(c - 155, h - 28, 150), cancel: btn(c + 5, h - 28, 150), gameMode: btn(c - 155, 100, 150), allowCommands: btn(c + 5, 100, 150) },
  };
}
export function optionsLayout(w, h) {
  const c = half(w), s = Math.trunc(h / 6);
  return {
    title: [c, 15],
    buttons: {
      fov: btn(c - 155, s - 12, 150), difficulty: btn(c - 155 + 160, s - 12, 150),
      superSecret: btn(c + 5, s + 48 - 6, 150), sounds: btn(c - 155, s + 72 - 6, 150), stream: btn(c + 5, s + 72 - 6, 150),
      video: btn(c - 155, s + 96 - 6, 150), controls: btn(c + 5, s + 96 - 6, 150),
      language: btn(c - 155, s + 120 - 6, 150), multiplayer: btn(c + 5, s + 120 - 6, 150),
      resourcepack: btn(c - 155, s + 144 - 6, 150), snooper: btn(c + 5, s + 144 - 6, 150), done: btn(c - 100, s + 168),
    },
  };
}
// GuiVideoSettings.field_146502_i without ADVANCED_OPENGL, which initGui removes when the GL has no
// occlusion queries (OpenGlHelper.field_153197_d), as for this renderer.
export const VIDEO_OPTIONS = ["GRAPHICS", "RENDER_DISTANCE", "AMBIENT_OCCLUSION", "FRAMERATE_LIMIT", "ANAGLYPH", "VIEW_BOBBING", "GUI_SCALE", "GAMMA", "RENDER_CLOUDS", "PARTICLES", "USE_FULLSCREEN", "ENABLE_VSYNC", "MIPMAP_LEVELS", "ANISOTROPIC_FILTERING"];
export function videoSettingsLayout(w, h) {
  const c = half(w);
  // GuiOptionsRowList(top 32, bottom h - 32, slot 25): rows of two at w/2 - 155 and w/2 + 5; list width 400.
  return { title: [c, 5], list: { top: 32, bottom: h - 32, slotHeight: 25, width: 400, scrollbarX: c + 124 + 32 }, columns: [c - 155, c - 155 + 160], buttons: { done: btn(c - 100, h - 27) } };
}
export const CONTROLS_OPTIONS = ["INVERT_MOUSE", "SENSITIVITY", "TOUCHSCREEN"];
export function controlsLayout(w, h) {
  const c = half(w);
  return {
    title: [c, 8],
    options: CONTROLS_OPTIONS.map((_, i) => btn(c - 155 + (i % 2) * 160, 18 + 24 * (i >> 1), 150)),
    // GuiKeyBindingList(top 63, bottom h - 32, slot 20); getListWidth 220 + 15, scroll bar 124 + 15.
    list: { top: 63, bottom: h - 32, slotHeight: 20, width: 235, scrollbarX: c + 124 + 15 },
    buttons: { done: btn(c - 155, h - 29, 150), resetAll: btn(c - 155 + 160, h - 29, 150) },
  };
}
// KeyEntry: label right-aligned to x + 90 - maxLabelWidth at y + 4, key button 75 x 18 at x + 105,
// reset 50 x 18 at x + 190; CategoryEntry centred at y + 6 (slotHeight - 4 - FONT_HEIGHT - 1).
export const KEY_ENTRY = { label: 90, labelY: 4, key: [105, 75, 18], reset: [190, 50, 18], categoryY: 6 };
export function soundsLayout(w, h) {
  const c = half(w), s = Math.trunc(h / 6), sliders = { master: btn(c - 155, s - 12, 310) };
  let i = 2;
  for (const key of ["music", "record", "weather", "block", "hostile", "neutral", "player", "ambient"]) {
    sliders[key] = btn(c - 155 + (i % 2) * 160, s - 12 + 24 * (i >> 1), 150);
    i++;
  }
  return { title: [c, 15], sliders, buttons: { done: btn(c - 100, s + 168) } };
}
export function languageLayout(w, h) {
  const c = half(w);
  return {
    title: [c, 16], warning: [c, h - 56], list: { top: 32, bottom: h - 65 + 4, slotHeight: 18, width: 220, scrollbarX: c + 124 },
    buttons: { forceUnicode: btn(c - 155, h - 38, 150), done: btn(c - 155 + 160, h - 38, 150) },
  };
}

// --- GameSettings.Options values. ---
// Float options: [min, max, step] (GameSettings.Options constructors).
export const FLOAT_OPTIONS = {
  SENSITIVITY: [0, 1, 0], FOV: [30, 110, 1], GAMMA: [0, 1, 0], RENDER_DISTANCE: [2, 16, 1],
  FRAMERATE_LIMIT: [10, 260, 10], MIPMAP_LEVELS: [0, 4, 1], ANISOTROPIC_FILTERING: [1, 16, 0], VOLUME: [0, 1, 0],
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// GameSettings.Options.snapToStep / snapToStepClamp / normalizeValue / denormalizeValue.
// ANISOTROPIC_FILTERING overrides snapToStep with MathHelper.roundUpToPowerOfTwo((int) value).
const powerOfTwo = (n) => { let j = n - 1; j |= j >> 1; j |= j >> 2; j |= j >> 4; j |= j >> 8; j |= j >> 16; return j + 1; };
const snap = (o, v) => {
  const [min, max, step] = FLOAT_OPTIONS[o];
  if (o === "ANISOTROPIC_FILTERING") v = powerOfTwo(Math.trunc(v));
  else if (step > 0) v = step * Math.round(v / step);
  return clamp(v, min, max);
};
export const denormalize = (o, v) => { const [min, max] = FLOAT_OPTIONS[o]; return f(snap(o, min + (max - min) * clamp(v, 0, 1))); };
export const normalize = (o, v) => { const [min, max] = FLOAT_OPTIONS[o]; return clamp((snap(o, v) - min) / (max - min), 0, 1); };
// GuiOptionSlider.mousePressed / mouseDragged: (mouseX - (x + 4)) / (width - 8), clamped.
export const sliderValue = (mouseX, x, w) => clamp((mouseX - (x + 4)) / (w - 8), 0, 1);
// The knob is drawn at x + (int)(value * (width - 8)).
export const knobOffset = (value, w) => Math.trunc(value * (w - 8));

const onOff = (b) => t(b ? "options.on" : "options.off");
const OPTION_NAMES = {
  INVERT_MOUSE: "options.invertMouse", SENSITIVITY: "options.sensitivity", FOV: "options.fov", GAMMA: "options.gamma",
  RENDER_DISTANCE: "options.renderDistance", VIEW_BOBBING: "options.viewBobbing", ANAGLYPH: "options.anaglyph",
  FRAMERATE_LIMIT: "options.framerateLimit", DIFFICULTY: "options.difficulty", GRAPHICS: "options.graphics",
  AMBIENT_OCCLUSION: "options.ao", GUI_SCALE: "options.guiScale", RENDER_CLOUDS: "options.renderClouds",
  PARTICLES: "options.particles", USE_FULLSCREEN: "options.fullscreen", ENABLE_VSYNC: "options.vsync",
  TOUCHSCREEN: "options.touchscreen", MIPMAP_LEVELS: "options.mipmapLevels", ANISOTROPIC_FILTERING: "options.anisotropicFiltering",
  FORCE_UNICODE_FONT: "options.forceUnicodeFont",
};
const DIFFICULTIES = ["options.difficulty.peaceful", "options.difficulty.easy", "options.difficulty.normal", "options.difficulty.hard"];
const GUI_SCALES = ["options.guiScale.auto", "options.guiScale.small", "options.guiScale.normal", "options.guiScale.large"];
const PARTICLES = ["options.particles.all", "options.particles.decreased", "options.particles.minimal"];
const AO = ["options.off", "options.ao.min", "options.ao.max"];
// GameSettings.getKeyBinding: "<name>: <value>".
export function optionText(o, v) {
  const s = t(OPTION_NAMES[o]) + ": ";
  switch (o) {
    case "SENSITIVITY": return s + (v === 0 ? t("options.sensitivity.min") : v === 1 ? t("options.sensitivity.max") : Math.trunc(f(f(v) * 200)) + "%");
    case "FOV": return s + (v === 70 ? t("options.fov.min") : v === 110 ? t("options.fov.max") : Math.trunc(v));
    case "GAMMA": return s + (v === 0 ? t("options.gamma.min") : v === 1 ? t("options.gamma.max") : "+" + Math.trunc(f(f(v) * 100)) + "%");
    case "RENDER_DISTANCE": return s + Math.trunc(v) + " chunks";
    case "FRAMERATE_LIMIT": return s + (v === 260 ? t("options.framerateLimit.max") : Math.trunc(v) + " fps");
    case "MIPMAP_LEVELS": return s + (v === 0 ? t("options.off") : Math.trunc(v));
    case "ANISOTROPIC_FILTERING": return s + (v === 1 ? t("options.off") : Math.trunc(v));
    case "DIFFICULTY": return s + t(DIFFICULTIES[v & 3]);
    case "GUI_SCALE": return s + t(GUI_SCALES[v & 3]);
    case "PARTICLES": return s + t(PARTICLES[v] ?? PARTICLES[0]);
    case "AMBIENT_OCCLUSION": return s + t(AO[v] ?? AO[0]);
    case "GRAPHICS": return s + t(v ? "options.graphics.fancy" : "options.graphics.fast");
  }
  return s + onOff(v);
}
// GuiScreenOptionsSounds.Button: "<category>: OFF" or "<category>: N%".
export const soundText = (category, v) => t("soundCategory." + category) + ": " + (v === 0 ? t("options.off") : Math.trunc(f(f(v) * 100)) + "%");

// --- World list and creation. ---
// GuiCreateWorld.func_146314_g / func_146317_a: the folder a new world's name would be saved in.
const ILLEGAL_FILE_CHARS = ["/", "\n", "\r", "\t", "\u0000", "\f", "`", "?", "*", "\\", "<", ">", "|", '"', ":"];
const RESERVED = ["CON", "COM", "PRN", "AUX", "CLOCK$", "NUL", ...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((n) => ["COM" + n, "LPT" + n])];
export function folderName(name, taken = () => false) {
  let s = String(name).trim();
  for (const c of ILLEGAL_FILE_CHARS) s = s.split(c).join("_");
  if (!s) s = "World";
  s = s.replace(/[./"]/g, "_");
  if (RESERVED.some((r) => r.toLowerCase() === s.toLowerCase())) s = "_" + s + "_";
  while (taken(s)) s += "-";
  return s;
}
// new SimpleDateFormat() for en_US: "M/d/yy h:mm a".
export function saveDate(ms) {
  const d = new Date(ms), hours = d.getHours() % 12 || 12;
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear() % 100).padStart(2, "0")} ${hours}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "AM" : "PM"}`;
}
// GuiSelectWorld.List.drawSlot: name (or "World N"), "folder (date)" and the game mode line.
export function worldLines(record, index) {
  const name = record.name || t("selectWorld.world") + " " + (index + 1);
  return [name, `${record.folder || folderName(record.name || "World")} (${saveDate(record.updated || 0)})`, t(record.mode === "survival" || record.mode === "adventure" ? "gameMode." + record.mode : "gameMode.creative")];
}
// The world types the World Type button cycles through: 1.7.10's creatable WorldTypes (DEFAULT,
// FLAT, LARGE_BIOMES, AMPLIFIED, in WorldType.worldTypes order) followed by the browser's own landscapes.
// The four Java types create endless worlds (biome javaStreamed, `worldType` picking the generator);
// the finite 128 x 128 biomes java / javaLargeBiomes / javaAmplified only remain for saved worlds.
// `notice` is drawn under the button as AMPLIFIED's info notice is (only AMPLIFIED has one).
export const WORLD_TYPES = [
  { biome: "javaStreamed", worldType: "default", name: t("generator.default"), notice: "" },
  { biome: "javaStreamed", worldType: "flat", name: t("generator.flat"), notice: "" },
  { biome: "javaStreamed", worldType: "largeBiomes", name: t("generator.largeBiomes"), notice: "" },
  { biome: "javaStreamed", worldType: "amplified", name: t("generator.amplified"), notice: t("generator.amplified.info") },
  { biome: "meadow", name: "Meadow", notice: "Browser landscape: rolling hills and a river" },
  { biome: "alpine", name: "Highlands", notice: "Browser landscape: high mountains" },
  { biome: "island", name: "Island", notice: "Browser landscape: a small island in the sea" },
  { biome: "snowy", name: "Snowy Tundra", notice: "Browser landscape: snow-covered plains" },
];
// The WORLD_TYPES entry a saved world corresponds to (Re-Create): finite Java biomes map to their endless equivalent.
export function worldTypeIndex(record) {
  const wanted = { java: ["javaStreamed", "default"], javaLargeBiomes: ["javaStreamed", "largeBiomes"], javaAmplified: ["javaStreamed", "amplified"], javaStreamed: ["javaStreamed", record?.worldType || "default"] }[record?.biome] ?? [record?.biome];
  return Math.max(0, WORLD_TYPES.findIndex((w) => w.biome === wanted[0] && (w.worldType ?? wanted[1]) === wanted[1]));
}

// --- Key bindings (GameSettings.keyBindings): description, category, LWJGL default and the
// KeyboardEvent.code (or mouse button) the browser game reads for it. ---
export const KEY_BINDINGS = [
  ["key.attack", "key.categories.gameplay", -100, "Mouse0"], ["key.use", "key.categories.gameplay", -99, "Mouse2"],
  ["key.forward", "key.categories.movement", 17, "KeyW"], ["key.left", "key.categories.movement", 30, "KeyA"],
  ["key.back", "key.categories.movement", 31, "KeyS"], ["key.right", "key.categories.movement", 32, "KeyD"],
  ["key.jump", "key.categories.movement", 57, "Space"], ["key.sneak", "key.categories.movement", 42, "ShiftLeft"],
  ["key.drop", "key.categories.gameplay", 16, "KeyQ"], ["key.inventory", "key.categories.inventory", 18, "KeyE"],
  ["key.chat", "key.categories.multiplayer", 20, "KeyT"], ["key.playerlist", "key.categories.multiplayer", 15, "Tab"],
  ["key.pickItem", "key.categories.gameplay", -98, "Mouse1"], ["key.command", "key.categories.multiplayer", 53, "Slash"],
  ["key.screenshot", "key.categories.misc", 60, "F2"], ["key.togglePerspective", "key.categories.misc", 63, "F5"],
  ["key.smoothCamera", "key.categories.misc", 0, ""], ["key.sprint", "key.categories.gameplay", 29, "ControlLeft"],
  ["key.streamStartStop", "key.categories.stream", 64, "F6"], ["key.streamPauseUnpause", "key.categories.stream", 65, "F7"],
  ["key.streamCommercial", "key.categories.stream", 0, ""], ["key.streamToggleMic", "key.categories.stream", 0, ""],
  ["key.fullscreen", "key.categories.misc", 87, "F11"],
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ["key.hotbar." + n, "key.categories.inventory", n + 1, "Digit" + n]),
].map(([description, category, lwjgl, code]) => ({ description, category, lwjgl, code }));
// Keys the player may rebind here; the rest are read as fixed codes by the game loop.
export const REBINDABLE = new Set(["key.smoothCamera"]);
// KeyBinding.compareTo: localized category, then localized description (String.compareTo).
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export function keyListEntries() {
  const sorted = [...KEY_BINDINGS].sort((a, b) => cmp(t(a.category), t(b.category)) || cmp(t(a.description), t(b.description)));
  const out = [];
  let last = null;
  for (const k of sorted) {
    if (k.category !== last) out.push({ category: (last = k.category) });
    out.push({ key: k });
  }
  return out;
}
// LWJGL Keyboard.getKeyName for a KeyboardEvent.code; GameSettings.getKeyDisplayString shows mouse
// buttons as "Button N" and an unbound key as NONE.
const NAMED = {
  Space: "SPACE", ShiftLeft: "LSHIFT", ShiftRight: "RSHIFT", ControlLeft: "LCONTROL", ControlRight: "RCONTROL",
  AltLeft: "LMENU", AltRight: "RMENU", MetaLeft: "LMETA", MetaRight: "RMETA", Tab: "TAB", Enter: "RETURN",
  Backspace: "BACK", Slash: "SLASH", Backslash: "BACKSLASH", Backquote: "GRAVE", Minus: "MINUS", Equal: "EQUALS",
  BracketLeft: "LBRACKET", BracketRight: "RBRACKET", Semicolon: "SEMICOLON", Quote: "APOSTROPHE", Comma: "COMMA",
  Period: "PERIOD", CapsLock: "CAPITAL", ArrowUp: "UP", ArrowDown: "DOWN", ArrowLeft: "LEFT", ArrowRight: "RIGHT",
  Insert: "INSERT", Delete: "DELETE", Home: "HOME", End: "END", PageUp: "PRIOR", PageDown: "NEXT", Pause: "PAUSE",
  ScrollLock: "SCROLL", NumLock: "NUMLOCK", ContextMenu: "APPS", NumpadAdd: "ADD", NumpadSubtract: "SUBTRACT",
  NumpadMultiply: "MULTIPLY", NumpadDivide: "DIVIDE", NumpadDecimal: "DECIMAL", NumpadEnter: "NUMPADENTER", NumpadEqual: "NUMPADEQUALS",
};
export function keyName(code) {
  if (!code) return "NONE";
  const mouse = /^Mouse(\d)$/.exec(code);
  if (mouse) return t("key.mouseButton", [1, 3, 2, 4, 5][+mouse[1]] ?? +mouse[1] + 1);
  if (NAMED[code]) return NAMED[code];
  let m;
  if ((m = /^Key([A-Z])$/.exec(code)) || (m = /^Digit(\d)$/.exec(code)) || (m = /^(F\d+)$/.exec(code))) return m[1];
  if ((m = /^Numpad(\d)$/.exec(code))) return "NUMPAD" + m[1];
  return code.toUpperCase();
}

// --- GuiSlot geometry. ---
// getContentHeight, func_148135_f (the scroll limit) and the scroll bar thumb.
export function slotMetrics({ top, bottom, slotHeight, headerPadding = 0 }, count, scroll = 0) {
  const content = count * slotHeight + headerPadding, max = Math.max(0, content - (bottom - top - 4));
  const s = clamp(scroll, 0, max);
  let thumb = Math.trunc(((bottom - top) * (bottom - top)) / content);
  thumb = clamp(thumb, 32, bottom - top - 8);
  let thumbY = Math.trunc((Math.trunc(s) * (bottom - top - thumb)) / Math.max(1, max)) + top;
  if (thumbY < top) thumbY = top;
  return { content, max, scroll: s, thumb, thumbY };
}
// GuiSlot.drawScreen mouse picking: the slot under (mouseX, mouseY), or -1.
export function slotAt(list, guiWidth, count, scroll, mouseX, mouseY) {
  const left = half(guiWidth) - half(list.width), right = half(guiWidth) + half(list.width);
  const rel = mouseY - list.top - (list.headerPadding ?? 0) + Math.trunc(scroll) - 4, i = Math.trunc(rel / list.slotHeight);
  return mouseX >= left && mouseX <= right && rel >= 0 && i >= 0 && i < count && mouseY >= list.top && mouseY <= list.bottom ? i : -1;
}
