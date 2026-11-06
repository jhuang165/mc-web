// In-flight projectile entities <-> Java 1.7.10 chunk NBT (EntityList ids Snowball, ThrownEnderpearl, ThrownPotion, ThrownExpBottle, Arrow).
// Layouts and read-back come from public/research/projectile-nbt-reference.json (tools/probes/ProjectileNbtProbe.java, which writes each
// entity with Entity.writeToNBTOptional and reads it with EntityList.createEntityFromNBT); src/projectile-nbt.test.js replays them.
// Notes: public/research/projectile-nbt.md. Fireballs are not saved by the browser, and EntityEgg has no EntityList id (the native
// writeToNBTOptional returns false for it), so neither is converted.
import { NBT } from './nbt.js';
import { nbtGet } from './nbt-get.js';
import { fromOriginal, toOriginal } from './block-registry.js';

// EntityList id -> the browser list that holds the record ('projectiles' = Projectiles.serialize, 'arrows' = Arrows.serialize,
// 'thrownPotions' = WitchPotions.serialize, which also holds the player's potions and bottles o' enchanting).
export const JAVA_PROJECTILES = Object.freeze({ Snowball: 'projectiles', ThrownEnderpearl: 'projectiles', ThrownPotion: 'thrownPotions', ThrownExpBottle: 'thrownPotions', Arrow: 'arrows' });
export const IMPORT_PROJECTILE_LIMIT = { projectiles: 256, thrownPotions: 256, arrows: 300 }; // Arrows.load keeps 300
// EntityThrowable.ownerName is a player name; the single player here is the only owner a thrown pearl or potion can have.
export const PLAYER_OWNER_NAME = 'Player';
const ITEM_POTION = 373;

const numbers = (map, key, type, n) => {
  const list = nbtGet(map, key, NBT.LIST);
  return list?.elementType === type && list.items.length === n && list.items.every(Number.isFinite) ? list.items : null;
};
const tag = (type, value) => ({ type, value });
const byte = (v) => tag(NBT.BYTE, (v << 24) >> 24), short = (v) => tag(NBT.SHORT, (v << 16) >> 16), int = (v) => tag(NBT.INT, v | 0), str = (v) => tag(NBT.STRING, v);
const potionStack = (damage) => tag(NBT.COMPOUND, new Map([['id', short(ITEM_POTION)], ['Count', byte(1)], ['Damage', short(damage)]]));

