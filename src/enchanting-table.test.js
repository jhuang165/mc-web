import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ENCHANTING_TABLE, BLOCKS, blockBounds, blockHeight } from './world.js';
import { fromOriginal, toOriginal } from './block-registry.js';
import { lightOpacity } from './lighting.js';
import { explosionResistance } from './explosion.js';
import { installPopulationMaterials, POPULATION_ITEMS } from './population-content.js';
import { liveBookshelfPower, liveBookshelfWorld, withinEnchantReach } from './enchanting-table.js';
import { bookshelfPower } from './enchantments.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/enchanting-table-reference.json', import.meta.url)));
const SHELF = fromOriginal(47).id, TORCH = 1000;

test('the live table block matches the unchanged BlockEnchantmentTable record', () => {
  const b = ref.block;
  assert.equal(b.id, 116);
  assert.equal(b.className, 'BlockEnchantmentTable');
  assert.equal(ENCHANTING_TABLE, 86);
  assert.equal(BLOCKS[ENCHANTING_TABLE].name, 'Enchanting table');
  assert.deepEqual(toOriginal(ENCHANTING_TABLE, 0), [116, 0]);
  assert.equal(fromOriginal(116).id, ENCHANTING_TABLE);
  assert.equal(POPULATION_ITEMS[116], ENCHANTING_TABLE); // drops itself: the item for id 116 places it back
  // Bounds: 0.75 tall box for collision and selection; not a normal or opaque cube.
  assert.deepEqual(b.bounds, [0, 0, 0, 1, 0.75, 1]);
  assert.equal(blockHeight(ENCHANTING_TABLE), b.bounds[4]);
  assert.deepEqual(blockBounds({ get: () => ENCHANTING_TABLE, getMeta: () => 0 }, 0, 0, 0), b.bounds);
  assert.equal(b.renderNormal, false);
  assert.equal(b.opaque, false);
  assert.equal(lightOpacity(ENCHANTING_TABLE), b.lightOpacity);
  // Hardness 5 with a pickaxe required to harvest; explosion resistance 1200 like obsidian.
  const materials = {};
  installPopulationMaterials(materials);
  assert.equal(materials[ENCHANTING_TABLE].hardness, b.hardness);
  assert.equal(materials[ENCHANTING_TABLE].kind, 'pickaxe');
  assert.equal(b.toolNotRequired, false);
  assert.equal(explosionResistance(ENCHANTING_TABLE), Math.fround(b.explosionResistance));
  assert.deepEqual([b.itemDropped, b.quantityDropped, b.damageDropped, b.lightValue], [116, 1, 0, 0]);
});

// Cells around a table at (0,64,0); `put` assigns live ids, everything else is air.
const worldWith = (cells) => ({ get: (x, y, z) => cells[`${x},${y},${z}`] ?? 0 });

test('bookshelf count reads the live world and respects air gaps', () => {
  const ring = {};
  // A full ring of shelves two blocks out at both heights: 16 positions x 2 layers, plus corner side cells.
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++)
    if (Math.max(Math.abs(dx), Math.abs(dz)) === 2) for (const dy of [0, 1]) ring[`${dx},${64 + dy},${dz}`] = SHELF;
  assert.equal(liveBookshelfPower(worldWith(ring), 0, 64, 0), 32);
  // A torch on the gap cell closes that direction: the cell is no longer air.
  const blocked = { ...ring, '1,64,0': TORCH };
  assert.equal(liveBookshelfPower(worldWith(blocked), 0, 64, 0), 30);
  // A block on the upper gap cell does the same.
  assert.equal(liveBookshelfPower(worldWith({ ...ring, '-1,65,0': TORCH }), 0, 64, 0), 30);
  // Shelves directly beside the table do not count; only two blocks out.
  assert.equal(liveBookshelfPower(worldWith({ '1,64,0': SHELF, '1,65,0': SHELF }), 0, 64, 0), 0);
  assert.equal(liveBookshelfPower(worldWith({ '2,64,0': SHELF, '2,65,0': SHELF }), 0, 64, 0), 2);
  // The adapter reports original ids: 47 for a shelf, never air for other blocks.
  const w = liveBookshelfWorld(worldWith({ '2,64,0': SHELF, '3,64,0': TORCH }));
  assert.deepEqual([w.getBlock(2, 64, 0), w.getBlock(3, 64, 0), w.isAirBlock(2, 64, 0), w.isAirBlock(3, 64, 0), w.isAirBlock(4, 64, 0)], [47, -1, false, false, true]);
  // Same scan as the standalone ContainerEnchantment replay.
  assert.equal(bookshelfPower({ getBlock: (x, y, z) => (x === 2 && y === 64 && z === 0 ? 47 : 0) }, 0, 64, 0), 1);
});

test('unloaded streaming columns count as neither air nor shelves', () => {
  const world = { streaming: true, isLoaded: (x) => x < 2, get: () => SHELF };
  // Everything the scan reads two blocks out sits in an unloaded column, and the gaps are shelves.
  assert.equal(liveBookshelfPower(world, 0, 64, 0), 0);
});

test('canInteractWith distance uses the table centre and an 8 block radius', () => {
  for (const [dx, dy, dz, ok, gone] of ref.reach.rows)
    if (!gone) assert.equal(withinEnchantReach({ x: 10.5 + dx, y: 64.5 + dy, z: 10.5 + dz }, 10, 64, 10), ok);
});
