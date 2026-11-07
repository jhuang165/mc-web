// Generation 17: level.dat MapFeatures=false streams no structure generator (ChunkProviderGenerate/ChunkProviderFlat only build
// them when mapFeatures is true). Terrain, caves, ravines, lakes, dungeons, decoration and the native biome rule stay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { populationBlockMapperReady } from './population-world.js';
import { biomeLayerOptions, streamedSource, NO_MAP_FEATURES_GENERATION } from './java-world.js';
import { levelGenerator } from './level-dat.js';

await populationBlockMapperReady;
const FLAT = '2;7,59x1,3x3,2;1;village(distance=3),mineshaft(chance=0.05),lake,lava_lake,dungeon,decoration';
const census = (w, R) => {
  const counts = new Map();
  for (let x = -R; x < R; x++) for (let z = -R; z < R; z++) for (let y = 55; y < 75; y++) { const b = w.get(x, y, z); counts.set(b, (counts.get(b) ?? 0) + 1); }
  return counts;
};

test('MapFeatures off imports generate at 17 for default and Superflat worlds; with MapFeatures stays 16', () => {
  assert.equal(NO_MAP_FEATURES_GENERATION, 17);
  for (const worldType of ['default', 'flat', 'largeBiomes']) {
    const mk = (mapFeatures) => levelGenerator({ seed: 1n, worldType, generatorOptions: '2;7,3x1;1;village', mapFeatures });
    assert.equal(mk(true).generationVersion, 16);
    assert.equal(mk(false).generationVersion, 17);
    assert.deepEqual(mk(false).approximate, []);
  }
  assert.deepEqual(biomeLayerOptions(17), { legacyMutated: false });
});

test('a generation 17 world is accepted and older Superflat versions are still refused', () => {
  assert.doesNotThrow(() => new World('abc', 'javaStreamed', 17, 'default'));
  assert.doesNotThrow(() => new World('abc', 'javaStreamed', 17, 'flat', FLAT));
  assert.throws(() => new World('abc', 'javaStreamed', 14, 'default'));
});

test('Superflat generation 17 builds no village or mineshaft where generation 16 does; the layers are identical', () => {
  const on = new World('mf', 'javaStreamed', 16, 'flat', FLAT), off = new World('mf', 'javaStreamed', 17, 'flat', FLAT);
  const a = census(on, 160), b = census(off, 160);
  const structural = [...a.keys()].filter((id) => (a.get(id) ?? 0) !== (b.get(id) ?? 0));
  assert.ok(structural.length > 0, 'generation 16 places structure blocks');
  const planks = [...a.keys()].filter((id) => !b.has(id));
  assert.ok(planks.length > 0, 'a block only structures place exists at 16 and not at 17');
});

test('generation 17 population is deterministic and keeps terrain without mineshafts', () => {
  const x = new World('seed17', 'javaStreamed', 17, 'default'), y = new World('seed17', 'javaStreamed', 17, 'default');
  for (let i = 0; i < 40; i += 7) for (let j = 0; j < 40; j += 9) for (let h = 40; h < 90; h += 5) assert.equal(x.get(i, h, j), y.get(i, h, j));
});

test('the streamed default source builds structure generators for 13/15/16 but none for 17', () => {
  const src = (generationVersion) => streamedSource({ seed: 5n, generationVersion, originX: 0, originZ: 0 }).population;
  assert.equal(src(13).mapFeatures, true);
  assert.ok(src(16).structureCache);
  assert.equal(src(16).mapFeatures, true);
  assert.equal(src(17).structureCache, null);
  assert.equal(src(17).mapFeatures, false);
  const flat = (generationVersion) => streamedSource({ seed: 5n, generationVersion, originX: 0, originZ: 0, worldType: 'flat', generatorOptions: FLAT }).population;
  assert.equal(flat(15).mapFeatures, true);
  assert.equal(flat(17).mapFeatures, false);
});
