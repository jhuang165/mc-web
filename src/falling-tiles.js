// EntityFallingBlock landing: TileEntityData goes into the placed tile entity (b77 fallingblock77).
// Bytecode-read xj.h: after ahb.d(x, y, z, block, data, 3) succeeds and BlockFalling.onFinishFalling ran, a block that is an ITileEntityProvider with a tile entity at the
// cell gets its own NBT (tile.writeToNBT) overlaid with every key of TileEntityData except x, y and z, then readFromNBT(merged) and markDirty. The tile entity class comes
// from the landed block, so the saved "id" only matters when it matches; a block with no tile entity (sand, stone) ignores the data.
// Every kind merges like native: the placed tile's own state is written, the data keys (never x, y, z) replace its entries, and the tile reads the merged compound back.
// The port keeps tile entities in the stores below; this reads the same fields the region importer reads (region-import.js readContainerTile, TileEntitySign).
import { NBT } from './nbt.js';
import { toOriginal } from './block-registry.js';
import { compoundFromJson } from './spawner-data.js';
import { readContainerTile } from './region-import.js';
import { nbtGet, hasNumber } from './nbt-get.js';
import { readNBT as readSpawner, spawnerJSON, makeSpawner } from './mob-spawner.js';
import { writeCommandBlock, readCommandBlock } from './command-block.js';
import { LastOutputError } from './chat-component.js';
import { writeNoteTile, readNoteTile } from './note-blocks.js';
import { writeJukeboxTile, readJukeboxTile } from './jukebox.js';
import { isDisc, canonicalDisc } from './note-jukebox-content.js';
import { profileOfSkullTile, skullOwnerEntry } from './skull-profile.js';
import { potNbtOf, potFromNbt, potContents, setPotContents } from './stone-utility.js';

// original block id -> the TileEntity class the block creates (the id the importer reads).
const TILE_OF_BLOCK = Object.freeze({ 54: 'Chest', 146: 'Chest', 61: 'Furnace', 62: 'Furnace', 23: 'Trap', 158: 'Dropper', 154: 'Hopper', 117: 'Cauldron', 63: 'Sign', 68: 'Sign',
  52: 'MobSpawner', 144: 'Skull', 140: 'FlowerPot', 137: 'Control', 25: 'Music', 84: 'RecordPlayer', 138: 'Beacon', 149: 'Comparator', 150: 'Comparator' });
export const fallingTileKind = (block, meta = 0) => TILE_OF_BLOCK[toOriginal(block, meta & 15)?.[0]] ?? null;

