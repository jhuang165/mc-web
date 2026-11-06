// KeyBinding (bal) and GameSettings.keyBindings (bbj.as) of 1.7.10 with LWJGL 2 key codes, read by
// every game input (controls.md, controls-reference.json from tools/verify-controls.mjs).
// Browser KeyboardEvent.code values become LWJGL Keyboard codes and mouse buttons -100 + button, so
// options.txt key_* lines, Keyboard.getKeyName labels and the KeyBinding hash work on native numbers.

// GameSettings.keyBindings in saved order: description, category, default code and the index in
// KeyBinding.keybindArray (registration order, which decides who owns a shared code).
export const BINDINGS = [
  ["key.attack", "key.categories.gameplay", -100, 9], ["key.use", "key.categories.gameplay", -99, 7],
  ["key.forward", "key.categories.movement", 17, 0], ["key.left", "key.categories.movement", 30, 1],
  ["key.back", "key.categories.movement", 31, 2], ["key.right", "key.categories.movement", 32, 3],
  ["key.jump", "key.categories.movement", 57, 4], ["key.sneak", "key.categories.movement", 42, 5],
  ["key.drop", "key.categories.gameplay", 16, 8], ["key.inventory", "key.categories.inventory", 18, 6],
  ["key.chat", "key.categories.multiplayer", 20, 12], ["key.playerlist", "key.categories.multiplayer", 15, 13],
  ["key.pickItem", "key.categories.gameplay", -98, 10], ["key.command", "key.categories.multiplayer", 53, 14],
  ["key.screenshot", "key.categories.misc", 60, 15], ["key.togglePerspective", "key.categories.misc", 63, 16],
  ["key.smoothCamera", "key.categories.misc", 0, 17], ["key.sprint", "key.categories.gameplay", 29, 11],
  ["key.streamStartStop", "key.categories.stream", 64, 19], ["key.streamPauseUnpause", "key.categories.stream", 65, 20],
  ["key.streamCommercial", "key.categories.stream", 0, 21], ["key.streamToggleMic", "key.categories.stream", 0, 22],
  ["key.fullscreen", "key.categories.misc", 87, 18],
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ["key.hotbar." + n, "key.categories.inventory", n + 1, 22 + n]),
].map(([description, category, defaultKey, registration]) => ({ description, category, defaultKey, registration }));
export const DEFAULT_KEYS = Object.fromEntries(BINDINGS.map((b) => [b.description, b.defaultKey]));
// GameSettings.keyBindsHotbar.
export const HOTBAR = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => "key.hotbar." + n);

// LWJGL 2.9 Keyboard.getKeyName for every named code (131 names; 84-86, 89-99 and others have none).
export const KEY_NAMES = Object.freeze({
  0: "NONE", 1: "ESCAPE", 2: "1", 3: "2", 4: "3", 5: "4", 6: "5", 7: "6", 8: "7", 9: "8", 10: "9", 11: "0", 12: "MINUS",
  13: "EQUALS", 14: "BACK", 15: "TAB", 16: "Q", 17: "W", 18: "E", 19: "R", 20: "T", 21: "Y", 22: "U", 23: "I", 24: "O",
  25: "P", 26: "LBRACKET", 27: "RBRACKET", 28: "RETURN", 29: "LCONTROL", 30: "A", 31: "S", 32: "D", 33: "F", 34: "G",
  35: "H", 36: "J", 37: "K", 38: "L", 39: "SEMICOLON", 40: "APOSTROPHE", 41: "GRAVE", 42: "LSHIFT", 43: "BACKSLASH",
  44: "Z", 45: "X", 46: "C", 47: "V", 48: "B", 49: "N", 50: "M", 51: "COMMA", 52: "PERIOD", 53: "SLASH", 54: "RSHIFT",
  55: "MULTIPLY", 56: "LMENU", 57: "SPACE", 58: "CAPITAL", 59: "F1", 60: "F2", 61: "F3", 62: "F4", 63: "F5", 64: "F6",
  65: "F7", 66: "F8", 67: "F9", 68: "F10", 69: "NUMLOCK", 70: "SCROLL", 71: "NUMPAD7", 72: "NUMPAD8", 73: "NUMPAD9",
  74: "SUBTRACT", 75: "NUMPAD4", 76: "NUMPAD5", 77: "NUMPAD6", 78: "ADD", 79: "NUMPAD1", 80: "NUMPAD2", 81: "NUMPAD3",
  82: "NUMPAD0", 83: "DECIMAL", 87: "F11", 88: "F12", 100: "F13", 101: "F14", 102: "F15", 103: "F16", 104: "F17",
  105: "F18", 112: "KANA", 113: "F19", 121: "CONVERT", 123: "NOCONVERT", 125: "YEN", 141: "NUMPADEQUALS",
  144: "CIRCUMFLEX", 145: "AT", 146: "COLON", 147: "UNDERLINE", 148: "KANJI", 149: "STOP", 150: "AX", 151: "UNLABELED",
  156: "NUMPADENTER", 157: "RCONTROL", 167: "SECTION", 179: "NUMPADCOMMA", 181: "DIVIDE", 183: "SYSRQ", 184: "RMENU",
  196: "FUNCTION", 197: "PAUSE", 199: "HOME", 200: "UP", 201: "PRIOR", 203: "LEFT", 205: "RIGHT", 207: "END",
  208: "DOWN", 209: "NEXT", 210: "INSERT", 211: "DELETE", 218: "CLEAR", 219: "LMETA", 220: "RMETA", 221: "APPS",
  222: "POWER", 223: "SLEEP",
});

