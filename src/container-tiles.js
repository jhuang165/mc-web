// b88 tiles88: Container.canInteractWith in single player for a screen over tile entity records. TileEntityChest, TileEntityFurnace,
// TileEntityDispenser (and dropper), TileEntityHopper, TileEntityBrewingStand and TileEntityEnderChest.isUseableByPlayer (aow / apg / apb / api /
// aov / ape.a(yz)Z, bytecode-read) all begin `world.getTileEntity(x, y, z) != this -> false`, and EntityPlayer.onUpdate (yz.h) closes the
// screen when the open container's canInteractWith fails. A /setblock over the block (even the same block with another metadata: Chunk.func_150807_a
// runs breakBlock, which removes the tile) leaves a new tile at the cell, so the screen closes; the block-id checks in main.js tickChests did not see it.
// The port's tiles are the plain records of the survival stores, so "the same tile" is the same record object.
import { isSign } from "./signs.js";
import { isChestBlock } from "./chest-blocks.js";
import { settleFacing } from "./chest.js";
import { opaqueCube } from "./world.js";

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

// b89 tiles89: the tile side of World.setBlock shared by both hosts (moved here from multiplayer/server-tile-swaps.js, which re-exports it).
// Chunk.func_150807_a (apx.a(IIILaji;I)Z, bytecode-read) returns early only when the block and the metadata are both unchanged; otherwise, on the
// server (single player is an integrated server), it runs the old block's breakBlock for any change (aji.a(Lahb;IIILaji;I)V, no id test), then the new
// block's onBlockAdded (aji.b(Lahb;III)V, also with no id test) and makes a fresh tile (akw.a) when the new block is a container that has none.
//  * BlockChest.breakBlock (ajx.a) spills every slot, then BlockContainer.breakBlock (ajc.a) removes the tile: a chest swapped for a trapped chest
//    (or back) loses its contents to the ground and the new block starts empty. The end-of-tick / per-tick reaps keep the record (isChestBlock is
//    true for both kinds), so this hook does it.
//  * BlockSign has no breakBlock of its own (BlockContainer's removes the tile): a sign rewritten with another metadata only starts a fresh, empty
//    TileEntitySign. An id change (standing <-> wall) is the hosts' own onChange / put line.
// Same-id metadata writes of a chest are not here: the port keeps the chest facing in the record (the cell meta stays 0), and the facing writes it
// makes (settleFacing, placeChest) are setBlockMetadataWithNotify natively (Chunk.setBlockMetadata, no breakBlock). /setblock compares the facing
// itself (command-host.js).
// `ctx`: { signs (Signs), containers: { swapChest(x, y, z) }, own() -> the stores are the ones of this world (a server dimension's swap) }.
export function swapTiles(ctx, x, y, z, old, oldMeta, b, m) {
  if (old === b ? oldMeta === m : !(isSign(old) && isSign(b)) && !(isChestBlock(old) && isChestBlock(b))) return;
  if (ctx.own && !ctx.own()) return;
  if (isSign(old) && old === b && ctx.signs) { ctx.signs.remove(x, y, z); ctx.signs.create(x, y, z); }
  if (isChestBlock(old) && isChestBlock(b) && old !== b) ctx.containers?.swapChest(x, y, z);
}
// Wraps world.put (below every world.set, LiveRedstone's funnel included) with swapTiles. Only a sign or chest written over the cell can need it,
// so other writes pass straight through without the extra reads.
export function installTileSwaps(world, ctx) {
  const put = world.put;
  world.put = (x, y, z, b, m, track) => {
    if (!isSign(b) && !isChestBlock(b)) return put.call(world, x, y, z, b, m, track);
    const old = world.get(x, y, z), oldMeta = world.getMeta(x, y, z), result = put.call(world, x, y, z, b, m, track);
    if (result) swapTiles(ctx, x, y, z, old, oldMeta, b, m ?? 0);
    return result;
  };
  return world;
}
// The record side of a chest kind swap in a host whose records live in one plain store (single player's survival.chests, the away run's tiles.chests):
// BlockChest.breakBlock spills the slots (`spill(stacks)`) and removes the tile, then BlockChest.onBlockAdded (ajx.b, bytecode-read: func_149954_e on
// the cell, then on each side neighbour of the same block) settles the new block's facing on its fresh, empty tile.
export function swapChestRecord(world, chests, x, y, z, spill) {
  const key = `${x},${y},${z}`, gone = chests[key];
  if (gone) { delete chests[key]; spill((gone.items ?? []).filter(Boolean)); }
  const kind = world.get(x, y, z);
  settleFacing(world, chests, x, y, z, kind);
  for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) if (world.get(x + dx, y, z + dz) === kind) settleFacing(world, chests, x + dx, y, z + dz, kind);
  return gone ?? null;
}
// BlockFurnace.onBlockAdded -> func_149930_e (ale.e, bytecode-read): the new furnace faces away from an opaque side, whatever metadata setBlock
// wrote (setBlockMetadataWithNotify, flags 2); 3 when no side decides. The port keeps the furnace facing in the cell metadata (2-5).
export function furnaceAddedFacing(world, x, y, z) {
  const o = (dx, dz) => opaqueCube(world.get(x + dx, y, z + dz)), n = o(0, -1), s = o(0, 1), w = o(-1, 0), e = o(1, 0);
  let facing = 3;
  if (n && !s) facing = 3;
  if (s && !n) facing = 2;
  if (w && !e) facing = 5;
  if (e && !w) facing = 4;
  return facing;
}
