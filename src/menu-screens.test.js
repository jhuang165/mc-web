import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  LANG, t, textWidth, trimToWidth, splitLines, shadowColor, javaHash, pickSplash, splashScale,
  mainMenuLayout, selectWorldLayout, createWorldLayout, yesNoLayout, renameWorldLayout, ingameMenuLayout,
  optionsLayout, videoSettingsLayout, controlsLayout, soundsLayout, languageLayout, VIDEO_OPTIONS, CONTROLS_OPTIONS,
  FLOAT_OPTIONS, denormalize, normalize, sliderValue, knobOffset, optionText, soundText,
  folderName, saveDate, worldLines, WORLD_TYPES, KEY_BINDINGS, keyListEntries, keyName, slotMetrics, slotAt, scaledSize,
} from './menu-screens.js';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');
const ref = JSON.parse(await read('../public/research/settings-reference.json'));
const splashes = await read('../public/media/1.7.10/texts/splashes.txt');

test('menu strings match en_US.lang where the settings reference has them', () => {
  for (const [key, value] of Object.entries(ref.lang)) if (key in LANG) assert.equal(LANG[key], value, key);
  assert.equal(t('selectWorld.newWorld.copyOf', 'A'), 'Copy of A');
  assert.equal(t('options.languageWarning'), 'Language translations may not be 100% accurate');
  assert.equal(t('key.mouseButton', 4), 'Button 4');
});

test('FontRenderer widths, trimming, wrapping and shadows', () => {
  assert.equal(textWidth('Singleplayer'), 62);
  assert.equal(textWidth('§eA'), 6);
  assert.equal(trimToWidth('abcdef', 12), 'ab');
  assert.deepEqual(splitLines('Notice: Just for fun, requires beefy computer', 150), ['Notice: Just for fun, requires', 'beefy computer']);
  assert.equal(shadowColor(0xffffff), 0x3f3f3f);
  assert.equal(shadowColor(0xe0e0e0), 0x383838);
  assert.equal(shadowColor(0xffffa0), 0x3f3f28);
});

test('GuiMainMenu splash rules and layout', () => {
  assert.equal(javaHash('hello'), 99162322);
  const lines = splashes.split(/\r?\n/).filter((l) => l.trim());
  assert(lines.length > 300);
  const s = pickSplash(splashes, new Date(2026, 4, 3), () => 0);
  assert(lines.includes(s), s);
  assert.equal(pickSplash(splashes, new Date(2026, 11, 24)), 'Merry X-mas!');
  assert.equal(pickSplash(splashes, new Date(2026, 0, 1)), 'Happy new year!');
  assert.equal(pickSplash(splashes, new Date(2026, 9, 31)), 'OOoooOOOoooo! Spooky!');
  // splashScale: (1.8 - |sin(ms % 1000 / 1000 * 2pi) * 0.1|) * 100 / (width + 32).
  assert(Math.abs(splashScale('abc', 0) - 1.8 * 100 / (textWidth('abc') + 32)) < 1e-6);
  const L = mainMenuLayout(427, 240);
  assert.deepEqual(L.buttons.singleplayer, { x: 113, y: 108, w: 200, h: 20 });
  assert.deepEqual([L.buttons.multiplayer.y, L.buttons.online.y, L.buttons.options.y], [132, 156, 192]);
  assert.deepEqual([L.buttons.options.w, L.buttons.quit.x, L.buttons.language.x, L.buttons.language.w], [98, 215, 89, 20]);
  assert.deepEqual([L.logo, L.splash, L.version, L.copyright], [[76, 30], [303, 70], [2, 230], [425, 230]]);
});

test('world screens follow GuiSelectWorld, GuiCreateWorld, GuiYesNo and GuiRenameWorld', () => {
  const S = selectWorldLayout(427, 240);
  assert.deepEqual(S.list, { top: 32, bottom: 176, slotHeight: 36, width: 220, scrollbarX: 337 });
  assert.deepEqual([S.buttons.select, S.buttons.cancel], [{ x: 59, y: 188, w: 150, h: 20 }, { x: 295, y: 212, w: 72, h: 20 }]);
  const C = createWorldLayout(427, 240);
  assert.deepEqual([C.buttons.gameMode, C.buttons.moreOptions, C.field], [{ x: 138, y: 115, w: 150, h: 20 }, { x: 138, y: 187, w: 150, h: 20 }, { x: 113, y: 60, w: 200, h: 20 }]);
  assert.deepEqual([C.buttons.create.y, C.labels.resultFolder, C.labels.allowCommandsInfo], [212, [113, 85], [63, 172]]);
  const Y = yesNoLayout(427, 240);
  assert.deepEqual([Y.buttons.yes, Y.buttons.no.x, Y.line1, Y.line2], [{ x: 58, y: 136, w: 150, h: 20 }, 218, [213, 70], [213, 90]]);
  const R = renameWorldLayout(427, 240);
  assert.deepEqual([R.buttons.rename.y, R.buttons.cancel.y], [168, 192]);
  // GuiCreateWorld.func_146317_a.
  assert.equal(folderName('New World'), 'New World');
  assert.equal(folderName('a/b:c'), 'a_b_c');
  assert.equal(folderName('  '), 'World');
  assert.equal(folderName('con'), '_con_');
  assert.equal(folderName('World', (s) => s === 'World' || s === 'World-'), 'World--');
  assert.equal(saveDate(new Date(2026, 10, 2, 0, 5).getTime()), '11/2/26 12:05 AM');
  assert.deepEqual(worldLines({ name: '', mode: 'survival', updated: new Date(2026, 0, 9, 13, 30).getTime() }, 2), ['World 3', 'World (1/9/26 1:30 PM)', 'Survival Mode']);
  assert.deepEqual(WORLD_TYPES.slice(0, 3).map((w) => w.name), ['Default', 'Large Biomes', 'Amplified']);
  assert(WORLD_TYPES.slice(0, 3).every((w) => w.biome === 'javaStreamed'));
});

