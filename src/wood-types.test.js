import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { Survival, ITEMS } from './survival.js';
import { makeStack } from './inventory.js';
import { placeHeldBlock } from './block-placement-simulation.js';
import { logPlacedMeta, treePickDamage } from './wood-types.js';

test('BlockRotatedPillar.func_149660_a: wood type is damage & 3, axis bits from the clicked side', () => {
  const axis = [0, 0, 8, 8, 4, 4]; // bytecode of ang.a: tableswitch 0,1 -> 0; 2,3 -> 8; 4,5 -> 4
  for (let side = 0; side < 6; side++) for (let damage = 0; damage < 4; damage++) assert.equal(logPlacedMeta(damage, side), damage | axis[side]);
  assert.equal(logPlacedMeta(7, 0), 3); // only the low two bits of a stack's damage are the wood type
});

test('middle-click copies getDamageValue: log/leaf type, plank type, sapling type', () => {
  assert.equal(treePickDamage(4, 2 | 8), 2);
  assert.equal(treePickDamage(70, 1 | 4), 1);
  assert.equal(treePickDamage(5, 3 | 4 | 8), 3);
  assert.equal(treePickDamage(71, 1 | 8), 1);
  assert.equal(treePickDamage(7, 5), 5);
  assert.equal(treePickDamage(48, 5 | 8), 5);
  assert.equal(treePickDamage(2, 1), null);
});

test('placing logs against a block face gives the oriented, typed metadata for both log blocks', () => {
  for (const [id, damage] of [[4, 0], [4, 3], [70, 0], [70, 1]]) {
    for (const [side, dir, axis] of [[1, [0, 1, 0], 0], [2, [0, 0, -1], 8], [3, [0, 0, 1], 8], [4, [-1, 0, 0], 4], [5, [1, 0, 0], 4]]) {
      const w = new World('log-place', 'meadow', 8), p = new Survival({}, 'creative');
      const base = [20, 40, 20], adj = base.map((v, i) => v + dir[i]);
      w.put(...base, 3);
      w.put(...adj, 0);
      p.inventory.main[0] = makeStack(id, 1, damage);
      const r = placeHeldBlock({ world: w, survival: p, position: { x: 30.5, y: 40, z: 30.5 }, flowers: {}, yaw: 0, farming: { observe() {} } }, { id, item: ITEMS[id], target: { block: base, adjacent: adj } }, { updateBlock: () => {} });
      assert.equal(r.placed, true, `${id}:${damage} side ${side}`);
      assert.equal(w.get(...adj), id);
      assert.equal(w.getMeta(...adj), damage | axis, `${id}:${damage} side ${side}`);
    }
  }
});
