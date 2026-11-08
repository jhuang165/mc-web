// Nether and End population of imported chunks (imported-population-dims.js through populateImportedColumns). The native replay is
// tools/verify-interchange-dim-populate.mjs (public/research/interchange-dim-populate-reference.json: the unchanged Chunk.populateChunk
// driven over generated chunk rectangles); these tests replay it through the port and pin the stored-cell overlay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const { populationBlockMapperReady } = await import('./population-world.js');
await populationBlockMapperReady;
const { populateImportedColumns } = await import('./imported-population.js');
const { dimensionTerrain } = await import('./imported-population-dims.js');
const { encodeBaseColumn, decodeBaseColumn } = await import('./whole-save-columns.js');
const { baseToJson, baseFromJson } = await import('./whole-save-json.js');
const { fromOriginal, toOriginal } = await import('./block-registry.js');

const reference = JSON.parse(readFileSync(new URL('../public/research/interchange-dim-populate-reference.json', import.meta.url), 'utf8'));
const sha = (blocks, metadata) => {
  const buf = Buffer.alloc(65536 * 4);
  for (let i = 0; i < 65536; i++) buf.writeInt32LE(blocks[i] | metadata[i] << 12, i * 4);
  return createHash('sha1').update(buf).digest('hex');
};
const cellsOf = (t) => {
  const cells = new Uint16Array(65536);
  for (let i = 0; i < 65536; i++) if (t.blocks[i]) { const m = fromOriginal(t.blocks[i], t.metadata[i]); assert.ok(m?.exact); cells[i] = m.id | m.meta << 8; }
  return cells;
};

async function replay(sc) {
  const dimension = sc.dim === 'nether' ? -1 : 1, terrain = dimensionTerrain(dimension, BigInt(sc.seed)), store = new Map(), stored = [], unpopulated = [];
  for (const [x, z, , flag] of sc.inputs) {
    store.set(`${x},${z}`, encodeBaseColumn('w', x, z, cellsOf(terrain(x, z)), { terrainPopulated: !!flag }));
    stored.push([x, z]); if (!flag) unpopulated.push([x, z]);
  }
  const final = new Map();
  const out = await populateImportedColumns({
    population: {}, origin: { chunkX: 0, chunkZ: 0 }, worldKey: 'w', coords: stored, unpopulated, dimension, seed: BigInt(sc.seed),
    read: async (_w, list) => list.map(([x, z]) => store.get(`${x},${z}`) ?? null),
    write: async (records) => { for (const r of records) store.set(`${r.x},${r.z}`, r); },
    observe: (x, z, orig) => final.set(`${x},${z}`, sha(orig.blocks, orig.metadata)),
  });
  return { out, final, store };
}

for (const sc of reference.records) {
  test(`${sc.dim} ${sc.label}: populate order, chunks, flags, tiles, entities and ticks match the native replay`, async () => {
    const { out, final, store } = await replay(sc);
    assert.deepEqual(out.order ?? [], sc.calls);
    for (const [x, z, hash, flag] of sc.chunks) {
      const got = final.get(`${x},${z}`);
      assert.equal(got ?? sc.inputs.find(([a, b]) => a === x && b === z)[2], hash, `chunk ${x},${z}`);
      assert.equal(store.get(`${x},${z}`).terrainPopulated, !!flag);
    }
    assert.deepEqual(out.spawners.map((t) => [t.x, t.y, t.z, t.EntityId]).sort(), sc.tiles.filter((t) => t[3] === 'spawner').map((t) => [t[0], t[1], t[2], t[4]]).sort());
    assert.equal(out.entities.length, sc.entities.length);
    assert.equal(out.fluidTicks.length + out.fireTicks.length + out.fallingTicks.length + out.dropped.ticks, sc.pendingCount);
    assert.equal(out.fireTicks.length, sc.pendingFire);
    assert.equal(out.dropped.ticks, 0);
  });
}

test('populate keeps what a cell cannot tell apart: static lava with a level, and level-0 flowing lava, round trip through the overlay', async () => {
  const sc = reference.records.find((r) => r.dim === 'nether' && r.label === 'all-unpopulated');
  const { store } = await replay(sc);
  let levelled = 0;
  for (const record of store.values()) {
    const d = decodeBaseColumn(record);
    for (const [i, k] of d.overlay) {
      // hardened lava (BlockLiquid.onBlockAdded) keeps its level; the cell implies flowing lava for any level
      if (k >> 4 === 11 && (k & 15) !== 0) { levelled++; assert.equal(toOriginal(d.blocks[i], d.metadata[i], { flowing: true })[0], 10); }
    }
  }
  assert.ok(levelled > 0);
  // A stored level-0 flowing lava cell (overlay 10:0) is read as flowing lava by the next populate and stays in the overlay.
  const terrain = dimensionTerrain(-1, 1n), stored = [[0, 0], [1, 0], [0, 1], [1, 1]], records = new Map(), spot = 7 * 256 + 250;
  for (const [x, z] of stored) {
    const cells = cellsOf(terrain(x, z));
    if (x === 0 && z === 0) { const lava = fromOriginal(11, 0); cells[spot] = lava.id | lava.meta << 8; }
    records.set(`${x},${z}`, encodeBaseColumn('w', x, z, cells, { terrainPopulated: false, overlay: x === 0 && z === 0 ? new Map([[spot, 10 << 4]]) : null }));
  }
  let seen = null;
  await populateImportedColumns({
    population: {}, origin: { chunkX: 0, chunkZ: 0 }, worldKey: 'w', coords: stored, unpopulated: stored, dimension: -1, seed: 1n,
    read: async (_w, list) => list.map(([x, z]) => records.get(`${x},${z}`)),
    write: async (rs) => { for (const r of rs) records.set(`${r.x},${r.z}`, r); },
    observe: (x, z, orig) => { if (x === 0 && z === 0) seen = [orig.blocks[spot], orig.metadata[spot]]; },
  });
  assert.deepEqual(seen, [10, 0]);
  assert.deepEqual(decodeBaseColumn(records.get('0,0')).overlay.get(spot), 10 << 4);
});

test('stored columns without an overlay read as before, and the overlay survives the JSON form', () => {
  const cells = new Uint16Array(65536);
  cells[300] = 7;
  const plain = encodeBaseColumn('w', 1, 2, cells);
  assert.equal('orig' in plain, false);
  assert.equal(decodeBaseColumn(plain).overlay.size, 0);
  const old = { ...plain }; delete old.orig;
  assert.equal(decodeBaseColumn(old).blocks[300], 7);
  const withOverlay = encodeBaseColumn('w', 1, 2, cells, { overlay: new Map([[300, 10 << 4], [42, 54 << 4 | 5]]) });
  assert.deepEqual(withOverlay.orig, [42, 54 << 4 | 5, 300, 10 << 4]);
  const back = baseFromJson('v', JSON.parse(JSON.stringify(baseToJson(withOverlay))));
  assert.deepEqual(back.orig, withOverlay.orig);
  assert.equal(decodeBaseColumn(back).overlay.get(300), 160);
  assert.equal('o' in baseToJson(plain), false);
  assert.throws(() => decodeBaseColumn({ ...plain, orig: [1] }), /damaged/);
  assert.throws(() => decodeBaseColumn({ ...plain, orig: [70000, 1] }), /damaged/);
});
