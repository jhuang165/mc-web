// EntityFallingBlock landing: TileEntityData goes into the placed tile entity (b77 fallingblock77).
// Bytecode-read xj.h: after ahb.d(x, y, z, block, data, 3) succeeds and BlockFalling.onFinishFalling ran, a block that is an ITileEntityProvider with a tile entity at the
// cell gets its own NBT (tile.writeToNBT) overlaid with every key of TileEntityData except x, y and z, then readFromNBT(merged) and markDirty. The tile entity class comes
// from the landed block, so the saved "id" only matters when it matches; a block with no tile entity (sand, stone) ignores the data.
// The port keeps tile entities in the stores below; this reads the same fields the region importer reads (region-import.js readContainerTile, TileEntitySign).
import { NBT } from './nbt.js';
import { toOriginal } from './block-registry.js';
import { compoundFromJson } from './spawner-data.js';
import { readContainerTile } from './region-import.js';
import { nbtGet } from './nbt-get.js';

// original block id -> the TileEntity class the block creates (the id the importer reads).
const TILE_OF_BLOCK = Object.freeze({ 54: 'Chest', 146: 'Chest', 61: 'Furnace', 62: 'Furnace', 23: 'Trap', 158: 'Dropper', 154: 'Hopper', 117: 'Cauldron', 63: 'Sign', 68: 'Sign' });
export const fallingTileKind = (block, meta = 0) => TILE_OF_BLOCK[toOriginal(block, meta & 15)?.[0]] ?? null;

// `host`: { survival (chests, furnaces, dispensers, hoppers, brewing), signs (Signs) }. Returns true when a tile entity took the data.
export function applyFallingTileData({ block, x, y, z, data, dataByte = 0, host }) {
  const kind = fallingTileKind(block, dataByte);
  if (!kind || !data) return false;
  const tag = compoundFromJson(data), key = `${x},${y},${z}`, s = host.survival;
  if (kind === 'Sign') {
    if (!host.signs) return false;
    const tile = host.signs.tile(x, y, z) ?? host.signs.create(x, y, z);
    // TileEntitySign.readFromNBT: Text1-Text4 cut to 15 characters, not editable.
    tile.text = tile.text.map((old, i) => (tag.has(`Text${i + 1}`) ? String(nbtGet(tag, `Text${i + 1}`, NBT.STRING, '')).slice(0, 15) : old));
    tile.editable = false;
    return true;
  }
  const loaded = readContainerTile(kind, tag);
  if (!loaded || !s) return false;
  const store = (s[loaded.name] ??= {}), old = store[key];
  const fresh = loaded.name === 'chests' ? { facing: (dataByte & 15) >= 2 && (dataByte & 15) <= 5 ? dataByte & 15 : 3 } : loaded.name === 'furnaces' ? { burn: 0, burnTotal: 0, cook: 0 } : {};
  store[key] = { ...fresh, ...old, ...loaded.record };
  if (loaded.name === 'furnaces') store[key].lit = toOriginal(block, dataByte & 15)?.[0] === 62;
  return true;
}
