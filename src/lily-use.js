// b84 mpplace84: ItemLilyPad.onItemRightClick (aej.a(add, ahb, yz), bytecode-read). Item.getMovingObjectPositionFromPlayer(world, player, true) traces 5 blocks
// stopping on source liquid; on a TILE hit: World.canMineBlock, EntityPlayer.canPlayerEdit, then only if the hit cell is Material.water with metadata 0 and the cell
// above is air: setBlock(x, y + 1, z, waterlily) and a stack decrement unless Creative. No sound, no use stat, no swing. Onto a block it is the ItemBlock onItemUse
// (placeHeldBlock, whose BlockLilyPad.canPlaceBlockAt needs a source water cell below the target cell), so a click on the lake bed is refused there ('lily-support')
// and the client sends C08 255, which reaches this method.
import { WATER, LILY_PAD } from './world.js';
import { traceBucket } from './buckets.js';

// BlockLilyPad.canPlaceBlockAt: the cell below is Material.water with metadata 0 (the build-height test is the caller's).
export const lilyCanStay = (world, x, y, z) => y >= 1 && y < 256 && world.get(x, y - 1, z) === WATER && world.getMeta(x, y - 1, z) === 0;

// The cell ItemLilyPad.onItemRightClick would place (b85 mppredict85: split out so the multiplayer client can run the same decision on its own world).
export function lilyPadCell(world, origin, dir, canEdit = () => true) {
  const hit = traceBucket(world, origin, dir, true);
  if (!hit || !canEdit(hit.block)) return null;
  const [x, y, z] = hit.block;
  if (world.get(x, y, z) !== WATER || world.getMeta(x, y, z) !== 0 || y + 1 >= 256 || world.get(x, y + 1, z) !== 0) return null;
  return [x, y + 1, z];
}

// `origin` / `dir` are arrays. `canEdit(block)` is the caller's World.canMineBlock. Returns the placed cell [x, y, z] or null.
export function useLilyPad(world, survival, origin, dir, canEdit = () => true) {
  const cell = lilyPadCell(world, origin, dir, canEdit);
  if (!cell) return null;
  world.set(cell[0], cell[1], cell[2], LILY_PAD, true, 0);
  if (!survival.creative) {
    const inv = survival.inventory, held = inv.held;
    if (--held.count <= 0) inv.main[inv.current] = null;
  }
  return cell;
}
