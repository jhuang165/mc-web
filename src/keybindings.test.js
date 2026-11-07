import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BINDINGS, HOTBAR, KEY_NAMES, CODE_TO_LWJGL, KeyBindings, keyDisplayString, lwjglCode, mouseCode, storedKeyCodes,
} from './keybindings.js';
import { javaFloat, writeOptionsTxt, parseOptionsTxt, applyOptionsTxt, OPTION_LINES } from './options-txt.js';
import { FrameLimiter, limitFramerate } from './frame-limit.js';
import { KEY_BINDINGS, keyName } from './menu-screens.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/controls-reference.json', import.meta.url)));
const rec = (c) => ref.records.filter((r) => r.case === c);
const one = (c) => rec(c)[0];

test('every 1.7.10 KeyBinding with its default, category and registration order', () => {
  assert.deepEqual(BINDINGS.map((b) => [b.description, b.defaultKey, b.category, b.registration]),
    rec('binding').map((b) => [b.description, b.defaultKey, b.category, b.registration]));
  assert.deepEqual(HOTBAR, rec('hotbar').map((h) => h.description));
  // The menu list is the same table.
  assert.deepEqual(KEY_BINDINGS.map((k) => [k.description, k.lwjgl]), BINDINGS.map((b) => [b.description, b.defaultKey]));
});

test('LWJGL Keyboard.getKeyName and GameSettings.getKeyDisplayString', () => {
  const names = one('keyNames').names;
  assert.deepEqual(Object.entries(KEY_NAMES).map(([c, n]) => [+c, n]), names.map(([c, n]) => [c, n]));
  for (const [c, n, back] of names) assert.equal(back, c, n);
  for (const [c, s] of one('displayString').values) assert.equal(keyDisplayString(c), s);
  assert.equal(keyDisplayString(-100), 'Button 1');
  assert.equal(keyDisplayString(-98), 'Button 3');
  assert.equal(keyDisplayString(86), null);
  // Every browser key code maps to a named LWJGL code except the unnamed OEM_102 (86).
  for (const [code, n] of Object.entries(CODE_TO_LWJGL)) if (n !== 86) assert(KEY_NAMES[n], code);
  assert.deepEqual(['KeyW', 'ShiftLeft', 'ControlLeft', 'Space', 'Slash', 'F2', 'F11', 'ArrowUp', 'MetaLeft', 'Numpad0', 'Unknown'].map(lwjglCode),
    [17, 42, 29, 57, 53, 60, 87, 200, 219, 82, 0]);
  // Mouse.getEventButton numbers 0 left, 1 right, 2 middle; the browser's 1 is the middle button.
  assert.deepEqual([0, 1, 2, 3, 4].map(mouseCode), [-100, -98, -99, -97, -96]);
  assert.deepEqual([-100, -99, -98, 17, 0].map(keyName), ['Button 1', 'Button 2', 'Button 3', 'W', 'NONE']);
});

