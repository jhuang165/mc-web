// b83 plants83: the data tag of /setblock for the tile entities command-host.js does not read itself (flower pot, sign, note block, jukebox,
// comparator). CommandSetBlock (bm.b, bytecode-read in the 1.7.10 jar) parses the tag only for a block with a tile entity (aji.u), runs
// World.setBlock(x, y, z, block, meta, 3) and, when the tag was given and getTileEntity is non-null, puts x/y/z ints into the tag and calls
// tile.readFromNBT(tag). The tile is a fresh one: World.setBlock runs the old block's breakBlock on the server (BlockContainer removes the tile) and the
// new block's createNewTileEntity makes another, so a key missing from the tag reads its default (getInteger 0, getString "") instead of keeping
// the old tile's value. This is not the falling-block merge of falling-tiles.js.
// `stores`: { world (flower pots, world.pots), signs (Signs), music ({ noteBlocks, jukeboxes }), comparators (the redstone tile Map) }; a store
// the host lacks leaves the tag unread. Returns the tag keys the port keeps no state for, or null when this module does not read `original`.
import { NBT } from './nbt.js';
import { nbtGet } from './nbt-get.js';
import { getStringAny } from './nbt-string.js';
import { readNoteTile } from './note-blocks.js';
import { readJukeboxTile } from './jukebox.js';
import { isDisc, canonicalDisc } from './note-jukebox-content.js';
import { potFromNbt, setPotContents, EMPTY_POT } from './stone-utility.js';
import { itemFromOriginal } from './region-import.js';

// TileEntity.readFromNBT reads x, y and z (CommandSetBlock has just set them to the cell); "id" is only read by TileEntity.createAndLoadEntity.
const BASE = ['x', 'y', 'z', 'id'];
const rest = (tag, keys) => [...tag.keys()].filter((k) => !BASE.includes(k) && !keys.includes(k));

const READERS = {
  // TileEntityFlowerPot.readFromNBT: Item = Item.getItemById(getInteger("Item")), Data = getInteger("Data") (stone-utility.js potFromNbt keeps a
  // registered item the port does not draw). An item id that names no item (0 or unregistered) leaves the pot empty.
  140({ tag, x, y, z, stores }) {
    if (!stores.world) return null;
    setPotContents(stores.world, x, y, z, potFromNbt({ Item: nbtGet(tag, 'Item', NBT.INT, 0), Data: nbtGet(tag, 'Data', NBT.INT, 0) }, itemFromOriginal) ?? EMPTY_POT); // b84 cmdfix84: an empty read is an empty tile, not the metadata's plant
    return rest(tag, ['Item', 'Data']);
  },
  // TileEntitySign.readFromNBT: not editable, then Text1-Text4 through getString (any tag reads as its toString, "" when missing), cut to 15 characters.
  63({ tag, x, y, z, stores }) {
    if (!stores.signs) return null;
    const tile = stores.signs.tile(x, y, z) ?? stores.signs.create(x, y, z);
    tile.text = [1, 2, 3, 4].map((i) => getStringAny(tag, `Text${i}`).slice(0, 15));
    tile.editable = false;
    return rest(tag, ['Text1', 'Text2', 'Text3', 'Text4']);
  },
  // TileEntityNote.readFromNBT: the note byte, clamped to 0-24 (note-blocks.js readNoteTile).
  25({ tag, x, y, z, stores }) {
    const tile = stores.music?.noteBlocks?.tile(x, y, z);
    if (!tile) return null;
    tile.note = readNoteTile(tag).note;
    return rest(tag, ['note']);
  },
  // TileEntityRecordPlayer.readFromNBT: a RecordItem compound, else the legacy Record int when > 0 (jukebox.js readJukeboxTile). The port's jukebox
  // holds discs only, so another item is reported as not kept. The record does not start playing (readFromNBT only sets the field).
  84({ tag, x, y, z, stores }) {
    const tile = stores.music?.jukeboxes?.tile(x, y, z);
    if (!tile) return null;
    const { record } = readJukeboxTile(tag), disc = record && isDisc(record.id);
    tile.record = disc ? { id: canonicalDisc(record.id), count: 1, damage: 0 } : null;
    const lost = !disc && (tag.has('RecordItem') || nbtGet(tag, 'Record', NBT.INT, 0) > 0) ? [tag.has('RecordItem') ? 'RecordItem' : 'Record'] : [];
    return [...rest(tag, ['RecordItem', 'Record']), ...lost];
  },
  // TileEntityComparator.readFromNBT: OutputSignal through getInteger (0 when missing), any value kept.
  149({ tag, x, y, z, stores }) {
    if (!stores.comparators) return null;
    const key = `${x},${y},${z}`, tile = stores.comparators.get(key) ?? (stores.comparators.set(key, { signal: 0 }), stores.comparators.get(key));
    tile.signal = nbtGet(tag, 'OutputSignal', NBT.INT, 0);
    return rest(tag, ['OutputSignal']);
  },
};
READERS[68] = READERS[63];
READERS[150] = READERS[149];

/** Read `tag` into the fresh tile of the original block `original` at x, y, z; the ignored keys, or null when not handled here. */
export function applySetblockTag(original, x, y, z, tag, stores = {}) {
  const read = READERS[original];
  return read && tag ? read({ tag, x, y, z, stores }) : null;
}
export const SETBLOCK_TAG_BLOCKS = Object.freeze(Object.keys(READERS).map(Number));