// Entity NBT -> { list, record } for the browser save, or { lost } with the reason (the caller tallies `${id} (reason)`).
export function javaProjectileFromNbt(entity, { shiftX = 0, shiftZ = 0 } = {}) {
  const id = nbtGet(entity, 'id', NBT.STRING, ''), list = JAVA_PROJECTILES[id], pos = numbers(entity, 'Pos', NBT.DOUBLE, 3);
  if (!list || !pos) return { lost: 'unusable' };
  const motion = numbers(entity, 'Motion', NBT.DOUBLE, 3) ?? [0, 0, 0], rotation = numbers(entity, 'Rotation', NBT.FLOAT, 2) ?? [0, 0];
  const base = { x: pos[0] + shiftX, y: pos[1], z: pos[2] + shiftZ, mx: motion[0], my: motion[1], mz: motion[2], yaw: rotation[0], pitch: rotation[1] };
  // EntityThrowable.readEntityFromNBT: ownerName (an empty name is null). A named owner is the local player.
  const owned = String(nbtGet(entity, 'ownerName', NBT.STRING, '')).length > 0;
  if (id === 'Snowball') return { list, record: base };
  if (id === 'ThrownEnderpearl') {
    // The browser pearl needs its owner (Projectiles.load refuses one without); without a thrower the native impact does nothing.
    if (!owned) return { lost: 'no owner' };
    return { list, record: { ...base, kind: 'enderPearl', owner: 'player' } };
  }
  if (id === 'ThrownExpBottle') return { list, record: { ...base, kind: 'expBottle', damage: 0, ticks: 0, ...(owned ? { owner: 'player' } : {}) } };
  if (id === 'ThrownPotion') {
    // EntityPotion.readEntityFromNBT: the Potion item compound, or the legacy int potionValue when it is absent.
    const stack = nbtGet(entity, 'Potion', NBT.COMPOUND);
    let damage;
    if (stack) {
      if (nbtGet(stack, 'id', NBT.SHORT, 0) !== ITEM_POTION) return { lost: 'not a potion item' };
      damage = nbtGet(stack, 'Damage', NBT.SHORT, 0);
    } else damage = nbtGet(entity, 'potionValue', NBT.INT, 0);
    if (!Number.isInteger(damage) || damage < 0) return { lost: 'negative damage' };
    return { list, record: { ...base, damage, ticks: 0, ...(owned ? { owner: 'player' } : {}) } };
  }
  // EntityArrow.readEntityFromNBT: xTile/yTile/zTile (shorts), life (short), inTile/inData/shake/inGround (bytes), pickup (byte, or the
  // legacy boolean "player"), damage (double, default 2) and Entity's Fire. The shooter is not saved.
  const inGround = nbtGet(entity, 'inGround', NBT.BYTE, 0) === 1;
  const tile = [nbtGet(entity, 'xTile', NBT.SHORT, -1), nbtGet(entity, 'yTile', NBT.SHORT, -1), nbtGet(entity, 'zTile', NBT.SHORT, -1)];
  const unset = tile[0] === -1 && tile[1] === -1 && tile[2] === -1; // the native default; any other triple is a block position (Java coordinates can be negative)
  let inTile = 0, inData = 0, stuck = inGround;
  if (inGround) {
    const block = fromOriginal(nbtGet(entity, 'inTile', NBT.BYTE, 0) & 255, nbtGet(entity, 'inData', NBT.BYTE, 0));
    if (block && block.id <= 255) { inTile = block.id; inData = block.meta; } else stuck = false; // a block this port lacks: the arrow falls on
  }
  const pickup = nbtGet(entity, 'pickup', NBT.BYTE) ?? (nbtGet(entity, 'player', NBT.BYTE) !== undefined ? (nbtGet(entity, 'player', NBT.BYTE) ? 1 : 0) : 0);
  const fire = nbtGet(entity, 'Fire', NBT.SHORT, 0);
  return { list, record: { ...base,
    xTile: unset ? -1 : Math.max(-1, tile[0] + shiftX), yTile: tile[1], zTile: unset ? -1 : Math.max(-1, tile[2] + shiftZ),
    life: Math.max(0, nbtGet(entity, 'life', NBT.SHORT, 0)), inTile, inData, shake: nbtGet(entity, 'shake', NBT.BYTE, 0) & 255, inGround: stuck, pickup: Math.max(0, Math.min(2, pickup)),
    damage: nbtGet(entity, 'damage', NBT.DOUBLE) ?? 2, ...(fire > 0 ? { fire } : {}) } };
}

// Browser record -> { id, fields } (Entity's own fields are added by the exporter), or null for a record Java cannot hold: an egg
// has no EntityList id, and a pearl or potion needs nothing more. `ox`/`oz` are the export's block origin.
export function javaProjectileToNbt(list, e, { ox = 0, oz = 0 } = {}) {
  const owner = e.owner === 'player' ? PLAYER_OWNER_NAME : '';
  // EntityThrowable.writeEntityToNBT: xTile/yTile/zTile (shorts, -1 unset), inTile (byte), shake and inGround (bytes), ownerName.
  const throwable = () => ({ xTile: short(-1), yTile: short(-1), zTile: short(-1), inTile: byte(0), shake: byte(0), inGround: byte(0), ownerName: str(owner) });
  if (list === 'projectiles') {
    if (e.kind === 'egg') return null;
    if (e.kind === 'enderPearl') return e.owner === 'player' ? { id: 'ThrownEnderpearl', fields: throwable() } : null;
    return { id: 'Snowball', fields: throwable() };
  }
  if (list === 'thrownPotions') {
    if (e.kind === 'expBottle') return { id: 'ThrownExpBottle', fields: throwable() };
    return Number.isInteger(e.damage) ? { id: 'ThrownPotion', fields: { ...throwable(), Potion: potionStack(e.damage) } } : null;
  }
  if (list === 'arrows') {
    // EntityArrow.writeEntityToNBT: tile shorts, life, inTile/inData/shake/inGround/pickup (bytes), damage (double).
    const stuck = e.inGround === true, original = stuck ? toOriginal(e.inTile, e.inData) : null;
    const where = e.xTile >= 0 && e.zTile >= 0;
    return { id: 'Arrow', fields: {
      xTile: short(where ? e.xTile + ox : -1), yTile: short(where ? e.yTile : -1), zTile: short(where ? e.zTile + oz : -1), life: short(e.life ?? 0),
      inTile: byte(original ? original[0] : 0), inData: byte(original ? original[1] : 0), shake: byte(e.shake ?? 0), inGround: byte(stuck && original ? 1 : 0),
      pickup: byte(e.pickup ?? 0), damage: tag(NBT.DOUBLE, Number.isFinite(e.damage) ? e.damage : 2) } };
  }
  return null;
}