test('the KeyBinding hash: the later registration keeps a shared code; presses count', () => {
  const k = new KeyBindings();
  for (const h of rec('hash')) assert.equal(k.binding(h.code), h.code === 0 ? null : h.binding, String(h.code));
  // setKeyBindState(17) + two onTick: isPressed true, true, false.
  const [fwd, mouse, zero] = rec('press');
  k.set(17, true); k.pressTime['key.forward'] = 2;
  assert.deepEqual(BINDINGS.filter((b) => k.isDown(b.description)).map((b) => b.description), fwd.pressed);
  assert.deepEqual([k.isPressed('key.forward'), k.isPressed('key.forward'), k.isPressed('key.forward')], fwd.isPressed);
  k.set(17, false);
  assert.equal(k.set(-100, true), mouse.pressed[0]);
  assert.deepEqual([k.isPressed('key.attack'), k.isPressed('key.attack')], mouse.isPressed);
  k.releaseAll();
  assert.equal(k.set(0, true), null);
  assert.deepEqual(BINDINGS.filter((b) => k.isDown(b.description)).map((b) => b.description), zero.pressed);

  const [jump, forward] = rec('conflict');
  k.setKeyCode('key.left', 57);
  assert.equal(k.binding(57), jump.winner);
  assert(k.conflict('key.left') && k.conflict('key.jump') && !k.conflict('key.forward'));
  k.setKeyCode('key.left', 17);
  assert.equal(k.binding(17), forward.winner);
  assert.equal(k.binding(30), forward.hash30);
  // setOptionKeyBinding without the rebuild keeps routing the old code.
  const nr = one('noRebuild');
  k.setKeyCode('key.left', 44, false);
  assert.equal(k.code('key.left'), nr.keyLeft);
  assert.equal(k.binding(44), nr.hash44);
  assert.equal(k.binding(17), nr.hash17);
  const restored = one('restored');
  k.setKeyCode('key.left', 30);
  assert.deepEqual([k.binding(30), k.binding(17), k.binding(44)], [restored.hash30, restored.hash17, restored.hash44]);
  // Unbound keys never conflict; Reset Keys restores every default.
  assert(!k.conflict('key.smoothCamera'));
  k.setKeyCode('key.drop', -97);
  assert(k.changed());
  assert.deepEqual(k.saved(), { 'key.drop': -97 });
  k.resetAll();
  assert(!k.changed());
  assert.equal(k.binding(16), 'key.drop');
});

test('stored key codes: options.keyBindings and the earlier KeyboardEvent.code save', () => {
  assert.deepEqual(storedKeyCodes({ keys: { 'key.smoothCamera': 'F8', 'key.jump': 'Mouse1', 'key.drop': '', bogus: 'KeyX' } }),
    { 'key.smoothCamera': 66, 'key.jump': -98, 'key.drop': 0 });
  assert.deepEqual(storedKeyCodes({ keys: { 'key.jump': 'KeyJ' }, keyBindings: { 'key.jump': 200, 'key.use': 'x', 'key.attack': 999 } }), { 'key.jump': 200 });
});

test('options.txt: Float.toString, the native default file and loadOptions', () => {
  assert.deepEqual([1, 0.5, 0, 0.44366196, 0.5412844, 0.31690142, 0.25, 120, 1e-4, 1e7, 0.001, -0.5].map(javaFloat),
    ['1.0', '0.5', '0.0', '0.44366196', '0.5412844', '0.31690142', '0.25', '120.0', '1.0E-4', '1.0E7', '0.001', '-0.5']);
  const defaults = {
    sensitivity: 0.5, invertMouse: false, fov: 70, distance: 12, guiScale: 0, particles: 0, bobbing: true, difficulty: 2, gamma: 0,
    graphics: true, ao: 2, clouds: true, mipmapLevels: 4, anisotropic: 1, soundLevels: {},
  };
  assert.equal(writeOptionsTxt(defaults), one('defaultOptionsTxt').text);
  assert.equal(writeOptionsTxt({}), one('defaultOptionsTxt').text);

  const load = one('loadOptions');
  const { options, keyBindings, skipped } = parseOptionsTxt(load.input);
  const codes = { ...Object.fromEntries(BINDINGS.map((b) => [b.description, b.defaultKey])), ...keyBindings };
  assert.deepEqual(codes, load.bindings);
  assert.equal(options.maxFps, load.maxFps);
  assert.equal(options.vsync, load.enableVsync);
  assert.equal(options.sensitivity, load.mouseSensitivity);
  assert.equal(options.invertMouse, load.invertYMouse);
  assert.equal(options.pauseOnLostFocus, load.pauseOnLostFocus);
  assert.equal(options.advancedTooltips, load.advancedItemTooltips);
  assert.deepEqual(skipped, ['key_key.jump:abc']);
  const k = new KeyBindings(keyBindings);
  assert.equal(k.binding(200), load.hash200);
  // The probe's hash17 is key.forward of an earlier GameSettings in the same JVM (KeyBinding.keybindArray is
  // static and keeps every instance); with one set of bindings nothing owns 17 after the rebind.
  assert.equal(load.hash17, 'key.forward');
  assert.equal(k.binding(17), null);
  // The rewrite keeps the saveOptions order, not the file's.
  const applied = applyOptionsTxt({ ...defaults }, load.input).options;
  assert.equal(writeOptionsTxt(applied), one('resaved').text);
  // fov is saved as (fov - 70) / 40.
  assert.equal(parseOptionsTxt('fov:1.0').options.fov, 110);
  assert.match(writeOptionsTxt({ fov: 90 }), /^fov:0\.5$/m);
  // Unused lines of an imported file come back on export.
  const round = applyOptionsTxt({}, 'lang:fr_FR\nanaglyph3d:true\nsoundCategory_music:0.25\n').options;
  assert.match(writeOptionsTxt(round), /^lang:fr_FR$/m);
  assert.match(writeOptionsTxt(round), /^anaglyph3d:true$/m);
  assert.match(writeOptionsTxt(round), /^soundCategory_music:0\.25$/m);
  assert.equal(OPTION_LINES.length, one('defaultOptionsTxt').text.split('\n').filter((l) => l && !/^(key_|soundCategory_)/.test(l)).length);
});

