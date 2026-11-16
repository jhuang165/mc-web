// EntityFallingBlock drop and tile helpers (b77 fallingblock77).
// Native xj.h drops `new ItemStack(block, 1, block.damageDropped(meta))` through entityDropItem when a falling block times out or cannot land
// (Bytecode-read xj.h; Entity.entityDropItem gives nothing for an ItemStack whose item is null, Bytecode-read sa.a(add, F)). Block.damageDropped takes the whole
// Data int (0-255 of a foreign save), so the formulas below are written for 0-255. Every row is replayed against public/research/falling-block77-reference.json
// (tools/probes/FallingBlock77Probe.java: aji.a(meta) for the 175 registered blocks, meta 0..255, and adb.a(block) for the item).
import { toOriginal } from './block-registry.js';
import { itemForBlock } from './dispenser-piston.js';
import { itemOfBlock2 } from './redstone-blocks-2.js';
import { blockItemId } from './doors-panes.js';

// Original block id -> damageDropped(meta); every other block drops damage 0.
export const DAMAGE_DROPPED = Object.freeze({
  5: (m) => m, 6: (m) => Math.min(m & 7, 5), 12: (m) => m, 17: (m) => m & 3, 18: (m) => m & 3, 21: () => 4, 24: (m) => m, 35: (m) => m, 37: (m) => m, 38: (m) => m,
  43: (m) => m & 7, 44: (m) => m & 7, 95: (m) => m, 98: (m) => m, 125: (m) => m & 7, 126: (m) => m & 7, 139: (m) => m, 144: (m) => m,
  145: (m) => m >> 2, // BlockAnvil.damageDropped: the damage stage, from the whole int
  155: (m) => (m === 3 || m === 4 ? 2 : m), 159: (m) => m, 160: (m) => m, 161: (m) => (m & 3) + 4, 162: (m) => m & 3, 170: (m) => m & 3, 171: (m) => m,
  175: (m) => ((m & 8) === 0 ? m & 7 : 0), // BlockDoublePlant: the upper half (bit 3) drops damage 0
});
// Original blocks whose Item.getItemFromBlock is null: their ItemStack drops nothing.
export const NO_BLOCK_ITEM = Object.freeze(new Set([26, 34, 36, 55, 59, 63, 64, 68, 71, 74, 75, 83, 92, 93, 94, 104, 105, 115, 117, 118, 124, 132, 140, 144, 149, 150, 165, 166, 167, 168, 169]));
export const damageDropped = (original, data) => (DAMAGE_DROPPED[original]?.(data) ?? 0);

// The whole Data byte of a falling record: the saved byte the port cell cannot hold, else the high nibble kept at import plus the original low nibble of the port cell (the export's formula).
export function fallingData(e) {
  if (Number.isInteger(e.data)) return e.data & 255;
  const o = toOriginal(e.block, e.meta & 15);
  return ((e.meta & 240) | ((o?.[1] ?? e.meta) & 15)) & 255;
}
// The ItemStack of the drop, or null (a block without an item, or an unknown cell).
export function fallingDropStack(e) {
  const o = toOriginal(e.block, e.meta & 15);
  if (!o) return null;
  if (NO_BLOCK_ITEM.has(o[0])) return null;
  const id = itemForBlock(e.block) || itemOfBlock2(e.block) || blockItemId(e.block);
  return { id, count: 1, damage: damageDropped(o[0], fallingData(e)) };
}
