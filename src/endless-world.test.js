import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { populationBlockMapperReady } from './population-world.js';
import { canGoEndless, endlessCopy, ENDLESS_GENERATIONS } from './endless-world.js';

await populationBlockMapperReady;
const silence = (w) => { w.blockLight = () => 0; return w; };
const finite = (over = {}) => ({
  id: 'old', name: 'poooo', folder: 'New World-', seed: '17', biome: 'java', mode: 'survival', generationVersion: 9,
  edits: [['20,70,20', 1], ['21,70,20', 0]], updated: 1, version: 1,
  position: { x: 20, y: 80, z: 20, yaw: 0, pitch: 0 }, entities: [{ id: 'mob-1', type: 'zombie', x: 20, y: 70, z: 20 }], ...over,
});

test('only finite Java worlds of generation 9, 11 and 14 can be made endless', () => {
  for (const biome of ['java', 'javaLargeBiomes', 'javaAmplified']) for (const g of [9, 11, 14]) assert.equal(canGoEndless(finite({ biome, generationVersion: g })), true, `${biome} ${g}`);
  assert.equal(canGoEndless(finite({ generationVersion: 10 })), false, 'mineshaft-only worlds have no endless equivalent');
  for (const g of [12, 13, 15]) assert.equal(canGoEndless(finite({ generationVersion: g })), false);
  for (const biome of ['javaStreamed', 'meadow', 'alpine', 'island', 'snowy']) assert.equal(canGoEndless(finite({ biome, generationVersion: 9 })), false, biome);
  assert.equal(canGoEndless(null), false);
  assert.throws(() => endlessCopy(finite({ biome: 'meadow' }), { id: 'n', name: 'x', folder: 'x' }), /cannot be made endless/);
});

test('the copy is an independent endless record with the same seed, edits and runtime state', () => {
  const old = finite({ biome: 'javaAmplified', generationVersion: 14 }), snapshot = structuredClone(old);
  const copy = endlessCopy(old, { id: 'new', name: 'poooo (Endless)', folder: 'poooo (Endless)', now: 99 });
  assert.deepEqual(old, snapshot, 'the finite record is untouched');
  assert.deepEqual([copy.id, copy.name, copy.folder, copy.updated], ['new', 'poooo (Endless)', 'poooo (Endless)', 99]);
  assert.deepEqual([copy.biome, copy.worldType, copy.generationVersion], ['javaStreamed', 'amplified', 15]);
  assert.deepEqual([copy.seed, copy.mode, copy.edits, copy.position, copy.entities], [old.seed, old.mode, old.edits, old.position, old.entities]);
  copy.edits.push(['1,1,1', 2]); copy.entities[0].x = 0;
  assert.equal(old.edits.length, 2); assert.equal(old.entities[0].x, 20);
  assert.deepEqual(Object.keys(ENDLESS_GENERATIONS), ['9', '11', '14']);
});

test('worldType follows the finite biome and the generation maps 9 to 12, 11 to 13 and 14 to 15', () => {
  const at = (biome, generationVersion) => endlessCopy(finite({ biome, generationVersion }), { id: 'n', name: 'n', folder: 'n' });
  assert.deepEqual(['java', 'javaLargeBiomes', 'javaAmplified'].map((b) => at(b, 9).worldType), ['default', 'largeBiomes', 'amplified']);
  assert.deepEqual([9, 11, 14].map((g) => at('java', g).generationVersion), [12, 13, 15]);
});

test('terrain-only conversion keeps no population claim; populated conversions claim the old window', () => {
  assert.equal('populatedColumns' in endlessCopy(finite({ populatedColumns: { version: 1, cells: {} } }), { id: 'n', name: 'n', folder: 'n' }), false);
  const populated = endlessCopy(finite({ generationVersion: 14 }), { id: 'n', name: 'n', folder: 'n' });
  assert.deepEqual(populated.populatedColumns, { version: 1, cells: { '0,0': 'ffffffffffffffff' } });
});

test('an endless copy opens with the finite terrain and edits inside the old window', () => {
  const old = finite(), copy = endlessCopy(old, { id: 'n', name: 'n', folder: 'n' });
  const a = silence(new World(old.seed, old.biome, old.generationVersion, old.worldType)); a.restore(old.edits);
  const b = silence(new World(copy.seed, copy.biome, copy.generationVersion, copy.worldType)); b.restore(copy.edits);
  assert.equal(b.streaming, true);
  assert.equal(b.originX, a.originX); assert.equal(b.originZ, a.originZ);
  for (const [x, y, z] of [[20, 70, 20], [21, 70, 20], [5, 60, 5], [100, 62, 90]]) assert.equal(b.get(x, y, z), a.get(x, y, z), `${x},${y},${z}`);
  assert.equal(b.get(20, 70, 20), 1); assert.equal(b.get(21, 70, 20), 0);
  // The edit journal stays in the single-record form the streamed loader splits on first save.
  assert.deepEqual([...b.edits].slice(0, 2), old.edits);
});

test('a populated conversion does not hand the old window over a second time', () => {
  const copy = endlessCopy(finite({ generationVersion: 11 }), { id: 'n', name: 'n', folder: 'n' });
  const w = silence(new World(copy.seed, copy.biome, copy.generationVersion, copy.worldType));
  w.restoreClaimedColumns(copy.populatedColumns);
  assert.deepEqual(w.claimFreshColumns(), [], 'saved chests, animals and spawners are not regenerated');
});