test('Max Framerate: Display.sync spacing, Unlimited at 260 and 30 fps on the title screen', () => {
  const fr = one('framerate');
  assert.deepEqual([fr.min, fr.max, fr.step], [10, 260, 10]);
  assert.equal(limitFramerate({ world: false, screen: true, maxFps: 120 }), 30);
  assert.equal(limitFramerate({ world: true, screen: true, maxFps: 120 }), 120);
  // 60 Hz animation frames under a 30 fps limit draw every other frame.
  const l = new FrameLimiter(), drawn = [];
  for (let i = 0; i < 12; i++) if (l.ready(i * 1000 / 60, 30)) drawn.push(i);
  assert.deepEqual(drawn, [0, 2, 4, 6, 8, 10]);
  const u = new FrameLimiter();
  assert(Array.from({ length: 5 }, (_, i) => u.ready(i, 260)).every(Boolean));
  // 50 fps on 60 Hz: 5 of 6 frames per 100 ms.
  const h = new FrameLimiter();
  assert.equal(Array.from({ length: 60 }, (_, i) => h.ready(i * 1000 / 60, 50)).filter(Boolean).length, 50);
});

test('game input reads the bindings, not fixed KeyboardEvent codes', () => {
  const main = readFileSync(new URL('./main.js', import.meta.url), 'utf8');
  const menus = readFileSync(new URL('./menus.js', import.meta.url), 'utf8');
  // No fixed action keys or mouse buttons in the game's handlers (Escape and the raw F-keys stay codes, as natively).
  for (const fixed of ['"KeyE"', '"KeyQ"', '"KeyT"', '"F5"', 'e.button === 2', 'e.button === 1', 'options.keys?.']) assert(!main.includes(fixed), fixed);
  assert.match(main, /binds\.set\(code, true\)/);
  // Key events whose target is window or document (no Element.matches) still reach the bindings.
  assert.match(main, /if \(e\.target instanceof Element && e\.target\.matches\("input,select,textarea"\)\) return;/);
  assert(!/[^&] e\.target\.matches\(/.test(main), 'every e.target.matches is behind the Element guard');
  assert.match(main, /binds\.set\(mouseCode\(e\.button\), true\)/);
  assert.match(main, /captureMovementInput\(bedSleep\.sleeping \? \(\) => false : \(d\) => binds\.isDown\(d\)\)/);
  assert.match(main, /frameLimiter\.ready\(now, limitFramerate\(/);
  assert(!/REBINDABLE|fixedKey/.test(menus));
  // runTick has no F8 check in 1.7.10; F3 toggles the debug screen on its press (code 61).
  assert(!/"F8"|code === 66/.test(main));
  assert.match(main, /if \(code === 61\) \{ debug = !debug;/);
  assert(ref.runTick.whenNoScreen['61'].includes('on key down'));
  assert(!main.includes('Advanced tooltips: '), 'F3+H prints nothing in 1.7.10');
});
