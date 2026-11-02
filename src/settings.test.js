import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lookScale, sensitivityForScale, optionLabel, migrateSettings, renderDistanceBlocks, SETTINGS_VERSION, SOUND_CATEGORIES, soundLevel, categoryVolume, normalizedVolume, normalizedPitch } from './settings.js';
import { attenuationDistance } from './audio.js';

const deg = Math.PI / 180;
const perPixel = (k) => k * 0.15 * Math.PI / 180;

test('lookScale follows the EntityRenderer sensitivity curve', () => {
  // f = 0.5 * 0.6 + 0.2 = 0.5, f^3 * 8 = 1: the default turns 0.15 degrees per pixel.
  assert.equal(lookScale(0.5), perPixel(1));
  // f = 0.2 at 0 and 0.8 at 1 (float arithmetic, as in the original).
  const f = Math.fround;
  const at = s => { const a = f(f(f(s) * f(0.6)) + f(0.2)); return perPixel(f(f(f(a * a) * a) * f(8))); };
  assert.equal(lookScale(0), at(0));
  assert.equal(lookScale(1), at(1));
  assert.ok(Math.abs(lookScale(1) / deg - 0.6144) < 1e-6);
  assert.ok(lookScale(0.25) < lookScale(0.5) && lookScale(0.5) < lookScale(0.75));
  for (const s of [0.1, 0.37, 0.5, 0.9]) assert.ok(Math.abs(sensitivityForScale(lookScale(s)) - s) < 1e-6);
});

test('option labels are the GameSettings.getKeyBinding strings', () => {
  assert.equal(optionLabel('fov', 70), 'Normal');
  assert.equal(optionLabel('fov', 110), 'Quake Pro');
  assert.equal(optionLabel('fov', 85), '85');
  assert.equal(optionLabel('sensitivity', 0), '*yawn*');
  assert.equal(optionLabel('sensitivity', 1), 'HYPERSPEED!!!');
  assert.equal(optionLabel('sensitivity', 0.5), '100%');
  assert.equal(optionLabel('sensitivity', 0.335), '67%');
  assert.equal(optionLabel('distance', 12), '12 chunks');
  assert.equal(optionLabel('volume', 0), 'OFF');
  assert.equal(optionLabel('volume', 1), '100%');
  assert.equal(optionLabel('volume', 0.65), '65%');
  assert.equal(renderDistanceBlocks(12), 192);
});

test('settings saved before version 2 move to the native scales once', () => {
  // Untouched old defaults become the native defaults (filled in by main.js).
  assert.deepEqual(migrateSettings({ fov: 75, sensitivity: 1, distance: 155, volume: 0.65, guiScale: 4, particles: 1 }),
    { guiScale: 3, particles: 1, settingsVersion: SETTINGS_VERSION });
  // Changed values keep their effect: the turn rate, the fog distance and the volume.
  const old = migrateSettings({ fov: 90, sensitivity: 1.5, distance: 200, volume: 0.3, guiScale: 2 });
  assert.equal(old.fov, 90);
  assert.ok(Math.abs(lookScale(old.sensitivity) - 0.003) < 1e-9);
  assert.equal(old.distance, 13);
  assert.deepEqual(old.soundLevels, { master: 0.3 });
  assert.equal(old.guiScale, 2);
  // The old 0.2x-2x range lies inside the native turn rates (0.0096 to 0.6144 degrees per pixel).
  for (const m of [0.2, 2]) assert.ok(Math.abs(lookScale(migrateSettings({ sensitivity: m }).sensitivity) - 0.002 * m) < 1e-9);
  assert.equal(migrateSettings({ distance: 70 }).distance, 4);
  assert.equal(migrateSettings({ distance: 0 }).distance, 2);
  assert.equal(migrateSettings({ settingsVersion: 2, sensitivity: 5, volume: -1 }).sensitivity, 1);
  assert.deepEqual(migrateSettings({ settingsVersion: 2, volume: -1 }).soundLevels, { master: 0 });
  // Version 2 saves are not converted again; their single volume becomes the master level.
  assert.deepEqual(migrateSettings({ settingsVersion: 2, fov: 75, sensitivity: 1, distance: 9, volume: 0.65 }),
    { settingsVersion: SETTINGS_VERSION, fov: 75, sensitivity: 1, distance: 9, soundLevels: { master: 0.65 } });
  assert.deepEqual(migrateSettings({ settingsVersion: 2, fov: 200, distance: 'far', guiScale: 7 }), { settingsVersion: SETTINGS_VERSION, fov: 110, guiScale: 3 });
  for (const bad of [null, [], 'x', 3]) assert.deepEqual(migrateSettings(bad), { settingsVersion: SETTINGS_VERSION });
});

