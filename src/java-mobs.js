// Java entity NBT -> saved browser mob records, for the entities whose live behaviour this build ports from 1.7.10:
// Villager (yv), VillagerGolem (wt) and Zombie (yq, with its zombie villager state). The record is what EntityWorld's
// constructor reads back (entities.js); fields it re-derives (AI timers, velocities, the village home) are not written.
// The exporter is the mirror image in region-export.js; src/java-mobs.test.js round-trips them.
import { NBT } from './nbt.js';
import { endermanFieldsFrom } from './enderman.js';
import { nbtGet } from './nbt-get.js';
import { slimeSizeFromNbt } from './slime.js';

export const JAVA_MOBS = Object.freeze({ Villager: 'villager', VillagerGolem: 'iron_golem', Zombie: 'zombie', Slime: 'slime', Enderman: 'enderman', Squid: 'squid', Bat: 'bat' });
export const IMPORT_MOB_LIMIT = 256; // EntityWorld keeps at most this many saved mobs

const tagValue = nbtGet; // NBTTagCompound getters: numeric tags convert across types (nbt-get.js)
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
        const native = (stack, tag) => ({ ...stack, id: tagValue(tag, 'id', NBT.SHORT, 0), damage: Math.max(0, tagValue(tag, 'Damage', NBT.SHORT, 0)) });
        return [{ buy: native(b, buy), ...(b2 ? { buyB: native(b2, buyB) } : {}), sell: native(s, sell), uses: tagValue(r, 'uses', NBT.INT, 0), maxUses: tagValue(r, 'maxUses', NBT.INT, 7) }];
      });
    }
  } else if (type === 'enderman') {
    // EntityEnderman.readEntityFromNBT: carried and carriedData (shorts; the original block id and its metadata).
    Object.assign(record, endermanFieldsFrom({ carried: tagValue(entity, 'carried', NBT.SHORT, 0), carriedData: tagValue(entity, 'carriedData', NBT.SHORT, 0) }));
  } else if (type === 'iron_golem') {
    record.playerCreated = tagValue(entity, 'PlayerCreated', NBT.BYTE, 0) !== 0;
  } else if (type === 'slime') {
    // EntitySlime.readEntityFromNBT: Size (size - 1; setSlimeSize heals to full).
    record.size = slimeSizeFromNbt(tagValue(entity, 'Size', NBT.INT, 0));
  } else if (type === 'bat') {
    record.batHanging = (tagValue(entity, 'BatFlags', NBT.BYTE, 0) & 1) !== 0; // EntityBat.readEntityFromNBT
  } else if (type === 'squid') {
    // EntitySquid has no NBT of its own.
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

// EntityList.createEntityFromNBT for /summon. A supplied compound skips onSpawnWithEgg entirely.
export function summonedMobRecord(type, tag, { convertItem = () => null } = {}) {
  const health = { pig: 10, cow: 10, sheep: 8, chicken: 4, wolf: 8, zombie: 20, skeleton: 20, spider: 16, cave_spider: 12, creeper: 20, villager: 20, iron_golem: 100, silverfish: 8, witch: 26, slime: 1, enderman: 40, squid: 10, bat: 6 }[type];
  if (health === undefined) return null;
  const rotation = numbers(tag, 'Rotation', NBT.FLOAT, 2);
  const record = { type, health: tagValue(tag, 'HealF', NBT.FLOAT, tagValue(tag, 'Health', NBT.SHORT, health)), yaw: rotation ? -rotation[0] * Math.PI / 180 : 0,
    effects: readActiveEffects(tag), growingAge: ['pig','cow','sheep','chicken','wolf','villager'].includes(type) ? tagValue(tag, 'Age', NBT.INT, 0) : 0, love: ['pig','cow','sheep','chicken','wolf'].includes(type) ? tagValue(tag, 'InLove', NBT.INT, 0) : 0, knockbackResistance: 0 };
  const kept = new Set(['id', 'Pos', 'Rotation', 'HealF', 'Health', 'ActiveEffects', 'Fire', 'Motion']);
  if (['pig', 'cow', 'sheep', 'chicken', 'wolf', 'villager'].includes(type)) kept.add('Age');
  if (['pig', 'cow', 'sheep', 'chicken', 'wolf'].includes(type)) kept.add('InLove');
  if (type === 'sheep') { record.color = tagValue(tag, 'Color', NBT.BYTE, 0) & 15; record.sheared = !!tagValue(tag, 'Sheared', NBT.BYTE, 0); kept.add('Color'); kept.add('Sheared'); }
  if (type === 'wolf') {
    // EntityTameable/EntityWolf.readEntityFromNBT: OwnerUUID (or the pre-UUID Owner name), Sitting, Angry, CollarColor.
    // The single player here is the only possible owner, so any non-blank owner means "the player" (wolf.js).
    const owner = String(tagValue(tag, 'OwnerUUID', NBT.STRING, '') || tagValue(tag, 'Owner', NBT.STRING, '')).trim();
    record.owner = owner ? 'player' : '';
    record.sitting = record.sitWish = !!owner && !!tagValue(tag, 'Sitting', NBT.BYTE, 0);
    record.angry = !!tagValue(tag, 'Angry', NBT.BYTE, 0);
    record.collar = tagValue(tag, 'CollarColor', NBT.BYTE, 14) & 15;
    for (const k of ['OwnerUUID', 'Owner', 'Sitting', 'Angry', 'CollarColor']) kept.add(k);
  }
  if (type === 'villager' || type === 'iron_golem' || type === 'zombie') {
    const native = new Map(tag);
    native.set('id', { type: NBT.STRING, value: Object.keys(JAVA_MOBS).find(k => JAVA_MOBS[k] === type) });
    native.set('Pos', { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [0, 0, 0] } });
    Object.assign(record, javaMobFromNbt(native, { convertItem }));
    record.health = tagValue(tag, 'HealF', NBT.FLOAT, tagValue(tag, 'Health', NBT.SHORT, health));
    for (const k of type === 'villager' ? ['Profession', 'Riches', 'Offers'] : type === 'iron_golem' ? ['PlayerCreated'] : ['IsBaby', 'IsVillager', 'ConversionTime']) kept.add(k);
  }
  if (type === 'slime') { record.size = slimeSizeFromNbt(tagValue(tag, 'Size', NBT.INT, 0)); kept.add('Size'); }
  if (type === 'bat') { record.batHanging = (tagValue(tag, 'BatFlags', NBT.BYTE, 0) & 1) !== 0; kept.add('BatFlags'); } // EntityBat.readEntityFromNBT; a supplied compound without BatFlags is not hanging
  if (type === 'creeper') { record.powered = !!tagValue(tag, 'powered', NBT.BYTE, 0); record.ignited = !!tagValue(tag, 'ignited', NBT.BYTE, 0); kept.add('powered'); kept.add('ignited'); }
  if (type === 'witch') {
    const equipment = tagValue(tag, 'Equipment', NBT.LIST);
    if (equipment?.elementType === NBT.COMPOUND && equipment.items[0]) record.held = convertItem(equipment.items[0]);
    // Other equipment slots have no live implementation.
    if (equipment?.items.slice(1).some(e => e.size)) kept.delete('Equipment'); else kept.add('Equipment');
  }
  record.health = Math.max(0, Math.min(type === 'wolf' && record.owner ? 20 : health, record.health));
  const ignored = [...tag.keys()].filter(k => !kept.has(k));
  if (rotation?.[1]) ignored.push('Rotation[1] (pitch)');
  if (type === 'witch' && record.held && record.held.id !== 385) ignored.push('Equipment[0]');
  return { record, ignored };
}
