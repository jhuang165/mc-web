// XPOrb, PrimedTnt and FallingSand entities of a Java 1.7.10 chunk -> the browser's saved `xpOrbs`, `tnt` and `falling` records (b75 entityaudit75).
// Before this the region importer counted all three as lost entities, although the exporter (region-export.js) writes them. The reads follow
// EntityXPOrb, EntityTNTPrimed and EntityFallingBlock.readEntityFromNBT (object-nbt-reference.json, tools/probes/ObjectNbtProbe.java: Health and Value are
// shorts, Fuse a byte, TileID/Tile/Data/Time/HurtEntities/FallHurtAmount/FallHurtMax) after Entity.readFromNBT (Pos, Motion beyond 10 zeroed, OnGround, FallDistance, Fire).
import { NBT } from './nbt.js';
import { uuidFields } from './entity-uuid.js';
import { nbtGet, hasNumber } from './nbt-get.js';
import { fromOriginal } from './block-registry.js';
import { TNT_Y_OFFSET } from './explosion.js';
import { FALLING_Y_OFFSET } from './falling.js';
import { nbtToJson } from './spawner-data.js';

export const JAVA_OBJECTS = Object.freeze({ XPOrb: 'xpOrbs', PrimedTnt: 'tnt', FallingSand: 'falling' });
export const IMPORT_OBJECT_LIMIT = { xpOrbs: 512, tnt: 1024, falling: 1024 }; // ExperienceOrbs keeps 512
const ORB_HALF = Math.fround(0.25); // EntityXPOrb yOffset (height 0.5)

const numbers = (map, key, type, n) => {
  const list = nbtGet(map, key, NBT.LIST);
  return list?.elementType === type && list.items.length === n && list.items.every(Number.isFinite) ? list.items : null;
};

// EntityFallingBlock.readEntityFromNBT: Block.getBlockById (air for an unregistered id) and then "air becomes sand" (object-nbt-reference.json: TileID 0, 4000 and
// neither key all load as TileID 12). A block that does not fall (stone) is kept natively; the browser's falling list holds the four falling blocks only.
export function fallingCellOf(original, data) {
  const cell = fromOriginal(original, data & 15);
  return cell && cell.id !== 0 ? cell : fromOriginal(12, data & 15);
}
// EntityFallingBlock keeps Data as a whole byte (Data & 255, object-nbt-reference.json: Data 31 saves back as 31); only the landing setBlock stores the low nibble
// (falling.js). The port cell's metadata replaces the low 4 bits, the upper four stay as saved.
export const fallingMetaOf = (cell, data) => ((data & 240) | ((cell.meta ?? 0) & 15)) & 255;
// A block the port holds without that Data (stone with Data 15 is port stone, metadata 0) keeps the saved byte as `data`, which the export writes back.
export const fallingDataExtra = (cell, data) => (fallingMetaOf(cell, data) === data ? {} : { data });

// EntityFallingBlock.readEntityFromNBT keeps TileEntityData when the tag is a compound (Bytecode-read xj.a(dh): dh.b(key, 10) then dh.m). The record holds it as an
// nbtToJson tree (JSON-safe, typed); landing copies it into the placed tile entity (falling-tiles.js) and the export writes it back whole.
export const fallingTileDataOf = (entity) => {
  const tag = entity.get('TileEntityData');
  return tag?.type === NBT.COMPOUND ? nbtToJson(tag) : null;
};

// EntityEnderCrystal (a plain Entity, not an EntityLivingBase): readEntityFromNBT and writeEntityToNBT are empty (Bytecode-read wz.a(dh), wz.b(dh); an
// executed load drops Foo, Health and Attributes alike, object-nbt-reference.json crystal rows), so the tag is Entity.readFromNBT only: Pos, Rotation, Fire
// (short, 0 when absent: a crystal is not a mob's -1) and Invulnerable, which wz.a(ro, F) checks first (Bytecode-read: aw() returns false). Health is 5 at construction and never saved.
// The record joins the browser's mob list because that is where the port keeps crystals (entities.js), but none of the mob readers run: no Health/HealF,
// effects, gear, leash, custom name or attributes.
export function javaCrystalFromNbt(entity, { shiftX = 0, shiftZ = 0 } = {}) {
  const pos = numbers(entity, 'Pos', NBT.DOUBLE, 3);
  if (!pos) return null;
  const rotation = numbers(entity, 'Rotation', NBT.FLOAT, 2);
  const record = { type: 'ender_crystal', x: pos[0] + shiftX, y: pos[1], z: pos[2] + shiftZ, health: 5, yaw: rotation ? -rotation[0] * Math.PI / 180 : 0,
    fire: Math.max(-1, nbtGet(entity, 'Fire', NBT.SHORT, 0)), effects: [] };
  if (nbtGet(entity, 'Invulnerable', NBT.BYTE, 0) !== 0) record.invulnerable = true;
  Object.assign(record, uuidFields(entity));
  return record;
}