// KeyboardEvent.code to the LWJGL code the same physical key reports on a US keyboard (LWJGL's
// Windows scan-code table; macOS LWJGL maps Command to LMETA/RMETA and keypad Clear to CLEAR).
const ROWS = [
  [16, "QWERTYUIOP"], [30, "ASDFGHJKL"], [44, "ZXCVBNM"],
];
export const CODE_TO_LWJGL = Object.freeze({
  Escape: 1, Digit1: 2, Digit2: 3, Digit3: 4, Digit4: 5, Digit5: 6, Digit6: 7, Digit7: 8, Digit8: 9, Digit9: 10, Digit0: 11,
  Minus: 12, Equal: 13, Backspace: 14, Tab: 15, BracketLeft: 26, BracketRight: 27, Enter: 28, ControlLeft: 29,
  Semicolon: 39, Quote: 40, Backquote: 41, ShiftLeft: 42, Backslash: 43, Comma: 51, Period: 52, Slash: 53,
  ShiftRight: 54, NumpadMultiply: 55, AltLeft: 56, Space: 57, CapsLock: 58,
  F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64, F7: 65, F8: 66, F9: 67, F10: 68, NumLock: 69, ScrollLock: 70,
  Numpad7: 71, Numpad8: 72, Numpad9: 73, NumpadSubtract: 74, Numpad4: 75, Numpad5: 76, Numpad6: 77, NumpadAdd: 78,
  Numpad1: 79, Numpad2: 80, Numpad3: 81, Numpad0: 82, NumpadDecimal: 83, IntlBackslash: 86, F11: 87, F12: 88,
  F13: 100, F14: 101, F15: 102, F16: 103, F17: 104, F18: 105, KanaMode: 112, F19: 113, Convert: 121, NonConvert: 123,
  IntlYen: 125, NumpadEqual: 141, NumpadEnter: 156, ControlRight: 157, NumpadComma: 179, NumpadDivide: 181,
  PrintScreen: 183, AltRight: 184, Pause: 197, Home: 199, ArrowUp: 200, PageUp: 201, ArrowLeft: 203, ArrowRight: 205,
  End: 207, ArrowDown: 208, PageDown: 209, Insert: 210, Delete: 211, NumpadClear: 218, MetaLeft: 219, OSLeft: 219,
  MetaRight: 220, OSRight: 220, ContextMenu: 221, Power: 222, Sleep: 223,
  ...Object.fromEntries(ROWS.flatMap(([base, letters]) => [...letters].map((l, i) => ["Key" + l, base + i]))),
});
// The LWJGL code of a KeyboardEvent (or a KeyboardEvent.code string); 0 (NONE) when it has none.
export const lwjglCode = (e) => CODE_TO_LWJGL[typeof e === "string" ? e : e?.code] ?? 0;
// Mouse.getEventButton numbers 0 left, 1 right, 2 middle; the browser's MouseEvent.button is 0 left,
// 1 middle, 2 right. runTick passes button - 100 to KeyBinding.setKeyBindState.
const MOUSE_BUTTON = [0, 2, 1, 3, 4];
export const lwjglButton = (button) => MOUSE_BUTTON[button] ?? button;
export const mouseCode = (button) => -100 + lwjglButton(button);

// GameSettings.getKeyDisplayString: I18n "key.mouseButton" with code + 101 for a mouse code, else
// Keyboard.getKeyName: null for an unnamed code (an empty button; "> null <" when concatenated).
export function keyDisplayString(code, format = (n) => "Button " + n) {
  return code < 0 ? format(code + 101) : KEY_NAMES[code] ?? null;
}

