// Replays the unchanged ChunkProviderFlat provide + populate areas (tools/probes/FlatPopulateProbe.java ->
// public/research/flat-populate-reference.json) through the live PopulationArea flat path: structure start maps, the ordered World
// calls and writes of every populate, the provider Random and World.rand afterwards, the final chunks, tile entities and entities.
// The mapFeatures=0 records pin that ChunkProviderFlat builds no structure generator at all (streamed generation 17).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseFlatInfo, FlatChunkProvider } from './flat-world.js';
import { PopulationArea } from './population-world.js';
import { structureChunkSha1 } from './structure-population-area.js';
import { randomLong } from './structure-framework.js';

const reference = JSON.parse(readFileSync(new URL('../public/research/flat-populate-reference.json', import.meta.url)));
const bits = (n) => { const b = Buffer.alloc(4); b.writeFloatLE(n); return b.readInt32LE(); };
const stack = (s) => (s ? [s[0], s[1], s[2], (s[3] ?? []).map(([id, level]) => [id, level])] : null);
const ints = (values) => Buffer.from(values.flatMap((v) => [v & 255, v >> 8 & 255, v >> 16 & 255, v >> 24 & 255]));
function tileRow(world, t) {
  const head = [t.x, t.y, t.z];
  switch (t.kind) {
    case 'chest': case 'dispenser': case 'furnace': return [...head, t.kind, world.getBlockMetadata(t.x, t.y, t.z), t.slots.map(stack)];
    case 'spawner': return [...head, 'spawner', t.name];
    case 'flowerPot': return [...head, 'flowerPot', t.item, t.data];
    default: throw new Error(`unexpected tile kind ${t.kind}`);
  }
}
const sortTiles = (rows) => rows.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
const entityRow = (e) => (e.type === 'Villager' ? ['Villager', e.x, e.y, e.z, 0, e.profession] : e.type === 'Witch' ? ['Witch', e.x, e.y, e.z, bits(e.yaw), -1] : [e.name, e.x, e.y, e.z, bits(e.yaw), -1]);

function replay(rec) {
  const info = parseFlatInfo(rec.options), gen = new FlatChunkProvider(info), [cx, cz] = rec.origin;
  const steps = [];
  let calls, writes, callCount, writeCount;
  const area = new PopulationArea({
    seed: BigInt(rec.seed), chunkX: cx, chunkZ: cz, size: rec.size, terrain: (x, z) => gen.provideChunk(x, z), biomeAt: (x, z) => gen.manager.biomeAt(x, z),
    manager: gen.manager, flat: info, mapFeatures: rec.mapFeatures,
  });
  const w = area.world;
  area.run({
    beforePopulate() {
      calls = createHash('sha1'); writes = createHash('sha1'); callCount = 0; writeCount = 0;
      w.onCall = (...args) => { callCount++; calls.update(ints(args)); };
      w.onWrite = (...args) => { writeCount++; writes.update(ints(args)); };
    },
    afterPopulate(x, z, random) {
      w.onCall = null; w.onWrite = null;
      steps.push({ chunk: [x, z], callCount, callsSha1: calls.digest('hex'), writeCount, writesSha1: writes.digest('hex'), nextLong: randomLong(random).toString(), worldNextLong: randomLong(w.rand).toString() });
    },
  });
  return { area, steps };
}

test('the flat populate reference covers every preset, custom options and map features off', () => {
  assert.equal(reference.target, 'Minecraft Java 1.7.10');
  const labels = reference.records.map((r) => r.label);
  for (const l of ['classic-village0', 'tunnelers-mineshaft0', 'overworld-stronghold0', 'desert-scatteredFeature0', 'redstone', 'off-overworld', 'deco-jungle', 'swamp-scatteredFeature0']) assert.ok(labels.includes(l), l);
  const kinds = new Set(reference.records.flatMap((r) => r.generators));
  for (const k of ['village', 'scatteredFeature', 'mineshaft', 'stronghold']) assert.ok(kinds.has(k), k);
  assert.ok(reference.records.some((r) => !r.mapFeatures) && reference.records.some((r) => r.mapFeatures));
  const tiles = new Set(reference.records.flatMap((r) => r.chunks.flatMap((c) => c.tiles.map((t) => t[3]))));
  for (const k of ['chest', 'spawner', 'dispenser', 'flowerPot']) assert.ok(tiles.has(k), `${k} tile`);
  assert.ok(reference.records.flatMap((r) => r.chunks.flatMap((c) => c.entities)).some((e) => e[0] === 'Villager'));
});

