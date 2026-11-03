import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DIFFICULTY_NAMES, NORMAL, difficultySetting } from './difficulty.js';
import { particleSetting } from './particle-settings.js';
import { guiScale } from './gui.js';
import { GUI_SCALE_NAMES } from './settings.js';
import { FLOAT_OPTIONS, LANG, CONTROLS_OPTIONS, KEY_BINDINGS, REBINDABLE, optionText, soundsLayout } from './menu-screens.js';

const read = name => readFile(new URL(name, import.meta.url), 'utf8');
const ref = JSON.parse(await read('../public/research/settings-reference.json'));
const catalogue = await read('../public/research/settings-parity-catalogue.md');
const main = await read('./main.js');
const option = name => ref.options.find(o => o.name === name);
const defaults = Object.fromEntries(ref.gameSettingsFields.filter(f => f.optionsKey).map(f => [f.optionsKey, f.defaultValue]));
// Literal defaults of the port's `let options = {...}` object in main.js (no DOM needed).
const portOptions = Object.fromEntries([...main.match(/let options = \{([\s\S]*?)\n\};/)[1].matchAll(/^\s*(\w+)\s*:\s*([-\d.]+|true|false)\s*,/gm)].map(m => [m[1], JSON.parse(m[2])]));
// The menu sliders (menus.js) take their ranges from GameSettings.Options in menu-screens.js.
const SLIDERS = { gamma: 'GAMMA', fov: 'FOV', distance: 'RENDER_DISTANCE', sensitivity: 'SENSITIVITY' };
const slider = id => FLOAT_OPTIONS[SLIDERS[id]].slice(0, 2);

