import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { Survival, ITEMS } from './survival.js';
import { placeHeldBlock } from './block-placement-simulation.js';
import { TILES, blockTile } from './block-textures.js';

test('furnace, chest and six-way machine placement keeps the correct horizontal facing in all four directions', () => {
  const world = new World('directional-placement', 'meadow', 1), survival = new Survival({}, 'creative');
  const cell = [10, 21, 10], target = { block: [10, 20, 10], adjacent: cell }, expected = [3, 5, 2, 4];
  world.set(...target.block, 3);
  for (const id of [14, 41, 1940, 1941, 1115, 1132, 1116, 1117]) {
    const facings = [];
    for (let q = 0; q < 4; q++) {
      world.set(...cell, 0); survival.inventory.main[0] = { id, count: 1, damage: 0 };
      const state = { world, survival, position: { x: 30.5, y: 21, z: 30.5 }, yaw: q * Math.PI / 2, farming: { observe() {} } };
      const result = placeHeldBlock(state, { id, item: ITEMS[id], target }, { collides: () => false });
      assert.equal(result.placed, true, `item ${id}`);
      facings.push(id === 41 || id === 1940 ? survival.chests[cell.join(',')].facing : world.getMeta(...cell));
    }
    assert.deepEqual(facings, expected, `item ${id}`);
  }
});

test('a furnace has one correctly-facing front in every orientation, lit or unlit', () => {
  for (const [meta, front] of [[2, 5], [3, 4], [4, 1], [5, 0]]) for (const lit of [false, true]) {
    const faces = Array.from({ length: 6 }, (_, face) => TILES[blockTile(14, face, lit, meta)]);
    assert.equal(faces[front], lit ? 'furnace_front_on' : 'furnace_front_off');
    assert.equal(faces.filter((name) => name.startsWith('furnace_front')).length, 1);
    assert.equal(faces[2], 'furnace_top'); assert.equal(faces[3], 'furnace_top');
  }
});