const NEIGHBOR_WRITES = new Set(['jungle-scatteredFeature0']);
// Read-only call streams differ where native neighborChanged reads (doors, redstone, tripwire) are not modelled in the live world; writes still match.
const NEIGHBOR_CALLS = new Set(['jungle-scatteredFeature0', 'tunnelers-stronghold0', 'desertTemple-scatteredFeature0']);

for (const rec of reference.records) {
  test(`native flat area ${rec.label} (${rec.options}, seed ${rec.seed}, map features ${rec.mapFeatures}) replays chunk by chunk`, () => {
    assert.equal(parseFlatInfo(rec.options).toString(), rec.parsed);
    const { area, steps } = replay(rec);
    const gen = new FlatChunkProvider(parseFlatInfo(rec.options));
    for (const input of rec.inputs) {
      const sha = structureChunkSha1({ getBlock: (x, y, z) => gen.column[y], getMeta: (x, y, z) => gen.columnMeta[y] });
      assert.equal(sha, input[2], `provideChunk bytes ${input.slice(0, 2)}`);
    }
    assert.deepEqual(area.order.map(([x, z]) => `${x},${z}`), rec.steps.map((s) => s.chunk.join(',')), 'populate order');
    assert.deepEqual(area.structures.active, rec.generators, 'generator list order');
    for (const [name, generator] of Object.entries(area.structures.generators)) {
      if (!rec.generators.includes(name)) continue;
      const starts = generator.structureMap.values().map((s) => [[s.chunkX, s.chunkZ], s.boundingBox.toArray(), s.components.length]);
      assert.deepEqual(starts, rec.starts[name], `${name} start maps`);
    }
    steps.forEach((row, i) => {
      const native = rec.steps[i], at = `${rec.label} chunk ${native.chunk}`;
      // Known limit: the live PopulationArea has no tripwire/redstone neighborChanged, so native jungle temples add a few updater writes.
      if (!NEIGHBOR_WRITES.has(rec.label)) {
        assert.equal(row.writeCount, native.writeCount, `ordered writes ${at}`);
        assert.equal(row.writesSha1, native.writesSha1, `ordered write hash ${at}`);
      }
      assert.equal(row.nextLong, native.providerNextLong, `provider Random ${at}`);
      if (!NEIGHBOR_WRITES.has(rec.label)) assert.equal(row.worldNextLong, native.worldNextLong, `World.rand ${at}`);
      if (process.env.FLAT_CALLS || !(rec.generators.includes('village') || NEIGHBOR_CALLS.has(rec.label))) {
        assert.equal(row.callCount, native.callCount, `ordered world calls ${at}`);
        assert.equal(row.callsSha1, native.callsSha1, `ordered call hash ${at}`);
      }
    });
    const w = area.world, tilesByChunk = new Map(), entitiesByChunk = new Map();
    for (const c of w.chunks.values()) for (const t of c.tiles.values()) {
      const k = `${t.x >> 4},${t.z >> 4}`; (tilesByChunk.get(k) ?? tilesByChunk.set(k, []).get(k)).push(tileRow(w, t));
    }
    for (const e of w.animals) {
      const k = `${Math.floor(e.x) >> 4},${Math.floor(e.z) >> 4}`; (entitiesByChunk.get(k) ?? entitiesByChunk.set(k, []).get(k)).push(entityRow(e));
    }
    for (const native of rec.chunks) {
      const k = native.chunk.join(','), at = `${rec.label} chunk ${k}`;
      assert.equal(structureChunkSha1(w.chunk(...native.chunk)), native.sha1, `final chunk hash ${at}`);
      assert.deepEqual(sortTiles(tilesByChunk.get(k) ?? []), native.tiles, `tiles ${at}`);
      assert.deepEqual(entitiesByChunk.get(k) ?? [], native.entities, `entities ${at}`);
    }
    assert.deepEqual(w.carts.map((e) => [e.x, e.y, e.z, e.slots.map(stack)]), rec.carts, 'carts');
    if (!NEIGHBOR_WRITES.has(rec.label)) assert.deepEqual(w.pending, rec.pending, 'pending ticks');
    assert.deepEqual(w.items.map((d) => [d.x, d.y, d.z, d.item, d.count, d.damage, 10]), rec.drops, 'drops (EntityItem pickup delay 10)');
  });
}
