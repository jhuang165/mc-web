// Java entity NBT -> saved browser mob records, for the entities whose live behaviour this build ports from 1.7.10:
// Villager (yv), VillagerGolem (wt) and Zombie (yq, with its zombie villager state). The record is what EntityWorld's
// constructor reads back (entities.js); fields it re-derives (AI timers, velocities, the village home) are not written.
// The exporter is the mirror image in region-export.js; src/java-mobs.test.js round-trips them.
import { NBT } from './nbt.js';

export const JAVA_MOBS = Object.freeze({ Villager: 'villager', VillagerGolem: 'iron_golem', Zombie: 'zombie' });
export const IMPORT_MOB_LIMIT = 256; // EntityWorld keeps at most this many saved mobs

const tagValue = (map, key, type, fallback) => {
  const tag = map instanceof Map ? map.get(key) : undefined;
  return tag?.type === type ? tag.value : fallback;
};
const numbers = (map, key, type, n) => {
  const list = tagValue(map, key, NBT.LIST);
  return list?.elementType === type && list.items.length === n && list.items.every(Number.isFinite) ? list.items : null;
};

// ActiveEffects: Id (byte), Amplifier (byte), Duration (int). EntityWorld keeps only the effects mob-effects.js models.
export function readActiveEffects(entity) {
  const list = tagValue(entity, 'ActiveEffects', NBT.LIST);
  if (list?.elementType !== NBT.COMPOUND) return [];
  return list.items.map((e) => ({ id: tagValue(e, 'Id', NBT.BYTE, 0), amplifier: tagValue(e, 'Amplifier', NBT.BYTE, 0), duration: tagValue(e, 'Duration', NBT.INT, 0) }));
}

// `convertItem(compound)` is region-import's item converter (null for an unknown stack). Returns null when the id is not
// one of JAVA_MOBS or the position is unusable; the caller counts it as lost.
export function javaMobFromNbt(entity, { shiftX = 0, shiftZ = 0, convertItem = () => null } = {}) {
  const type = JAVA_MOBS[tagValue(entity, 'id', NBT.STRING, '')];
  const pos = numbers(entity, 'Pos', NBT.DOUBLE, 3);
  if (!type || !pos) return null;
  const rotation = numbers(entity, 'Rotation', NBT.FLOAT, 2);
  const healF = tagValue(entity, 'HealF', NBT.FLOAT), health = healF !== undefined ? healF : tagValue(entity, 'Health', NBT.SHORT, 20);
  const record = {
    type, x: pos[0] + shiftX, y: pos[1], z: pos[2] + shiftZ, health,
    // Entity.rotationYaw is degrees counter-clockwise from +z toward -x; the browser yaw is the negated radian value.
    yaw: rotation ? -rotation[0] * Math.PI / 180 : 0,
    fire: Math.max(-1, tagValue(entity, 'Fire', NBT.SHORT, -1)),
    effects: readActiveEffects(entity),
  };
  if (type === 'villager') {
    record.profession = tagValue(entity, 'Profession', NBT.INT, 0);
    record.riches = tagValue(entity, 'Riches', NBT.INT, 0);
    record.growingAge = tagValue(entity, 'Age', NBT.INT, 0);
    const offers = tagValue(tagValue(entity, 'Offers', NBT.COMPOUND), 'Recipes', NBT.LIST);
    if (offers?.elementType === NBT.COMPOUND) {
      record.offers = offers.items.flatMap((r) => {
        const buy = tagValue(r, 'buy', NBT.COMPOUND), sell = tagValue(r, 'sell', NBT.COMPOUND), buyB = tagValue(r, 'buyB', NBT.COMPOUND);
        const b = buy && convertItem(buy), s = sell && convertItem(sell), b2 = buyB ? convertItem(buyB) : null;
        if (!b || !s || (buyB && !b2)) return [];
        return [{ buy: b, ...(b2 ? { buyB: b2 } : {}), sell: s, uses: tagValue(r, 'uses', NBT.INT, 0), maxUses: tagValue(r, 'maxUses', NBT.INT, 7) }];
      });
    }
  } else if (type === 'iron_golem') {
    record.playerCreated = tagValue(entity, 'PlayerCreated', NBT.BYTE, 0) !== 0;
  } else {
    // EntityZombie.readEntityFromNBT: IsBaby, IsVillager and ConversionTime (read, and the countdown restarted, only when
    // above -1); a zombie child is growingAge < 0 here (a zombie never ages up).
    record.growingAge = tagValue(entity, 'IsBaby', NBT.BYTE, 0) !== 0 ? -1 : 0;
    record.villager = tagValue(entity, 'IsVillager', NBT.BYTE, 0) !== 0;
    const conversion = tagValue(entity, 'ConversionTime', NBT.INT, -1);
    if (conversion > -1) record.conversionTime = conversion;
  }
  return record;
}
