import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DIFFICULTY_NAMES, NORMAL, difficultySetting } from './difficulty.js';
import { particleSetting } from './particle-settings.js';
import { guiScale } from './gui.js';

const read = name => readFile(new URL(name, import.meta.url), 'utf8');
const ref = JSON.parse(await read('../public/research/settings-reference.json'));
const catalogue = await read('../public/research/settings-parity-catalogue.md');
const main = await read('./main.js');
const option = name => ref.options.find(o => o.name === name);
const defaults = Object.fromEntries(ref.gameSettingsFields.filter(f => f.optionsKey).map(f => [f.optionsKey, f.defaultValue]));
// Literal defaults of the port's `let options = {...}` object in main.js (no DOM needed).
const portOptions = Object.fromEntries([...main.match(/let options = \{([\s\S]*?)\n\};/)[1].matchAll(/^\s*(\w+)\s*:\s*([-\d.]+|true|false)\s*,/gm)].map(m => [m[1], JSON.parse(m[2])]));
const slider = id => { const m = main.match(new RegExp(`id="${id}" min="([\\d.]+)" max="([\\d.]+)"`)); return m && [Number(m[1]), Number(m[2])]; };

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

test('known port/native mismatches are tracked so a fix must update the catalogue', () => {
  // Reported, not silently changed: update settings-parity-catalogue notes when any of these changes.
  assert.equal(portOptions.fov, 75);
  assert.notEqual(portOptions.fov, defaults.fov);
  assert.deepEqual(slider('fov'), [50, 100]);
  assert.notDeepEqual(slider('fov'), [option('FOV').min, option('FOV').max]);
  assert.equal(portOptions.distance, 155);
  assert.deepEqual(slider('distance'), [70, 200]);
  assert.equal(portOptions.volume, 0.65);
  assert.notEqual(portOptions.volume, ref.soundCategories[0].default);
  assert.equal(portOptions.sensitivity, 1);
  assert.notEqual(portOptions.sensitivity, defaults.mouseSensitivity);
  assert(main.includes('[4,"Larger"]'), 'port GUI scale has a non-native fifth value');
  for (const word of ['MISMATCH', 'EXTRA value']) assert(catalogue.includes(word), word);
});
