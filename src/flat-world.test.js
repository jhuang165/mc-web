// Superflat against the unchanged 1.7.10 classes (public/research/flat-world-reference.json, tools/probes/FlatWorldProbe.java).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseFlatInfo, FLAT_PRESETS, FlatChunkProvider, FlatChunkManager, flatBiome, isRegisteredBlock, DEFAULT_FLAT_STRING } from './flat-world.js';
import { JavaRandom } from './java-random.js';

const reference = JSON.parse(readFileSync(new URL('../public/research/flat-world-reference.json', import.meta.url), 'utf8'));
const rows = (kind) => reference.records.filter((r) => r.kind === kind);

test('FlatGeneratorInfo parse and serialise match the unchanged class for every fixture string', () => {
  assert.ok(rows('parse').length >= 60);
  for (const { input, parsed } of rows('parse')) {
    const info = parseFlatInfo(input);
    assert.deepEqual(info.toJSON(), parsed, JSON.stringify(input));
    // The serialised string is a fixed point (a zero-height layer loses its count, as natively).
    assert.equal(parseFlatInfo(info.toString()).toString(), info.toString(), JSON.stringify(input) + ' round trip');
  }
  assert.equal(parseFlatInfo(null).toString(), DEFAULT_FLAT_STRING);
  assert.deepEqual(parseFlatInfo(undefined).toJSON(), rows('default')[0].fromNull);
});
test('the registered block ids are the 1.7.10 table', () => {
  const ids = rows('blockIds')[0].ids;
  for (let id = 0; id < 4096; id++) assert.equal(isRegisteredBlock(id), ids.includes(id), String(id));
});
test('the eight GuiFlatPresets entries serialise to their native strings', () => {
  const native = rows('presets')[0].list;
  assert.equal(FLAT_PRESETS.length, native.length);
  FLAT_PRESETS.forEach((p, i) => {
    assert.equal(p.name, native[i].name);
    assert.equal(p.icon, native[i].item);
    assert.equal(p.string, native[i].string);
    assert.equal(parseFlatInfo(p.string).toString(), p.string);
    assert.deepEqual(parseFlatInfo(p.string).toJSON(), native[i].parsed);
  });
});
test('BiomeGenBase.getBiome edge ids', () => {
  for (const [id, want] of rows('biomeIds')[0].values) {
    if (want === 'ArrayIndexOutOfBoundsException' || want === null) continue;
    assert.equal(flatBiome(id).id, want, String(id));
  }
});
test('ChunkProviderFlat chunks hash like the native provider', () => {
  const sha = (a) => createHash('sha1').update(Buffer.from(a)).digest('hex');
  for (const r of rows('chunk')) {
    const info = parseFlatInfo(r.preset), chunk = new FlatChunkProvider(info).provideChunk(r.x, r.z);
    // The probe hashes x, z, y order with two bytes per cell (little endian).
    const ids = Buffer.alloc(16 * 16 * 256 * 2), meta = Buffer.alloc(16 * 16 * 256 * 2);
    for (let i = 0; i < 65536; i++) { ids.writeUInt16LE(chunk.blocks[i], i * 2); meta.writeUInt16LE(chunk.metadata[i], i * 2); }
    assert.equal(sha(ids), r.blocksSha1, r.preset);
    assert.equal(sha(meta), r.metaSha1, r.preset);
    assert.deepEqual(Array.from(chunk.blocks.subarray((3 * 16 + 5) * 256, (3 * 16 + 5) * 256 + 256)), r.column[0], r.preset + ' column');
    const histogram = {};
    for (const b of chunk.biomes) histogram[b] = (histogram[b] ?? 0) + 1;
    assert.deepEqual(Object.entries(histogram).map(([k, v]) => [+k, v]), r.biomes);
  }
});
test('WorldChunkManagerHell viability and biome search draw like the native manager', () => {
  const list = [1, 4, 5, 18, 19, 21, 22], villages = [1, 2, 35];
  for (const r of rows('manager')) {
    const manager = new FlatChunkManager(r.biome), random = new JavaRandom(BigInt(r.biome) * 7n);
    assert.equal(manager.areBiomesViable(0, 0, 0, villages), r.viable);
    assert.deepEqual(manager.findBiomePosition(1000, -2000, 112, list, random), r.find);
    assert.deepEqual(manager.findBiomePosition(8, 8, 256, list, random), r.find2);
    assert.equal(random.nextInt(1000), r.next);
  }
});
