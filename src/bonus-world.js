// WorldServer.createSpawnPosition / initialize: the bonus chest (WorldGeneratorBonusChest, bonus-chest.js) is placed while the world is created, after the
// spawn is chosen and before any player or tile entity runtime exists (bytecode-read in batch 21: createSpawnPosition ends with `createBonusChest()` when
// WorldInfo.isBonusChestEnabled and the level is not yet initialised). The port has no separate creation step, so openWorld calls this on the freshly
// constructed World for a record that has not placed it yet (`bonusChestPlaced`), before `launch`. The block writes land in the world's edits (saved with
// it); the chest tile is returned and `launch` hands it to the player's survival state. Randomness is unseeded like World.rand, so native contents differ
// per creation; tests inject a fixed JavaRandom.
import { createBonusChest, unseededBonusRandom } from './bonus-chest.js';
import { fromOriginal, toOriginal } from './block-registry.js';
import { ORIGINAL_ITEMS } from './original-items.js';
import { makeStack } from './inventory.js';
import { settleFacing } from './chest.js';
import { JavaRandom } from './java-random.js';

// True when a record still owes the bonus chest to this world (overworld, spawn known).
export const bonusChestDue = (record, world) => !!(record?.bonusChest && !record.bonusChestPlaced && !world.dimension && record.worldSpawn);

// Places the chest on `world` around record.worldSpawn (local coordinates); returns { placed, changes, chests } where `changes` are [x, y, z, old, new]
// block edits for a mesh update and `chests` maps "x,y,z" to the chest tiles written. `random` defaults to an unseeded JavaRandom.
export function placeBonusChest(world, record, { random = unseededBonusRandom(JavaRandom) } = {}) {
  const solid = (x, y, z) => world.solid(x, y, z), orig = (x, y, z) => toOriginal(world.get(x, y, z), world.getMeta(x, y, z))?.[0] ?? 0;
  const changes = [], chests = {}, access = {
    id: orig,
    blocksMovement: (x, y, z) => solid(x, y, z),
    solidTop: (x, y, z) => solid(x, y, z) && orig(x, y, z) !== 54,
    put(x, y, z, id, meta) {
      // BlockTorch.onBlockAdded (bytecode-read): a torch set with metadata 0 takes the first of west (1), east (2), north (3), south (4) whose neighbour has a
      // solid side facing it, else standing (5) on a solid top; with none it cannot stay (func_150109_e drops it), so it is not placed.
      if (id === 50 && meta === 0) {
        const wall = [[-1, 0, 1], [1, 0, 2], [0, -1, 3], [0, 1, 4]].find(([dx, dz]) => solid(x + dx, y, z + dz) && orig(x + dx, y, z + dz) !== 54);
        meta = wall ? wall[2] : solid(x, y - 1, z) && orig(x, y - 1, z) !== 54 ? 5 : -1;
        if (meta < 0) return;
      }
      const cell = fromOriginal(id, meta);
      if (!cell) return;
      const old = world.get(x, y, z);
      world.set(x, y, z, cell.id, true, cell.meta);
      changes.push([x, y, z, old, cell.id]);
      if (id === 54) settleFacing(world, chests, x, y, z);
    },
    fill(x, y, z, slot, s) {
      const live = ORIGINAL_ITEMS[`${s.id}:${s.damage}`] ?? ORIGINAL_ITEMS[s.id];
      const chest = chests[`${x},${y},${z}`];
      if (live && chest) chest.items[slot] = makeStack(live, s.count, s.damage);
    },
  };
  const [sx, , sz] = record.worldSpawn;
  const placed = createBonusChest(access, random, sx, sz);
  record.bonusChestPlaced = true;
  return { placed, changes, chests };
}
