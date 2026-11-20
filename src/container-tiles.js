// b88 tiles88: Container.canInteractWith in single player for a screen over tile entity records. TileEntityChest, TileEntityFurnace,
// TileEntityDispenser (and dropper), TileEntityHopper, TileEntityBrewingStand and TileEntityEnderChest.isUseableByPlayer (aow / apg / apb / api /
// aov / ape.a(yz)Z, bytecode-read) all begin `world.getTileEntity(x, y, z) != this -> false`, and EntityPlayer.onUpdate (yz.h) closes the
// screen when the open container's canInteractWith fails. A /setblock over the block (even the same block with another metadata: Chunk.func_150807_a
// runs breakBlock, which removes the tile) leaves a new tile at the cell, so the screen closes; the block-id checks in main.js tickChests did not see it.
// The port's tiles are the plain records of the survival stores, so "the same tile" is the same record object.
const STORES = { furnace: "furnaces", dispenser: "dispensers", hopper: "hoppers", brewing: "brewing" };

// The [store, key, record] triples the screen of `kind` at `key` (a chest: every key of the container, a large chest's two halves) was opened on.
export function heldTiles(stores, kind, key, keys) {
  if (kind === "chest") {
    return (keys ?? []).map((k) => (stores.chests?.[k] ? ["chests", k, stores.chests[k]] : stores.enderTiles?.[k] ? ["enderTiles", k, stores.enderTiles[k]] : null)).filter(Boolean);
  }
  const name = STORES[kind];
  return name && key && stores[name]?.[key] ? [[name, key, stores[name][key]]] : [];
}
// isUseableByPlayer's identity test: true once any of the tiles is no longer the one at its cell.
export const tilesReplaced = (stores, held) => !!held?.some(([name, key, record]) => stores[name]?.[key] !== record);
