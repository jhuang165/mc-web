// The bonus chest placed during world creation (bonus-world.js) on a live streamed World, against the native replay record of the unchanged jar
// (public/research/flat-world-reference.json, kind bonus) for contents, positions and the Random state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from './world.js';
import { JavaRandom } from './java-random.js';
import { toOriginal, fromOriginal } from './block-registry.js';
import { ORIGINAL_ITEMS } from './original-items.js';
import { bonusChestDue, placeBonusChest } from './bonus-world.js';
import { populationBlockMapperReady } from './population-world.js';
await populationBlockMapperReady;

const reference = JSON.parse(readFileSync(new URL('../public/research/flat-world-reference.json', import.meta.url), 'utf8'));
const rec = reference.records.find((r) => r.kind === 'bonus' && r.preset === '2;7,2x3,2;1;village' && r.seed === 0);

test('bonusChestDue: only an overworld record that asked for it, has a spawn and has not placed it', () => {
  const world = { dimension: 0 }, ok = { bonusChest: true, worldSpawn: [1, 2, 3] };
  assert.equal(bonusChestDue(ok, {}), true);
  assert.equal(bonusChestDue({ ...ok, bonusChestPlaced: true }, {}), false);
  assert.equal(bonusChestDue({ ...ok, bonusChest: false }, {}), false);
  assert.equal(bonusChestDue({ bonusChest: true }, {}), false);
  assert.equal(bonusChestDue(ok, { dimension: 1 }), false);
  assert.equal(bonusChestDue(null, world), false);
});

test('creation places the replayed chest, contents and torches in the live world before any runtime exists', () => {
  const world = new World('0', 'javaStreamed', 18, 'flat', rec.preset);
  assert.equal(world.onChange, null, 'no runtime hooks yet');
  // Superflat is uniform, so the record's spawn (0, 0) is mapped to the window centre (64, 64) and every coordinate shifts with it.
  const record = { bonusChest: true, worldSpawn: [64, 4, 64] };
  assert.equal(bonusChestDue(record, world), true);
  const placed = placeBonusChest(world, record, { random: new JavaRandom(rec.seed) });
  assert.equal(placed.placed, true);
  assert.equal(record.bonusChestPlaced, true);
  assert.equal(bonusChestDue(record, world), false, 'placed once');
  const local = ([x, y, z]) => [x - rec.spawn[0] + 64, y, z - rec.spawn[1] + 64];
  const [chestPos, slots] = rec.chests[0], [cx, cy, cz] = chestPos.split(',').map(Number);
  const [lx, ly, lz] = local([cx, cy, cz]);
  assert.equal(toOriginal(world.get(lx, ly, lz), world.getMeta(lx, ly, lz))[0], 54);
  // every native chest slot write, in order (later writes to a slot win, as natively)
  const expected = Array(27).fill(null);
  for (const [slot, [id, count, damage]] of slots) expected[slot] = { id: ORIGINAL_ITEMS[`${id}:${damage}`] ?? ORIGINAL_ITEMS[id] ?? id, count };
  const tile = placed.chests[`${lx},${ly},${lz}`];
  assert.ok(tile, 'chest tile returned for launch');
  assert.deepEqual(tile.items.map((s) => s && { id: s.id, count: s.count }), expected);
  // the four torches of the record stand on the flat ground (metadata 5: no solid side beside them), the chest and torches are edits of the world
  const torches = rec.writes.filter((w) => w[3] === 50);
  assert.equal(torches.length, 4);
  for (const w of torches) {
    const [x, y, z] = local(w);
    const standing = fromOriginal(50, 5);
    assert.deepEqual([world.get(x, y, z), world.getMeta(x, y, z)], [standing.id, standing.meta]);
  }
  assert.ok(world.dirtyColumns.size > 0, 'the writes are saved with the world');
  assert.equal(placed.changes.length, rec.writes.length);
});

test('without the creation call an old record keeps loading as before: nothing is placed', () => {
  const world = new World('0', 'javaStreamed', 18, 'flat', rec.preset);
  const before = world.dirtyColumns.size;
  assert.equal(bonusChestDue({ bonusChest: true, bonusChestPlaced: true, worldSpawn: [0, 4, 0] }, world), false);
  assert.equal(world.dirtyColumns.size, before);
});
