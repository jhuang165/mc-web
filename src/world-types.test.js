import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { populationBlockMapperReady } from './population-world.js';
import { WORLD_TYPES, worldTypeIndex } from './menu-screens.js';
import { createStreamWorker } from './streaming-generator.js';
import { streamedWorldType } from './java-world.js';

await populationBlockMapperReady;
const silence = (w) => { w.blockLight = () => 0; return w; };
const FINITE = { default: 'java', largeBiomes: 'javaLargeBiomes', amplified: 'javaAmplified' };

test('Default, Large Biomes and Amplified are the endless world types; finite biomes stay loadable', () => {
  assert.deepEqual(WORLD_TYPES.slice(0, 3).map((w) => [w.name, w.biome, w.worldType]),
    [['Default', 'javaStreamed', 'default'], ['Large Biomes', 'javaStreamed', 'largeBiomes'], ['Amplified', 'javaStreamed', 'amplified']]);
  assert.ok(!WORLD_TYPES.some((w) => /128 x 128/.test(w.notice)), 'no finite-area notice');
  assert.ok(!WORLD_TYPES.some((w) => w.name === 'Streamed'));
  assert.deepEqual(WORLD_TYPES.slice(3).map((w) => w.biome), ['meadow', 'alpine', 'island', 'snowy']);
  // Re-Create of a saved world picks the matching entry, finite or endless.
  assert.equal(worldTypeIndex({ biome: 'java' }), 0);
  assert.equal(worldTypeIndex({ biome: 'javaLargeBiomes' }), 1);
  assert.equal(worldTypeIndex({ biome: 'javaAmplified' }), 2);
  assert.equal(worldTypeIndex({ biome: 'javaStreamed' }), 0);
  assert.equal(worldTypeIndex({ biome: 'javaStreamed', worldType: 'amplified' }), 2);
  assert.equal(worldTypeIndex({ biome: 'snowy' }), 6);
  for (const t of WORLD_TYPES.slice(0, 3)) {
    const w = silence(new World('17', t.biome, 15, t.worldType));
    assert.equal(w.streaming, true);
    assert.equal(w.worldType, t.worldType);
  }
  assert.equal(streamedWorldType('flat'), 'default');
  // Saved finite worlds are untouched.
  const old = new World('17', 'java', 14);
  assert.equal(old.streaming, false);
  assert.equal(old.worldType, 'default');
  assert.equal(new World('17', 'javaAmplified', 14).worldType, 'amplified');
});

for (const [type, biome] of Object.entries(FINITE)) {
  test(`streamed ${type} terrain equals the finite generator inside the old 128 x 128 area`, async () => {
    const finite = silence(new World('17', biome, 9)), streamed = silence(new World('17', 'javaStreamed', 12, type));
    assert.equal(streamed.originX, finite.originX);
    assert.equal(streamed.originZ, finite.originZ);
    for (let cx = 0; cx < 8; cx++) for (let cz = 0; cz < 8; cz++) {
      const a = finite.chunkAt(cx, cz), b = streamed.chunkAt(cx, cz);
      assert.ok(Buffer.from(a.blocks).equals(Buffer.from(b.blocks)), `${type} blocks at ${cx},${cz}`);
      assert.ok(Buffer.from(a.meta).equals(Buffer.from(b.meta)), `${type} metadata at ${cx},${cz}`);
    }
    // The worker builds the same columns from the world type in its init message.
    const handle = await createStreamWorker({ seed: String(streamed.javaSeed), generationVersion: 12, originX: streamed.originX, originZ: streamed.originZ, worldType: type });
    const { message } = handle({ type: 'column', x: 3, z: 4 }), live = finite.chunkAt(3, 4);
    assert.ok(Buffer.from(message.column.blocks).equals(Buffer.from(live.blocks)));
  });
}

test('world types differ from one another', () => {
  const column = (type) => Buffer.from(silence(new World('17', 'javaStreamed', 12, type)).chunkAt(2, 2).blocks);
  assert.ok(!column('amplified').equals(column('default')));
});
