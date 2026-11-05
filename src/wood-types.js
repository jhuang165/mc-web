// Wood-type metadata helpers (1.7.10): BlockLog/BlockNewLog orientation, and the damage an item picked from a block carries.
// Browser ids: 4 log (oak, spruce, birch, jungle), 70 log2 (acacia, dark oak), 5 leaves, 71 leaves2, 7 planks, 48 sapling.

// BlockRotatedPillar.func_149660_a (ang.a(World, x, y, z, side, hitX, hitY, hitZ, meta), used by BlockLog and BlockNewLog): the
// wood type is meta & 3 and the axis bits come from the clicked side: up/down 0 (Y), north/south 8 (Z), west/east 4 (X).
export const logPlacedMeta = (damage, side) => (damage & 3) | (side === 2 || side === 3 ? 8 : side === 4 || side === 5 ? 4 : 0);

// Block.func_149643_k (getDamageValue, what Creative middle-click copies): logs and leaves meta & 3 (BlockLog, BlockLeaves),
// planks the whole metadata, saplings meta & 7 (BlockSapling.damageDropped); null for other blocks.
export function treePickDamage(itemId, meta) {
  if (itemId === 4 || itemId === 70 || itemId === 5 || itemId === 71) return meta & 3;
  if (itemId === 7) return meta & 7;
  if (itemId === 48) return meta & 7;
  return null;
}
