// Live adapters for the 1.7.10 enchanting table. The calculation lives in enchantments.js
// (EnchantingTable, bookshelfPower), replayed against public/research/enchantment-reference.json;
// this module maps live world cells onto the original ids those functions read.
import { bookshelfPower, BOOKSHELF } from './enchantments.js';
import { internalIdsFor } from './block-registry.js';

// ContainerEnchantment slot layout (GUI pixels): the item slot, then the player inventory.
export const ENCHANT_SLOT = { x: 25, y: 47 };
export const ENCHANT_PLAYER_SLOTS = { x: 8, y: 84 };
// GuiEnchantment option buttons: left 60, top 14 + 19 * n, 108 x 19 on the 176 x 166 sheet.
export const ENCHANT_OPTION = { x: 60, y: 14, width: 108, height: 19, step: 19, count: 3 };
// ContainerEnchantment.canInteractWith: the player must be within 8 blocks of the table centre.
export const ENCHANT_REACH_SQUARED = 64;

const SHELVES = new Set(internalIdsFor(BOOKSHELF));

/**
 * World view for bookshelfPower: original id 47 for bookshelves, 0 for air and -1 for every other
 * block. ContainerEnchantment tests World.isAirBlock for the gap cells, so only air counts as open.
 * `world.get` of an unloaded streaming column reads as air-free (-1) so unloaded cells add nothing.
 */
export function liveBookshelfWorld(world) {
  const read = (x, y, z) => {
    if (world.streaming && world.isLoaded && !world.isLoaded(x, z)) return -1;
    return world.get(x, y, z);
  };
  return {
    getBlock: (x, y, z) => (SHELVES.has(read(x, y, z)) ? BOOKSHELF : -1),
    isAirBlock: (x, y, z) => read(x, y, z) === 0,
  };
}

/** Bookshelf count (0..32) around the live table cell, as ContainerEnchantment scans it. */
export const liveBookshelfPower = (world, x, y, z) => bookshelfPower(liveBookshelfWorld(world), x, y, z);

/** ContainerEnchantment.canInteractWith distance test (centre of the table block). */
export const withinEnchantReach = (position, x, y, z) =>
  (position.x - x - 0.5) ** 2 + (position.y - y - 0.5) ** 2 + (position.z - z - 0.5) ** 2 <= ENCHANT_REACH_SQUARED;