// Returns { list, record } or { lost } (the importer tallies `${id} (reason)`).
export function javaObjectFromNbt(entity, { shiftX = 0, shiftZ = 0 } = {}) {
  const id = nbtGet(entity, 'id', NBT.STRING, ''), list = JAVA_OBJECTS[id], pos = numbers(entity, 'Pos', NBT.DOUBLE, 3);
  if (!list || !pos) return { lost: 'unusable' };
  const x = pos[0] + shiftX, z = pos[2] + shiftZ;
  // Entity.readFromNBT zeroes a motion component beyond 10.
  const [vx, vy, vz] = (numbers(entity, 'Motion', NBT.DOUBLE, 3) ?? [0, 0, 0]).map((v) => (Math.abs(v) > 10 ? 0 : v));
  const onGround = nbtGet(entity, 'OnGround', NBT.BYTE, 0) !== 0;
  const fallDistance = Math.max(0, nbtGet(entity, 'FallDistance', NBT.FLOAT, 0));
  if (id === 'XPOrb') {
    // Health, Age and Value are getShort; the orb masks Health with 255. Native keeps every Value (0 and above 2477 too: Executed, object-nbt-reference.json
    // XPOrb Value 0 and Health 0 rows load and save back unchanged) and a Health 0 orb until it is hit; only an Age of 6000 or more ends on the first tick.
    const value = nbtGet(entity, 'Value', NBT.SHORT, 0);
    const health = nbtGet(entity, 'Health', NBT.SHORT, 0) & 255;
    const age = nbtGet(entity, 'Age', NBT.SHORT, 0);
    if (age >= 6000) return { lost: 'expired' };
    const fire = nbtGet(entity, 'Fire', NBT.SHORT, 0);
    return { list, record: { x, y: pos[1] - ORB_HALF, z, value, age, health, fire, vx, vy, vz, onGround } };
  }
  if (id === 'PrimedTnt') return { list, record: { x, y: pos[1] - TNT_Y_OFFSET, z, vx, vy, vz, fuse: nbtGet(entity, 'Fuse', NBT.BYTE, 0), fire: nbtGet(entity, 'Fire', NBT.SHORT, 0) } }; // b82 fireext82: Entity's Fire (moveEntity's counter)
  // EntityFallingBlock.readEntityFromNBT: TileID (any numeric) wins, else Tile & 255; Data; Time.
  const original = hasNumber(entity, 'TileID') ? nbtGet(entity, 'TileID', NBT.INT, 0) : nbtGet(entity, 'Tile', NBT.BYTE, 0) & 255;
  const data = nbtGet(entity, 'Data', NBT.BYTE, 0) & 255, cell = fallingCellOf(original, data);
  if (!cell) return { lost: 'unregistered block' };
  // Any block is kept (Executed: TileID 1 loads as Tile 1; the landing places it like sand). Time is Time & 255 and may be 0: the first tick then checks the
  // block still stands at the entity's cell (Bytecode-read xj.h) instead of being skipped. DropItem is read when present (default true).
  const record = { block: cell.id, meta: fallingMetaOf(cell, data), x, y: pos[1] - FALLING_Y_OFFSET, z, vx, vy, vz, ticks: nbtGet(entity, 'Time', NBT.BYTE, 0) & 255, onGround, fallDistance };
  Object.assign(record, fallingDataExtra(cell, data));
  if (cell.state?.flowing) record.flowing = true; // b79 falling79: Tile 8/10 (flowing water/lava) share the still port block; the export and drop read this back
  if (hasNumber(entity, 'DropItem')) record.dropItem = nbtGet(entity, 'DropItem', NBT.BYTE, 0) !== 0;
  if (hasNumber(entity, 'HurtEntities')) Object.assign(record, { hurtEntities: nbtGet(entity, 'HurtEntities', NBT.BYTE, 0) !== 0, fallHurtAmount: nbtGet(entity, 'FallHurtAmount', NBT.FLOAT, 0), fallHurtMax: nbtGet(entity, 'FallHurtMax', NBT.INT, 0) });
  const tileData = fallingTileDataOf(entity);
  if (tileData) record.tileData = tileData;
  return { list, record };
}
