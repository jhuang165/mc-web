// Blocks that lose their support on the gun server drop as items (multiplayer/simulation.js dropBlock, as main.js does in
// single-player): BlockTorch, BlockRailBase, BlockCarpet and BlockCactus.onNeighborBlockChange, the other half of a door or
// a bed a player breaks (one item in all), and a falling block that cannot land. Before this the server removed them with
// no drop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GunSimulation } from './multiplayer/gun-simulation.js';
import { serverWorldReady, STREAMED_BIOME, STREAMED_GENERATION } from './multiplayer/server-world.js';
import { TORCH, RAIL, CACTUS, SAND, WOODEN_DOOR } from './world.js';
import { CARPET, COLORED_ITEM_OFFSET } from './colored-blocks.js';
import { WOODEN_DOOR_ITEM } from './doors-panes.js';
import { BED, ITEM_BED } from './bed.js';
import { installGunRules } from '../server/pack-loader.js';

await serverWorldReady;
await installGunRules();
const STREAMED = { seed: 'ledoge0', biome: STREAMED_BIOME, generationVersion: STREAMED_GENERATION };
const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
const STONE = 1;
const run = (sim, n) => { for (let i = 0; i < n; i++) sim.tick(); };

// Alice in Survival on a stone floor in the sky; `dropped()` lists [id, count, damage] of the items spawned since the last call.
function arena() {
  const sim = new GunSimulation({ ...STREAMED, time: 6000 }, { config: { spawnMonsters: false, spawnAnimals: false, spawnProtection: 0 }, random: seeded(7) });
  sim.mobs.ew.entities.length = 0;
  const a = sim.addPlayer('a', 'Alice', 'acct-a');
  const ax = Math.floor(a.position.x), az = Math.floor(a.position.z), y = 150;
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) sim.world.put(ax + dx, y - 1, az + dz, STONE, 0);
  sim.teleport(a, { x: ax + 0.5, y, z: az + 0.5 });
  a.survival.mode = 'survival'; a.survival.inventory.creative = false; a.survival.inventory.main.fill(null);
  run(sim, 3);
  let seen = sim.play.items.items.length;
  const dropped = () => { const list = sim.play.items.items.slice(seen).map(i => [i.stack.id, i.stack.count, i.stack.damage ?? 0]); seen = sim.play.items.items.length; return list; };
  return { sim, a, x0: ax - 4, y, z0: az - 4, dropped };
}

test('a torch, a rail, a carpet and a cactus whose support is removed each drop once', () => {
  const { sim, x0, y, z0, dropped } = arena();
  const cases = [[TORCH, 5, [TORCH, 1, 0]], [RAIL, 0, [RAIL, 1, 0]], [CARPET, 14, [CARPET + COLORED_ITEM_OFFSET, 1, 14]], [CACTUS, 0, [CACTUS, 1, 0]]];
  cases.forEach(([id, meta, drop], i) => {
    const x = x0 + 2 * i, base = id === CACTUS ? SAND : STONE;
    sim.world.set(x, y, z0, base, true, 0);
    sim.world.set(x, y + 1, z0, id, true, meta);
    run(sim, 2);
    assert.equal(sim.world.get(x, y + 1, z0), id, `${id} placed`);
    dropped();
    sim.world.set(x, y, z0, 0, true, 0);
    run(sim, 2);
    assert.equal(sim.world.get(x, y + 1, z0), 0, `${id} popped off`);
    assert.deepEqual(dropped(), [drop], `${id} drops once`);
  });
});

test('breaking either half of a door or a bed gives one item: the other half pops without a second drop', () => {
  const { sim, a, x0, y, z0, dropped } = arena();
  const door = (x) => { sim.world.put(x, y, z0, WOODEN_DOOR, 0); sim.world.put(x, y + 1, z0, WOODEN_DOOR, 8); };
  const bed = (x) => { sim.world.put(x, y, z0 + 1, BED, 2); sim.world.put(x, y, z0, BED, 2 | 8); };
  const ids = list => list.map(([id, count]) => [id, count]);
  door(x0); dropped();
  assert.ok(sim.play.breakBlock(a, [x0, y, z0]));
  run(sim, 2);
  assert.deepEqual([sim.world.get(x0, y, z0), sim.world.get(x0, y + 1, z0)], [0, 0]);
  assert.deepEqual(ids(dropped()), [[WOODEN_DOOR_ITEM, 1]], 'lower half broken');
  door(x0 + 2); dropped();
  assert.ok(sim.play.breakBlock(a, [x0 + 2, y + 1, z0]));
  run(sim, 2);
  assert.deepEqual([sim.world.get(x0 + 2, y, z0), sim.world.get(x0 + 2, y + 1, z0)], [0, 0]);
  assert.deepEqual(ids(dropped()), [[WOODEN_DOOR_ITEM, 1]], 'upper half broken');
  bed(x0 + 4); dropped();
  assert.ok(sim.play.breakBlock(a, [x0 + 4, y, z0 + 1]));
  run(sim, 2);
  assert.deepEqual([sim.world.get(x0 + 4, y, z0), sim.world.get(x0 + 4, y, z0 + 1)], [0, 0]);
  assert.deepEqual(ids(dropped()), [[ITEM_BED, 1]], 'foot broken');
  bed(x0 + 6); dropped();
  assert.ok(sim.play.breakBlock(a, [x0 + 6, y, z0]));
  run(sim, 2);
  assert.deepEqual([sim.world.get(x0 + 6, y, z0), sim.world.get(x0 + 6, y, z0 + 1)], [0, 0]);
  assert.deepEqual(ids(dropped()), [[ITEM_BED, 1]], 'head broken');
});

test('sand falling onto a torch drops as an item and leaves the torch', () => {
  const { sim, x0, y, z0, dropped } = arena();
  sim.world.set(x0, y, z0, TORCH, true, 5);
  run(sim, 1); dropped();
  sim.world.set(x0, y + 6, z0, SAND, true, 0);
  run(sim, 60);
  assert.equal(sim.world.get(x0, y, z0), TORCH);
  assert.equal(sim.world.get(x0, y + 6, z0), 0);
  assert.deepEqual(dropped(), [[SAND, 1, 0]]);
});