const valid = (c) => Number.isInteger(c) && c >= -100 && c <= 255;
// options.keyBindings (description -> code) from storage, including the earlier browser save of
// KeyboardEvent.code strings in options.keys ("" unbound, "MouseN" a browser button).
export function storedKeyCodes(options) {
  const out = {};
  const legacy = options?.keys && typeof options.keys === "object" ? options.keys : {};
  for (const [d, v] of Object.entries(legacy)) {
    if (!(d in DEFAULT_KEYS) || typeof v !== "string") continue;
    const mouse = /^Mouse(\d)$/.exec(v);
    out[d] = v === "" ? 0 : mouse ? mouseCode(+mouse[1]) : lwjglCode(v);
  }
  const saved = options?.keyBindings && typeof options.keyBindings === "object" ? options.keyBindings : {};
  for (const [d, v] of Object.entries(saved)) if (d in DEFAULT_KEYS && valid(v)) out[d] = v;
  return out;
}

// KeyBinding state: the code of every binding, the static hash (pz) of code -> binding that
// resetKeyBindingArrayAndHash rebuilds in registration order (the later binding keeps a shared
// code), pressed (setKeyBindState) and pressTime (onTick / isPressed).
export class KeyBindings {
  constructor(codes = {}) {
    this.codes = { ...DEFAULT_KEYS };
    for (const [d, v] of Object.entries(codes)) if (d in DEFAULT_KEYS && valid(v)) this.codes[d] = v;
    this.pressed = {};
    this.pressTime = {};
    this.touch = new Set();
    this.resetHash();
  }
  code(description) { return this.codes[description] ?? 0; }
  // KeyBinding.resetKeyBindingArrayAndHash.
  resetHash() {
    this.hash = new Map();
    for (const b of [...BINDINGS].sort((a, b) => a.registration - b.registration)) this.hash.set(this.codes[b.description], b.description);
  }
  // GameSettings.setOptionKeyBinding; GuiControls rebuilds the hash right after (rebuild = false
  // keeps the old routing, as setOptionKeyBinding alone does).
  setKeyCode(description, code, rebuild = true) {
    if (!(description in DEFAULT_KEYS) || !valid(code)) return;
    this.codes[description] = code;
    if (rebuild) this.resetHash();
  }
  // GuiControls "Reset Keys": every binding to its default, then the hash.
  resetAll() {
    this.codes = { ...DEFAULT_KEYS };
    this.resetHash();
  }
  // The binding a code reaches through the hash, or null; code 0 never reaches one.
  binding(code) { return code === 0 ? null : this.hash.get(code) ?? null; }
  // KeyBinding.setKeyBindState and, on a press, onTick: returns the binding the code reached.
  set(code, down) {
    const d = this.binding(code);
    if (!d) return null;
    this.pressed[d] = down;
    if (down) this.pressTime[d] = (this.pressTime[d] ?? 0) + 1;
    return d;
  }
  // KeyBinding.isPressed: consumes one counted press.
  isPressed(description) {
    if (!this.pressTime[description]) return false;
    this.pressTime[description]--;
    return true;
  }
  // KeyBinding.getIsKeyPressed, plus the on-screen touch buttons (held by binding).
  isDown(description) { return !!this.pressed[description] || this.touch.has(description); }
  // KeyBinding.unPressAllKeys (focus lost, a screen opened): releases and clears counted presses.
  releaseAll() {
    this.pressed = {};
    this.pressTime = {};
    this.touch.clear();
  }
  // KeyEntry: red when the code is bound and another binding has the same code.
  conflict(description) {
    const c = this.codes[description];
    return c !== 0 && BINDINGS.some((b) => b.description !== description && this.codes[b.description] === c);
  }
  // GuiControls "Reset Keys" is enabled while any binding is off its default.
  changed() { return BINDINGS.some((b) => this.codes[b.description] !== b.defaultKey); }
  // Codes that differ from the default (the device save; options.txt writes every binding).
  saved() {
    return Object.fromEntries(BINDINGS.filter((b) => this.codes[b.description] !== b.defaultKey).map((b) => [b.description, this.codes[b.description]]));
  }
}

// The held KeyboardEvent codes of the page; clearing it (a screen opening, focus lost) is also
// KeyBinding.unPressAllKeys for the bindings.
export class HeldKeys extends Set {
  constructor(bindings) {
    super();
    this.bindings = bindings;
  }
  clear() {
    super.clear();
    this.bindings?.releaseAll();
  }
}