test('version 3 keeps one level per SoundCategory and the invert mouse flag', () => {
  assert.equal(SETTINGS_VERSION, 3);
  // A version 1 save: the old 0.65 default is dropped (master stays at the native 1), other values move.
  assert.deepEqual(migrateSettings({ volume: 0.65 }), { settingsVersion: 3 });
  assert.deepEqual(migrateSettings({ volume: 0.3 }), { settingsVersion: 3, soundLevels: { master: 0.3 } });
  assert.deepEqual(migrateSettings({ settingsVersion: 2, volume: -1 }), { settingsVersion: 3, soundLevels: { master: 0 } });
  assert.deepEqual(migrateSettings({ settingsVersion: 2, volume: 'loud' }), { settingsVersion: 3, soundLevels: {} });
  // Current saves are validated only: known categories, numbers clamped to 0..1, booleans for invertMouse.
  const s = migrateSettings({ settingsVersion: 3, invertMouse: true, volume: 0.2, soundLevels: { master: 0.4, music: 2, hostile: -1, weather: 'x', mobs: 0.5 } });
  assert.deepEqual(s, { settingsVersion: 3, invertMouse: true, volume: 0.2, soundLevels: { master: 0.4, music: 1, hostile: 0 } });
  assert.deepEqual(migrateSettings({ settingsVersion: 3, invertMouse: 'yes', soundLevels: [1] }), { settingsVersion: 3, soundLevels: {} });
});

test('sound categories, labels and SoundManager gain follow the original', () => {
  const ref = JSON.parse(readFileSync(new URL('../public/research/settings-reference.json', import.meta.url), 'utf8'));
  // Names in SoundCategory ordinal order and the soundCategory.<name> strings of en_US.lang.
  assert.deepEqual(SOUND_CATEGORIES.map(([k]) => k), ref.soundCategories.map(c => c.key));
  for (const [k, label] of SOUND_CATEGORIES) assert.equal(label, ref.lang['soundCategory.' + k], k);
  // GameSettings.getSoundLevel: 1 when the category is missing, as every constructor default is.
  for (const c of ref.soundCategories) assert.equal(soundLevel({}, c.key), c.default);
  assert.equal(soundLevel({ music: 0.25 }, 'music'), 0.25);
  // getSoundCategoryVolume: null and MASTER are 1, whatever the master level.
  const levels = { master: 0.1, block: 0.5, hostile: 0 };
  assert.equal(categoryVolume(levels, null), 1);
  assert.equal(categoryVolume(levels, 'master'), 1);
  assert.equal(categoryVolume(levels, 'block'), 0.5);
  assert.equal(categoryVolume(levels, 'neutral'), 1);
  // getNormalizedVolume: clamp(volume * entry * category, 0, 1) as a float.
  const { normalizedVolumeClamp, normalizedPitchClamp, attenuationDistance: dist } = ref.controls.sound;
  assert.deepEqual([normalizedVolumeClamp, normalizedPitchClamp, dist], [[0, 1], [0.5, 2], 16]);
  assert.equal(normalizedVolume(0.8, 1, levels, 'block'), Math.fround(0.4));
  assert.equal(normalizedVolume(4, 1, levels, 'block'), 1);
  assert.equal(normalizedVolume(1, 1, levels, 'hostile'), 0);
  assert.equal(normalizedVolume(0.5, 0.5, levels, 'master'), 0.25);
  // getNormalizedPitch: clamp(pitch * entry pitch, 0.5, 2).
  assert.equal(normalizedPitch(0.4, 1), 0.5);
  assert.equal(normalizedPitch(2.6, 1), 2);
  assert.equal(normalizedPitch(0.8, 1), Math.fround(0.8));
  // SoundManager.playSound: attenuation distance 16, or 16 * volume above 1.
  assert.equal(attenuationDistance(1), 16);
  assert.equal(attenuationDistance(0.5), 16);
  assert.equal(attenuationDistance(4), 64);
  // GuiScreenOptionsSounds: "<label>: " + OFF at 0, else (int)(level * 100) + "%".
  assert.equal(ref.lang['options.off'], optionLabel('volume', 0));
  assert.equal(optionLabel('volume', 0.333), '33%');
});
