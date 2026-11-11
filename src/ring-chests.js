// Batch 41 (ringpiston): generated chest loot for containers reached before their chunk was ever resident.
// Natively a dungeon, mineshaft, temple or stronghold chest is filled when its chunk populates, so a hopper or dropper beside the chunk
// edge finds the loot at once. Here the loot sits in the streamed population record and is handed to the live chest stores only when the
// column first becomes resident (population-runtime.js restoreChests), and `openChest` creates an empty tile for a chest without one: a
// hopper in the resident window reaching across the chunk edge into a ring column would have made an empty chest that later blocks
// the loot for good ("an existing tile is never overwritten"). `seedRingChest` fills the tile from the record first, with the same
// once-only rule (an existing tile, even an emptied one, is left alone).
import { restoreChests } from "./population-runtime.js";
import { isChestBlock } from "./chest-blocks.js";

const SIDES = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]; // the chest and the cells it can pair with
// Fills the loot tiles of the chest at (x, y, z) and of its pairing neighbours when they have none. Returns the number filled.
// `residency` (ContainerResidency, optional): a chest in a visited and evicted column first gets its saved containers loaded back (ringReach);
// while that read is pending the result is false and the caller treats the container as not there yet.
export function seedRingChest(world, chests, x, y, z, residency = null) {
  const pop = world.population;
  if (!isChestBlock(world.get(x, y, z))) return 0;
  if (residency && !ringReach(world, residency, x, y, z)) return false;
  if (!pop) return 0;
  let filled = 0, pending = false;
  for (const [dx, dz] of SIDES) {
    const cx = x + dx, cz = z + dz;
    if (chests[`${cx},${y},${cz}`] || !isChestBlock(world.get(cx, y, cz))) continue;
    const record = pop.unclaimedRecord(cx >> 4, cz >> 4);
    if (record === undefined) { pending = true; continue; } // the generation worker is building the population cell: the hopper waits
    const mine = record?.chests?.filter((c) => c.x === cx && c.y === y && c.z === cz);
    if (mine?.length) filled += restoreChests(mine, world, { chests });
  }
  return pending ? false : filled;
}

// True when the saved containers of the columns of a container (and of the chests it can pair with) are in the live stores.
export function ringReach(world, residency, x, y, z) {
  let ready = true;
  for (const [dx, dz] of SIDES) {
    const cx = x + dx, cz = z + dz;
    if ((dx || dz) && !isChestBlock(world.get(cx, y, cz))) continue;
    if (!residency.reach(cx, cz)) ready = false;
  }
  return ready;
}