const entry = (type, value) => ({ type, value });
// The merged compound: `base` (the tile's writeToNBT entries) with every key of the data except x, y and z laid over it.
const overlay = (base, tag) => { const merged = new Map(base); for (const [k, v] of tag) if (k !== 'x' && k !== 'y' && k !== 'z') merged.set(k, v); return merged; };
const SPAWNER_GATES = new Set(['MinSpawnDelay', 'MaxNearbyEntities', 'SpawnRange']);
const OTHER = {
  // MobSpawnerBaseLogic.readFromNBT over the merged compound (EntityId and Delay always; Min/MaxSpawnDelay, SpawnCount behind MinSpawnDelay; MaxNearbyEntities with RequiredPlayerRange; SpawnRange).
  MobSpawner({ tag, x, y, z, host }) {
    if (!host.spawners) return false;
    const spawner = host.spawners.get(x, y, z) ?? host.spawners.add({ x, y, z });
    if (!spawner) return false;
    const t = spawnerJSON(spawner);
    for (const [k, v] of tag) {
      if (k === 'x' || k === 'y' || k === 'z') continue;
      if (k === 'EntityId') t.EntityId = v.type === NBT.STRING ? v.value : '';
      else if (k === 'SpawnData') { if (v.type === NBT.COMPOUND) t.SpawnData = v.value; else delete t.SpawnData; }
      else if (k === 'SpawnPotentials') { if (v.type === NBT.LIST) t.SpawnPotentials = v.value.elementType === NBT.COMPOUND ? v.value.items : []; else delete t.SpawnPotentials; }
      else if (k in t) { if (hasNumber(tag, k)) t[k] = nbtGet(tag, k, NBT.SHORT, 0); else if (!SPAWNER_GATES.has(k)) t[k] = 0; }
    }
    readSpawner(spawner, t);
    return true;
  },
  // TileEntitySkull.readFromNBT: SkullType and Rot bytes, then the Owner compound or ExtraType name of a player head.
  Skull({ tag, x, y, z, host }) {
    if (!host.skulls) return false;
    const old = host.skulls.tile(x, y, z), base = new Map([['SkullType', entry(NBT.BYTE, old?.type ?? 0)], ['Rot', entry(NBT.BYTE, old?.rot ?? 0)]]);
    const owner = skullOwnerEntry(old);
    if (owner) base.set('Owner', owner);
    const merged = overlay(base, tag);
    host.skulls.create(x, y, z, Math.max(0, Math.min(4, nbtGet(merged, 'SkullType', NBT.BYTE, 0))), nbtGet(merged, 'Rot', NBT.BYTE, 0) & 15, '', profileOfSkullTile(merged));
    return true;
  },
  // TileEntityFlowerPot.readFromNBT: Item and Data ints; a plant the port cannot draw leaves the pot empty.
  FlowerPot({ tag, x, y, z, host }) {
    if (!host.world) return false;
    const old = potNbtOf(potContents(host.world, x, y, z)), merged = overlay(new Map([['Item', entry(NBT.INT, old.Item)], ['Data', entry(NBT.INT, old.Data)]]), tag);
    setPotContents(host.world, x, y, z, potFromNbt({ Item: nbtGet(merged, 'Item', NBT.INT, 0), Data: nbtGet(merged, 'Data', NBT.INT, 0) }));
    return true;
  },
  // TileEntityCommandBlock.readFromNBT; an invalid LastOutput throws natively (the tile does not load), so nothing is applied here.
  Control({ tag, x, y, z, host }) {
    const tile = host.commandBlocks?.tile(x, y, z);
    if (!tile) return false;
    try { Object.assign(tile, readCommandBlock(overlay(writeCommandBlock(tile, x, y, z), tag))); } catch (e) { if (e instanceof LastOutputError) return false; throw e; }
    return true;
  },
  // TileEntityNote.readFromNBT: the note byte, clamped to 0-24.
  Music({ tag, x, y, z, host }) {
    const tile = host.music?.noteBlocks.tile(x, y, z);
    if (!tile) return false;
    tile.note = readNoteTile(overlay(writeNoteTile(tile, x, y, z), tag)).note;
    return true;
  },
  // TileEntityJukebox.readFromNBT: RecordItem, else a legacy Record id; the port's jukebox holds discs only.
  RecordPlayer({ tag, x, y, z, host }) {
    const tile = host.music?.jukeboxes.tile(x, y, z);
    if (!tile) return false;
    const { record } = readJukeboxTile(overlay(writeJukeboxTile(tile, x, y, z), tag));
    tile.record = record && isDisc(record.id) ? { id: canonicalDisc(record.id), count: 1, damage: 0 } : null;
    return true;
  },
  // TileEntityBeacon.readFromNBT: Primary, Secondary and Levels ints.
  Beacon({ tag, x, y, z, host }) {
    if (!host.beacons) return false;
    const tile = host.beacons.ensure(x, y, z);
    if (tag.has('Primary')) tile.primary = nbtGet(tag, 'Primary', NBT.INT, 0);
    if (tag.has('Secondary')) tile.secondary = nbtGet(tag, 'Secondary', NBT.INT, 0);
    if (tag.has('Levels')) tile.levels = nbtGet(tag, 'Levels', NBT.INT, 0);
    return true;
  },
  // TileEntityComparator.readFromNBT: OutputSignal (getInteger), any value kept.
  Comparator({ tag, key, host }) {
    if (!host.comparators) return false;
    const tile = host.comparators.get(key) ?? (host.comparators.set(key, { signal: 0 }), host.comparators.get(key));
    if (tag.has('OutputSignal')) tile.signal = nbtGet(tag, 'OutputSignal', NBT.INT, 0);
    return true;
  },
};

// `host`: { survival (chests, furnaces, dispensers, hoppers, brewing), signs (Signs), spawners (MobSpawners), skulls (Skulls), beacons (Beacons), world (flower pots), commandBlocks, music ({ noteBlocks, jukeboxes }), comparators (LiveRedstone tiles) }; a store the host lacks leaves the data unapplied. Returns true when a tile entity took the data.
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
  if (OTHER[kind]) return OTHER[kind]({ tag, x, y, z, key, host, block, dataByte });
  const loaded = readContainerTile(kind, tag);
  if (!loaded || !s) return false;
  const store = (s[loaded.name] ??= {}), old = store[key];
  const fresh = loaded.name === 'chests' ? { facing: (dataByte & 15) >= 2 && (dataByte & 15) <= 5 ? dataByte & 15 : 3 } : loaded.name === 'furnaces' ? { burn: 0, burnTotal: 0, cook: 0 } : {};
  store[key] = { ...fresh, ...old, ...loaded.record };
  if (loaded.name === 'furnaces') store[key].lit = toOriginal(block, dataByte & 15)?.[0] === 62;
  return true;
}