test('settings reference has the native counts and provenance', () => {
  assert.equal(ref.clientSha1, 'e80d9b3bf5085002218d4be59e668bac718abbc6');
  assert.deepEqual([ref.options.length, ref.keyBindings.length, ref.hotbarKeys.length, ref.soundCategories.length, ref.screenLayouts.length], [44, 32, 9, 9, 8]);
  assert.deepEqual(ref.options.map(o => o.ordinal), ref.options.map((_, i) => i));
  assert.equal(new Set(ref.options.map(o => o.translationKey)).size, 44);
  assert.equal(ref.options.filter(o => o.isFloat).length, 18);
  assert.equal(ref.options.filter(o => o.isBoolean).length, 16);
  assert(ref.options.every(o => !(o.isFloat && o.isBoolean)));
  assert.equal(new Set(ref.keyBindings.map(k => k.description)).size, 32);
  assert.deepEqual(ref.keyRegistrationOrder.map(k => k.description).sort(), ref.keyBindings.map(k => k.description).sort());
  assert.deepEqual(ref.hotbarKeys.map(k => k.defaultKey), [2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(ref.soundCategories.map(c => c.key), ['master', 'music', 'record', 'weather', 'block', 'hostile', 'neutral', 'player', 'ambient']);
});

test('float option defaults lie inside their native ranges and sliders round-trip', () => {
  for (const o of ref.options.filter(o => o.isFloat)) {
    assert(o.min < o.max, o.name);
    assert(o.default >= o.min && o.default <= o.max, `${o.name} default ${o.default}`);
    assert.equal(o.slider.rawAt0, o.min);
    assert.equal(o.slider.rawAt1, o.max);
    assert.equal(o.slider.normalizedMin, 0);
    assert.equal(o.slider.normalizedMax, 1);
  }
  assert.deepEqual([option('FOV').min, option('FOV').max, option('FOV').default], [30, 110, 70]);
  assert.deepEqual([option('RENDER_DISTANCE').min, option('RENDER_DISTANCE').max, option('RENDER_DISTANCE').default], [2, 16, 12]);
  assert.deepEqual(ref.renderDistanceByJvm, { java64bit: 12, java32bit: 8 });
});

test('every option and key binding appears in the generated catalogue', () => {
  for (const o of ref.options) assert(catalogue.includes(`| ${o.ordinal} | ${o.name} | ${o.translationKey} |`), o.name);
  for (const k of ref.keyBindings) assert(catalogue.includes(`| ${k.description} |`), k.description);
  for (const c of ref.soundCategories) assert(catalogue.includes(`| ${c.enum} | soundCategory_${c.key} |`), c.enum);
  for (const s of ref.screenLayouts) assert(catalogue.includes(`| ${s.mappedClass.split('/').pop()} |`), s.mappedClass);
  for (const r of ref.optionsFile.saveOrder) assert(catalogue.includes(`| ${r.key} |`), r.key);
  assert(!/\bVerified\b/.test(catalogue.replace(/never Verified|no row is marked Verified|before any row can be Verified/g, '')), 'no row may claim Verified');
  assert(/^# Original settings and controls parity catalogue/.test(catalogue));
});

test('options.txt key lists are complete and consistent', () => {
  const save = ref.optionsFile.saveOrder.map(r => r.key), load = ref.optionsFile.loadOrder.map(r => r.key);
  assert.equal(new Set(save).size, save.length);
  assert.deepEqual(save.filter(k => !k.endsWith('*')).sort(), [...load].sort());
  assert.deepEqual(save.slice(-2), ['key_*', 'soundCategory_*']);
});

test('port values that exist natively match the native defaults and value sets', () => {
  // Difficulty: same ids and names/order as EnumDifficulty, default Normal.
  const native = ref.enums.find(e => e.class === 'rd').constants;
  assert.deepEqual(DIFFICULTY_NAMES.map(n => n.toUpperCase()), native.map(c => c.name));
  assert.equal(NORMAL, native.find(c => c.name === defaults.difficulty).ordinal);
  assert.equal(portOptions.difficulty, NORMAL);
  assert.equal(difficultySetting(99), NORMAL);
  // Particles: three values, default All (0).
  const particles = ref.valueSets.find(v => v.role === 'PARTICLES').values;
  assert.deepEqual([0, 1, 2, 3].map(particleSetting), [0, 1, 2, 0]);
  assert.equal(particles.length, 3);
  assert.equal(portOptions.particles, defaults.particles);
  // Gamma: native 0..1, default 0 (Moody).
  assert.equal(portOptions.gamma, defaults.gamma);
  assert.deepEqual(slider('gamma'), [option('GAMMA').min, option('GAMMA').max]);
  // View bobbing and GUI scale default.
  assert.equal(portOptions.bobbing, defaults.bobView);
  assert.equal(portOptions.guiScale, defaults.guiScale);
  // ScaledResolution loop: Auto picks the largest scale keeping 320x240; each native setting caps it.
  assert.equal(guiScale(1920, 1080, 0), 4);
  assert.equal(guiScale(1920, 1080, 3), 3);
  assert.equal(guiScale(1920, 1080, 1), 1);
});

test('FOV, render distance, sensitivity, master volume and GUI scale use the native values', () => {
  // Formerly pinned as port mismatches (75 / 50-100, 155 blocks, 1x, 0.65, a fifth "Larger" scale).
  assert.equal(portOptions.fov, defaults.fov);
  assert.deepEqual(slider('fov'), [option('FOV').min, option('FOV').max]);
  assert.equal(portOptions.distance, ref.renderDistanceByJvm.java64bit);
  assert.deepEqual(slider('distance'), [option('RENDER_DISTANCE').min, option('RENDER_DISTANCE').max]);
  assert.equal(portOptions.sensitivity, defaults.mouseSensitivity);
  assert.deepEqual(slider('sensitivity'), [option('SENSITIVITY').min, option('SENSITIVITY').max]);
  assert.equal(portOptions.invertMouse, defaults.invertYMouse);
  assert.match(main, /soundLevels: Object\.fromEntries\(SOUND_CATEGORIES\.map\(\(\[k\]\) => \[k, 1\]\)\)/);
  assert(ref.soundCategories.every(c => c.default === 1));
  // GameSettings.GUISCALES: options.guiScale.auto/small/normal/large, in that order.
  assert.deepEqual(GUI_SCALE_NAMES.map(n => 'options.guiScale.' + n.toLowerCase()), ref.valueSets.find(v => v.role === 'GUI_SCALES').values);
  assert(!main.includes('"Larger"'), 'no non-native fifth GUI scale');
  for (const word of ['MISMATCH', 'EXTRA value']) assert(!catalogue.includes(word), word);
});

test('invert mouse, cinematic camera, pitch clamp and sound categories are no longer open', () => {
  // Options UI labels are the en_US.lang strings read from the JAR.
  assert.equal(ref.lang['options.invertMouse'], 'Invert Mouse');
  assert(CONTROLS_OPTIONS.includes('INVERT_MOUSE'));
  assert.equal(optionText('INVERT_MOUSE', false), `${ref.lang['options.invertMouse']}: ${ref.lang['options.off']}`);
  assert.equal(LANG['key.smoothCamera'], ref.lang['key.smoothCamera']);
  // Toggle Cinematic Camera is a rebindable key on the Controls screen, unbound by default.
  assert(REBINDABLE.has('key.smoothCamera'));
  assert.equal(KEY_BINDINGS.find(k => k.description === 'key.smoothCamera').code, '');
  assert.deepEqual(FLOAT_OPTIONS.VOLUME.slice(0, 2), [0, 1]);
  assert.deepEqual(Object.keys(soundsLayout(400, 300).sliders), ref.soundCategories.map(c => c.key));
  // key.smoothCamera is unbound in 1.7.10 and runTick has no F8 check; the port binds no key either.
  assert.equal(ref.keyBindings.find(k => k.description === 'key.smoothCamera').defaultKey, 0);
  assert.equal(ref.controls.mouseLook.smoothCameraToggle.lwjglF8Checks, 0);
  assert(!/"F8"/.test(main));
  // smoothCamera has no options.txt key, so the port does not save it.
  assert(!ref.optionsFile.saveOrder.some(r => r.srgField === 'field_74326_T'));
  assert(!/options\.smoothCamera/.test(main));
  // The old radian clamp is gone.
  assert(!main.includes('1.55'));
  const row = name => catalogue.split('\n').find(l => l.startsWith(`| ${ref.options.find(o => o.name === name).ordinal} | ${name} |`));
  assert.match(row('INVERT_MOUSE'), /\| Implemented: /);
  assert(!/smooth camera and invert open|pitch clamp is \+-1\.55/.test(catalogue));
  for (const c of ref.soundCategories) {
    const line = catalogue.split('\n').find(l => l.startsWith(`| ${c.ordinal} | ${c.enum} |`));
    assert(!/\| Missing: /.test(line), c.enum);
  }
  assert.match(catalogue.split('\n').find(l => l.includes('| key.smoothCamera |')), /\| Partial: /);
});