test('GuiIngameMenu, GuiOptions and its sub-screens', () => {
  const I = ingameMenuLayout(427, 240);
  assert.deepEqual([I.buttons.returnToGame.y, I.buttons.achievements.y, I.buttons.options.y, I.buttons.returnToMenu.y], [68, 92, 140, 164]);
  const O = optionsLayout(427, 240);
  assert.deepEqual([O.buttons.fov, O.buttons.difficulty.x, O.buttons.done], [{ x: 58, y: 28, w: 150, h: 20 }, 218, { x: 113, y: 208, w: 200, h: 20 }]);
  assert.equal(VIDEO_OPTIONS.length, 14);
  assert.deepEqual(videoSettingsLayout(427, 240).list, { top: 32, bottom: 208, slotHeight: 25, width: 400, scrollbarX: 369 });
  assert.deepEqual(CONTROLS_OPTIONS, ['INVERT_MOUSE', 'SENSITIVITY', 'TOUCHSCREEN']);
  assert.deepEqual(controlsLayout(427, 240).options[2], { x: 58, y: 42, w: 150, h: 20 });
  const So = soundsLayout(427, 240);
  assert.deepEqual([So.sliders.master, So.sliders.music, So.sliders.record], [{ x: 58, y: 28, w: 310, h: 20 }, { x: 58, y: 52, w: 150, h: 20 }, { x: 218, y: 52, w: 150, h: 20 }]);
  assert.deepEqual(languageLayout(427, 240).buttons.done, { x: 218, y: 202, w: 150, h: 20 });
  for (const s of ['GuiOptions', 'GuiVideoSettings', 'GuiScreenOptionsSounds', 'GuiControls', 'GuiLanguage']) assert(ref.screenLayouts.some((l) => l.mappedClass.endsWith('/' + s)), s);
});

test('option values, labels and sliders use GameSettings.Options', () => {
  for (const o of ref.options.filter((o) => o.isFloat && FLOAT_OPTIONS[o.name])) {
    assert.deepEqual(FLOAT_OPTIONS[o.name].slice(0, 2), [o.min, o.max], o.name);
    assert.equal(denormalize(o.name, 0.5), Math.fround(o.slider.rawAt0_5), o.name);
  }
  assert.equal(normalize('FOV', 70), 0.5);
  assert.equal(sliderValue(4, 0, 150), 0);
  assert.equal(knobOffset(1, 150), 142);
  assert.equal(optionText('FOV', 70), 'FOV: Normal');
  assert.equal(optionText('SENSITIVITY', 0.5), 'Sensitivity: 100%');
  assert.equal(optionText('GAMMA', 0), 'Brightness: Moody');
  assert.equal(optionText('RENDER_DISTANCE', 12), 'Render Distance: 12 chunks');
  assert.equal(optionText('GUI_SCALE', 0), 'GUI Scale: Auto');
  assert.equal(optionText('DIFFICULTY', 2), 'Difficulty: Normal');
  assert.equal(optionText('FRAMERATE_LIMIT', 260), 'Max Framerate: Unlimited');
  assert.equal(soundText('master', 0), 'Master Volume: OFF');
  assert.equal(soundText('block', 0.5), 'Blocks: 50%');
});

test('key bindings match the 1.7.10 list and GuiKeyBindingList order', () => {
  assert.deepEqual(KEY_BINDINGS.map((k) => k.description).sort(), ref.keyBindings.map((k) => k.description).sort());
  for (const k of ref.keyBindings) {
    const mine = KEY_BINDINGS.find((m) => m.description === k.description);
    assert.equal(mine.lwjgl, k.defaultKey, k.description);
    assert.equal(mine.category, k.category, k.description);
  }
  const entries = keyListEntries();
  assert.deepEqual(entries.filter((e) => e.category).map((e) => t(e.category)), ['Gameplay', 'Inventory', 'Miscellaneous', 'Movement', 'Multiplayer', 'Streaming']);
  assert.equal(entries[1].key.description, 'key.attack');
  assert.deepEqual(['Mouse0', 'Mouse2', 'Mouse1', 'KeyW', 'ShiftLeft', 'Digit1', 'F11', ''].map(keyName), ['Button 1', 'Button 2', 'Button 3', 'W', 'LSHIFT', '1', 'F11', 'NONE']);
});

test('GuiSlot metrics and picking', () => {
  const list = { top: 32, bottom: 176, slotHeight: 36, width: 220 };
  assert.deepEqual(slotMetrics(list, 2), { content: 72, max: 0, scroll: 0, thumb: 136, thumbY: 32 });
  const m = slotMetrics(list, 10, 999);
  assert.equal(m.max, 360 - 140);
  assert.equal(m.scroll, m.max);
  assert.equal(slotAt(list, 427, 2, 0, 213, 40), 0);
  assert.equal(slotAt(list, 427, 2, 0, 213, 80), 1);
  assert.equal(slotAt(list, 427, 2, 0, 213, 130), -1);
  assert.equal(slotAt(list, 427, 2, 0, 10, 40), -1);
  assert.deepEqual(scaledSize(1280, 720, 3), { w: 427, h: 240 });
});
