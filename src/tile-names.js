// CustomName on block entities (b74 tilenames). Bytecode-read from the 1.7.10 classes (see .shared-memory/notes/tilenames-b74-track.md):
//  - BlockChest (ajx), BlockFurnace (ale), BlockDispenser (akm, droppers too), BlockHopper (aln), BlockBrewingStand (ajq) and
//    BlockEnchantmentTable (aks) onBlockPlacedBy: `if (stack.hasDisplayName()) tile.setCustomName(stack.getDisplayName())`.
//  - Each tile's writeToNBT writes `CustomName` only when hasCustomInventoryName() (name != null && length > 0); readFromNBT reads it
//    when the tag is a string (type 8). A tile without a name is never given an empty tag.
//  - InventoryLargeChest.getInventoryName: the first (west/north) half's name, else the second half's, else container.chestDouble.
//  - EntityPlayerMP.displayGUIChest/Hopper/... send S2D with the inventory name and isInventoryNameLocalized() (the useProvidedTitle flag);
//    the enchanting table sends its name (or null).
// The port keeps the name as `name` on each tile record (hoppers already did), and enchanting table names in `survival.tableNames`.
// Block ids are the port's own (world.js, chest.js, hopper.js ...), not the native ones: the native pair is noted beside each.
export const CHEST = 41 /* 54 */, TRAPPED_CHEST = 162 /* 146 */, FURNACE = 14 /* 61 and 62: the lit state is the record's */, DISPENSER = 115 /* 23 */, DROPPER = 132 /* 158 */, HOPPER = 133 /* 154 */, BREWING = 134 /* 117 */, ENCHANTING_TABLE = 86 /* 116 */;
const STORE = { [CHEST]: 'chests', [TRAPPED_CHEST]: 'chests', [FURNACE]: 'furnaces', [DISPENSER]: 'dispensers', [DROPPER]: 'dispensers', [HOPPER]: 'hoppers', [BREWING]: 'brewing' };
/** Store name of a block that can carry a CustomName, or null. */
export const nameStoreOf = (id) => (id === ENCHANTING_TABLE ? 'tableNames' : STORE[id] ?? null);
/** TileEntity.hasCustomInventoryName (k_). */
export const hasTileName = (name) => typeof name === 'string' && name.length > 0;
/** A saved name as a record field: a non-empty string or null. */
export const cleanTileName = (name) => (hasTileName(name) ? name : null);
/** The tile record's name, or null. */
export const tileNameOf = (record) => cleanTileName(record?.name);
/** Container fields for a named tile: the GUI shows the name unchanged (isInventoryNameLocalized), not a translation key. */
export const namedTitle = (name) => (hasTileName(name) ? { title: name, titleLocalized: true } : {});
/** InventoryLargeChest.getInventoryName over two halves' names (first = west or north). */
export const largeChestName = (first, second) => (hasTileName(first) ? first : hasTileName(second) ? second : null);

/**
 * onBlockPlacedBy: copy the held stack's display name onto the tile at `key` ("x,y,z"). `survival` carries the stores. Returns true when
 * a name was set. The record must already exist for the block kinds that keep records (the caller creates it first).
 */
export function nameTileFromStack(survival, id, key, held) {
  const store = nameStoreOf(id);
  if (!store || !held || typeof held.displayName !== 'string') return false;
  const name = held.displayName;
  if (store === 'tableNames') { (survival.tableNames ??= {})[key] = name; return true; }
  const record = id === FURNACE ? survival.furnace(key) : ((survival[store] ??= {})[key] ??= null);
  if (!record) return false;
  record.name = name;
  return true;
}

/**
 * b75: a TileEntityEnchantmentTable lives and dies with its block (Chunk.removeTileEntity from World.setBlock / breakBlock), so its CustomName
 * must go on every removal path. Drops the name at `key` ("x,y,z") unless `blockId` is still a table; returns true when one was dropped.
 */
export function forgetTableName(survival, key, blockId) {
  if (blockId === ENCHANTING_TABLE || !survival?.tableNames || !(key in survival.tableNames)) return false;
  delete survival.tableNames[key];
  return true;
}
/** Sweep: drop every name whose block is no longer a table. `blockAt(x, y, z)` returns the block id or null for an unloaded cell (kept). */
export function pruneTableNames(survival, blockAt) {
  let n = 0;
  for (const key of Object.keys(survival?.tableNames ?? {})) {
    const [x, y, z] = key.split(',').map(Number), id = blockAt(x, y, z);
    if (id != null && forgetTableName(survival, key, id)) n++;
  }
  return n;
}
