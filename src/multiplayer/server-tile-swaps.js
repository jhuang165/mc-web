// b88 tiles88: the tile entity side of World.setBlock on the server that the end-of-tick reap (DedicatedSimulation.dropTiles) cannot see,
// because the cell still holds a block of the same tile kind afterwards. Chunk.func_150807_a (apx.a(IIILaji;I)Z, bytecode-read) returns
// early only when the block and the metadata are both unchanged; otherwise, on the server, it runs the old block's breakBlock for any change
// (aji.a(Lahb;IIILaji;I)V, no id test), and makes a fresh tile (akw.a(ahb,I), ahb.a(IIILaor;)V) when the new block is a container that has none.
//  * BlockChest.breakBlock (ajx.a) spills every slot (the 10-30 pieces of ItemEntities.spill), then BlockContainer.breakBlock (ajc.a) removes
//    the tile: a chest swapped for a trapped chest (54 <-> 146) loses its contents to the ground and the new block starts empty. The reap kept them
//    (isChestBlock is true for both kinds).
//  * BlockSign has no breakBlock of its own (BlockContainer's removes the tile): a sign rewritten with another metadata only (a standing sign's
//    rotation, a wall sign's facing) starts a fresh, empty TileEntitySign. The put wrappers cleared it only on an id change (b87 tiles87).
// `ctx`: { signs (Signs), containers (ServerContainers), own() -> the dimension's stores are the ones `sim` holds now (no other dimension's swap) }.
import { isSign } from '../signs.js';
import { isChestBlock } from '../chest-blocks.js';

export function swapTiles(ctx, x, y, z, old, oldMeta, b, m) {
  if (old === b ? oldMeta === m : !(isSign(old) && isSign(b)) && !(isChestBlock(old) && isChestBlock(b))) return;
  if (!ctx.own()) return;
  if (isSign(old) && old === b && ctx.signs) { ctx.signs.remove(x, y, z); ctx.signs.create(x, y, z); }
  if (isChestBlock(old) && isChestBlock(b) && old !== b) ctx.containers?.swapChest(x, y, z);
}
