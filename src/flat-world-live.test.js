// Superflat through World, the streamed population and the Java ZIP export.
import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { populationBlockMapperReady } from './population-world.js';
import { exportJavaSave } from './region-export.js';
import { decodeCompressedNbt } from './nbt-compression.js';
import { DEFAULT_FLAT_STRING } from './flat-world.js';
import { fromOriginal } from './block-registry.js';

await populationBlockMapperReady;
const column = (w, x, z, n = 12) => Array.from({ length: n }, (_, y) => w.get(x, y, z));

test('a Superflat World builds the layers, normalises the options and refuses old generator versions', () => {
  const w = new World('abc', 'javaStreamed', 15, 'flat', '');
  assert.equal(w.worldType, 'flat');
  assert.equal(w.generatorOptions, DEFAULT_FLAT_STRING);
  const bedrock = fromOriginal(7).id, dirt = fromOriginal(3).id, grass = fromOriginal(2).id;
  assert.deepEqual(column(w, 5, 5, 6), [bedrock, dirt, dirt, grass, 0, 0]);
  const custom = new World('abc', 'javaStreamed', 15, 'flat', '2;3x1,1;1');
  assert.equal(custom.generatorOptions, '2;3x1,1;1;village');
  assert.deepEqual(column(custom, 5, 5, 5), [1, 1, 1, 1, 0].map((o) => (o ? fromOriginal(1).id : 0)));
  assert.throws(() => new World('abc', 'javaStreamed', 14, 'flat', ''));
  assert.equal(new World('abc', 'javaStreamed', 15, 'default').generatorOptions, '');
});

test('the Java ZIP export writes generatorName flat and the generator string', async () => {
  const w = new World('abc', 'javaStreamed', 15, 'flat', '2;7,3x1;1;');
  const record = { id: 'f', name: 'Flat', seed: 'abc', biome: 'javaStreamed', worldType: 'flat', generatorOptions: '2;7,3x1;1;', generationVersion: 15, mode: 'creative', edits: [], position: { x: 64.5, y: 5, z: 64.5, yaw: 0, pitch: 0 } };
  const { files } = await exportJavaSave(record, { world: w });
  const data = (await decodeCompressedNbt(files.get('level.dat'))).tag.value.get('Data').value;
  assert.equal(data.get('generatorName').value, 'flat');
  assert.equal(data.get('generatorOptions').value, '2;7,3x1;1;');
});

test('the Overworld preset populates (structures, lakes, dungeons, decoration) without leaving its layers', () => {
  const w = new World('abc', 'javaStreamed', 15, 'flat', '2;7,59x1,3x3,2;1;village,biome_1,decoration,stronghold,mineshaft,lake,lava_lake,dungeon');
  const bedrock = fromOriginal(7).id;
  for (let x = 0; x < 128; x += 9) for (let z = 0; z < 128; z += 9) assert.equal(w.get(x, 0, z), bedrock);
  assert.equal(w.get(3, 255, 3), 0);
});
