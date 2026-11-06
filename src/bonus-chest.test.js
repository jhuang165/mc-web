// The bonus chest against the unchanged WorldServer.k / WorldGeneratorBonusChest replay (flat-world-reference.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFlatInfo, FlatChunkProvider } from './flat-world.js';
import { JavaRandom } from './java-random.js';
import { BONUS_CONTENTS, createBonusChest } from './bonus-chest.js';

const reference = JSON.parse(readFileSync(new URL('../public/research/flat-world-reference.json', import.meta.url), 'utf8'));
const rows = (kind) => reference.records.filter((r) => r.kind === kind);
// Material.blocksMovement / doesBlockHaveSolidTopSurface for the blocks the presets use (water, snow layer: neither).
const LIQUID_OR_LAYER = new Set([0, 8, 9, 10, 11, 78]);

test('bonus chest contents are the native ChestGenHooks list', () => {
  const native = rows('bonusContents')[0].items;
  assert.deepEqual(BONUS_CONTENTS.map(([id, damage, min, max, weight]) => [[id, 1, damage], min, max, weight]), native);
});

test('createBonusChest replays every native record: attempts, block writes, chest slot writes and the Random state', () => {
  const records = rows('bonus');
  assert.equal(records.length, 40);
  for (const rec of records) {
    const provider = new FlatChunkProvider(parseFlatInfo(rec.preset)), column = provider.column, meta = provider.columnMeta;
    const edits = new Map(), writes = [], calls = [];
    const id = (x, y, z) => edits.get(`${x},${y},${z}`) ?? (y >= 0 && y < 256 ? column[y] : 0);
    const world = {
      id,
      blocksMovement: (x, y, z) => !LIQUID_OR_LAYER.has(id(x, y, z)),
      solidTop: (x, y, z) => { const b = id(x, y, z); return b !== 0 && !LIQUID_OR_LAYER.has(b) && b !== 54 && b !== 50; },
      put(x, y, z, b, m) { edits.set(`${x},${y},${z}`, b); writes.push([x, y, z, b, m, 2]); },
      fill(x, y, z, slot, s) { calls.push([slot, [s.id, s.count, s.damage]]); },
    };
    const random = new JavaRandom(rec.seed), tries = [];
    const placed = createBonusChest(world, random, rec.spawn[0], rec.spawn[1], tries);
    const label = `${rec.preset} seed ${rec.seed}`;
    assert.equal(placed, rec.placed, label);
    assert.deepEqual(tries, rec.tries, label);
    assert.deepEqual(writes, rec.writes, label);
    assert.deepEqual(rec.chests.length ? rec.chests[0][1] : [], calls, label);
    const hi = random.next(32), lo = random.next(32);
    assert.equal(String(BigInt.asIntN(64, (BigInt(hi) << 32n) + BigInt(lo))), rec.nextLong, label);
  }
});
