// XPOrb, PrimedTnt and FallingSand entities of a Java 1.7.10 chunk -> the browser's saved `xpOrbs`, `tnt` and `falling` records (b75 entityaudit75).
// Before this the region importer counted all three as lost entities, although the exporter (region-export.js) writes them. The reads follow
// EntityXPOrb, EntityTNTPrimed and EntityFallingBlock.readEntityFromNBT (object-nbt-reference.json, tools/probes/ObjectNbtProbe.java: Health and Value are
// shorts, Fuse a byte, TileID/Tile/Data/Time/HurtEntities/FallHurtAmount/FallHurtMax) after Entity.readFromNBT (Pos, Motion beyond 10 zeroed, OnGround, FallDistance, Fire).
import { NBT } from './nbt.js';
import { nbtGet, hasNumber } from './nbt-get.js';
import { fromOriginal } from './block-registry.js';
import { TNT_Y_OFFSET } from './explosion.js';
import { FALLING_Y_OFFSET, isFallingBlock } from './falling.js';

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
    // Health, Age and Value are getShort; the orb masks Health with 255. The browser keeps a positive value up to 2477 only (ExperienceOrbs).
    const value = nbtGet(entity, 'Value', NBT.SHORT, 0);
    if (!(value > 0 && value <= 2477)) return { lost: 'value outside 1-2477' };
    const health = nbtGet(entity, 'Health', NBT.SHORT, 0) & 255;
    if (health <= 0) return { lost: 'no health' };
    const age = nbtGet(entity, 'Age', NBT.SHORT, 0);
    if (age < 0 || age >= 6000) return { lost: 'expired' };
    const fire = nbtGet(entity, 'Fire', NBT.SHORT, 0);
    return { list, record: { x, y: pos[1] - ORB_HALF, z, value, age, health, fire, vx, vy, vz, onGround } };
  }
  if (id === 'PrimedTnt') return { list, record: { x, y: pos[1] - TNT_Y_OFFSET, z, vx, vy, vz, fuse: nbtGet(entity, 'Fuse', NBT.BYTE, 0) } };
  // EntityFallingBlock.readEntityFromNBT: TileID (any numeric) wins, else Tile & 255; Data; Time.
  const original = hasNumber(entity, 'TileID') ? nbtGet(entity, 'TileID', NBT.INT, 0) : nbtGet(entity, 'Tile', NBT.BYTE, 0) & 255;
  const cell = fallingCellOf(original, nbtGet(entity, 'Data', NBT.BYTE, 0));
  if (!cell || !isFallingBlock(cell.id)) return { lost: 'not a falling block' };
  const record = { block: cell.id, meta: cell.meta ?? 0, x, y: pos[1] - FALLING_Y_OFFSET, z, vx, vy, vz, ticks: Math.max(1, nbtGet(entity, 'Time', NBT.BYTE, 0) & 255), onGround, fallDistance };
  if (hasNumber(entity, 'HurtEntities')) Object.assign(record, { hurtEntities: nbtGet(entity, 'HurtEntities', NBT.BYTE, 0) !== 0, fallHurtAmount: nbtGet(entity, 'FallHurtAmount', NBT.FLOAT, 0), fallHurtMax: nbtGet(entity, 'FallHurtMax', NBT.INT, 0) });
  return { list, record };
}
