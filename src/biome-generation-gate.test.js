// Generation 16 gate: the native mutated-biome class rule (biome-layers.js biomeClassOf) only for generation 16 worlds;
// generation 15 and older keep the biome map they were saved with.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldChunkManager } from './biome-layers.js';
import { ChunkProviderGenerate, BiomeTerrainState } from './terrain-generator.js';
import { biomeLayerOptions, NATIVE_BIOME_CLASS_GENERATION } from './java-world.js';
import { levelGenerator } from './level-dat.js';

test('the default (and generation 16) biome layers use the native mutated-biome class rule', () => {
  assert.equal(NATIVE_BIOME_CLASS_GENERATION, 16);
  assert.equal(new WorldChunkManager(671n, 'default').biomeAt(-224, 16).id, 22);
  assert.equal(new ChunkProviderGenerate(671n, 'default', new BiomeTerrainState(), biomeLayerOptions(16)).manager.biomeAt(-224, 16).id, 22);
  assert.deepEqual(biomeLayerOptions(undefined), { legacyMutated: false });
});

test('generation 15 and older worlds keep the earlier biome map', () => {
  for (const v of [12, 13, 14, 15]) assert.deepEqual(biomeLayerOptions(v), { legacyMutated: true });
  assert.equal(new ChunkProviderGenerate(671n, 'default', new BiomeTerrainState(), biomeLayerOptions(15)).manager.biomeAt(-224, 16).id, 23);
  assert.equal(new WorldChunkManager(671n, 'default', { legacyMutated: true }).biomeAt(-224, 16).id, 23);
});

test('level.dat imports with MapFeatures generate at 16; MapFeatures off is generation 17', () => {
  assert.equal(levelGenerator({ seed: 1n, worldType: 'default', mapFeatures: true }).generationVersion, 16);
  assert.equal(levelGenerator({ seed: 1n, worldType: 'default', mapFeatures: false }).generationVersion, 17);
});
