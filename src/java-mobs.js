import { readNbt as readHorseNbt } from './horse.js';
// Java entity NBT -> saved browser mob records, for the entities whose live behaviour this build ports from 1.7.10:
// JAVA_MOBS have their own readers here (Villager yv, VillagerGolem wt, Zombie yq with its zombie villager state, ...);
// JAVA_SUMMON_MOBS reuse summonedMobRecord. The record is what EntityWorld's
// constructor reads back (entities.js); fields it re-derives (AI timers, velocities, the village home) are not written.
// The exporter is the mirror image in region-export.js; src/java-mobs.test.js round-trips them.
import { uuidFields } from './entity-uuid.js';
import { attributeFieldsFromNbt } from './mob-attributes.js';
import { livingAttributeFields } from './mob-attribute-list.js';
import { maxHealthOf, OWN_MAX_HEALTH } from './mob-riding.js';
import { OWNED_TYPES, ownerFields, ownerFromNbt, leashHolderUuid } from './owner-links.js';
import { ocelotFieldsFrom } from './ocelot.js';
import { NBT } from './nbt.js';
import { endermanFieldsFrom } from './enderman.js';
import { nbtGet } from './nbt-get.js';
import { slimeSizeFromNbt } from './slime.js';
import { GEAR_TYPES, defaultGear } from './mob-equipment-live.js';
import { DEFAULT_DROP_CHANCE } from './mob-equipment.js';

export const JAVA_MOBS = Object.freeze({ Villager: 'villager', VillagerGolem: 'iron_golem', Zombie: 'zombie', Slime: 'slime', Enderman: 'enderman', Squid: 'squid', Bat: 'bat', LavaSlime: 'magma_cube', PigZombie: 'pigman', Ozelot: 'ocelot', EntityHorse: 'horse', Blaze: 'blaze', Ghast: 'ghast', WitherBoss: 'wither', Skeleton: 'skeleton', EnderDragon: 'ender_dragon', EnderCrystal: 'ender_crystal', Giant: 'giant' });
// The mobs whose chunk NBT goes through the /summon reader (summonedMobRecord; EntityList.createEntityFromNBT is the same call for
// both): their layouts are public/research/mob-nbt-reference.json (MobNbtProbe), checked by src/mob-nbt.test.js.
export const JAVA_SUMMON_MOBS = Object.freeze({ Pig: 'pig', Cow: 'cow', MushroomCow: 'mooshroom', Sheep: 'sheep', Chicken: 'chicken', Wolf: 'wolf', Spider: 'spider', CaveSpider: 'cave_spider', Creeper: 'creeper', Witch: 'witch', Silverfish: 'silverfish', SnowMan: 'snow_golem' });
export const importedMobType = (id) => JAVA_MOBS[id] ?? JAVA_SUMMON_MOBS[id];
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
// EntityHorse.readEntityFromNBT (wi.a(dh), horse.js readNbt): Type, Variant, Temper, Tame, OwnerUUID, flags, SaddleItem / ArmorItem
// (or the legacy Saddle byte) and the Attributes list's maxHealth, movementSpeed and horse.jumpStrength.
export const HORSE_NBT_KEYS = ['EatingHaystack', 'ChestedHorse', 'HasReproduced', 'Bred', 'Type', 'Variant', 'Temper', 'Tame', 'OwnerUUID', 'Saddle', 'SaddleItem', 'ArmorItem', 'Items', 'Attributes', 'Age', 'InLove'];
export function horseNbtFields(tag, convertItem = () => null) {
  const b = (k) => tagValue(tag, k, NBT.BYTE, 0) !== 0;
  const idOf = (k) => { const c = tagValue(tag, k, NBT.COMPOUND); return c ? { id: tagValue(c, 'id', NBT.SHORT, 0) } : undefined; };
  const h = readHorseNbt({ EatingHaystack: b('EatingHaystack'), ChestedHorse: b('ChestedHorse'), HasReproduced: b('HasReproduced'), Bred: b('Bred'),
    Type: tagValue(tag, 'Type', NBT.INT, 0), Variant: tagValue(tag, 'Variant', NBT.INT, 0), Temper: tagValue(tag, 'Temper', NBT.INT, 0), Tame: b('Tame'),
    OwnerUUID: String(tagValue(tag, 'OwnerUUID', NBT.STRING, '')).trim(), Saddle: b('Saddle'), SaddleItem: idOf('SaddleItem'), ArmorItem: idOf('ArmorItem') });
  if (h.type < 0 || h.type > 4) h.type = 0;
  const list = tagValue(tag, 'Attributes', NBT.LIST);
  for (const a of list?.elementType === NBT.COMPOUND ? list.items : []) {
    const name = tagValue(a, 'Name', NBT.STRING, ''), base = tagValue(a, 'Base', NBT.DOUBLE);
    if (base === undefined) continue;
    if (name === 'generic.maxHealth') h.maxHealth = base; else if (name === 'generic.movementSpeed') h.speed = base; else if (name === 'horse.jumpStrength') h.jump = base;
  }
  const { age, health, inLove, eating, rearing, ...rest } = h;
  // AnimalChest.loadChestFromNBT: Items stacks by Slot (2 to 16) for a chested horse; the saddle and armour stacks come from the flags.
  if (rest.chested) {
    const items = [];
    const stacks = tagValue(tag, 'Items', NBT.LIST);
    for (const c of stacks?.elementType === NBT.COMPOUND ? stacks.items : []) {
      const slot = tagValue(c, 'Slot', NBT.BYTE, -1) & 255, stack = slot >= 2 && slot < 17 ? convertItem(c) : null;
      if (stack) items[slot] = stack;
    }
    if (items.length) rest.items = Array.from({ length: 17 }, (_, i) => items[i] ?? null);
  }
  return { horse: { ...rest, owner: rest.owner ? 'player' : '' }, growingAge: tagValue(tag, 'Age', NBT.INT, 0), love: tagValue(tag, 'InLove', NBT.INT, 0) };
}

// EntityLiving.readEntityFromNBT: CustomName, CustomNameVisible, PersistenceRequired and the Leashed / Leash compound (a knot's X/Y/Z,
// else the holder's UUID, which is the single player here). `shift` moves a knot with the imported region.
export const GEAR_NBT_KEYS = ['CustomName', 'CustomNameVisible', 'PersistenceRequired', 'Leashed', 'Leash'];
export function gearNbtFields(tag, shiftX = 0, shiftZ = 0) {
  const out = {}, name = String(tagValue(tag, 'CustomName', NBT.STRING, '')).slice(0, 64);
  if (name) { out.customName = name; if (tagValue(tag, 'CustomNameVisible', NBT.BYTE, 0)) out.customNameVisible = true; }
  if (tagValue(tag, 'PersistenceRequired', NBT.BYTE, 0)) out.persistent = true;
  if (tagValue(tag, 'Leashed', NBT.BYTE, 0)) {
    const l = tagValue(tag, 'Leash', NBT.COMPOUND);
    if (l && tagValue(l, 'X', NBT.INT) !== undefined && tagValue(l, 'Y', NBT.INT) !== undefined && tagValue(l, 'Z', NBT.INT) !== undefined) out.leash = { knot: { x: tagValue(l, 'X', NBT.INT) + shiftX, y: tagValue(l, 'Y', NBT.INT), z: tagValue(l, 'Z', NBT.INT) + shiftZ } };
    else if (l && tagValue(l, 'UUIDMost', NBT.LONG) !== undefined) out.leash = { holder: 'player' };
  }
  return out;
}
// EntityLiving.readEntityFromNBT (sw.a, mob-gear-nbt-reference.json): CanPickUpLoot (always read, absent = false), Equipment (a list of
// any element type replaces all five slots, a compound that is missing or empty is an empty slot: held, boots, leggings, chestplate,
// helmet) and DropChances (a float list; each entry replaces a chance, the rest stay 0.085). The mob types the browser equips
// (zombie, zombie villager, pigman, skeleton, wither skeleton) take the native stacks `equipment` / `dropChances` / `canPickUpLoot`
// (mob-equipment.js); a tag with none of the three keys leaves the type's default gear. `convertItem` validates and tallies each stack.
export const MOB_GEAR_NBT_KEYS = ['Equipment', 'DropChances', 'CanPickUpLoot'];
export function mobGearNbtFields(tag, type, convertItem = () => null) {
  if (!GEAR_TYPES.has(type) || !MOB_GEAR_NBT_KEYS.some((k) => tag.has(k))) return {};
  const gear = defaultGear(type);
  const equipment = tagValue(tag, 'Equipment', NBT.LIST);
  if (equipment) {
    gear.equipment = [0, 1, 2, 3, 4].map((i) => {
      const c = equipment.elementType === NBT.COMPOUND ? equipment.items[i] : undefined, id = c && tagValue(c, 'id', NBT.SHORT);
      const live = id ? convertItem(c, { allowEmpty: true }) : null; // Count 0 (a Thorns-broken piece) is kept, zero-stacks-reference.json mobNbt
      if (!live) return null;
      return { id, count: Math.max(0, Math.min(64, tagValue(c, 'Count', NBT.BYTE, 1))), damage: Math.max(0, tagValue(c, 'Damage', NBT.SHORT, 0)), ...(live.enchantments?.length ? { enchantments: live.enchantments.map((e) => ({ id: e.id, lvl: e.lvl })) } : {}) };
    });
  }
  const chances = tagValue(tag, 'DropChances', NBT.LIST);
  if (chances?.elementType === NBT.FLOAT) chances.items.slice(0, 5).forEach((v, i) => { gear.dropChances[i] = Math.fround(v); });
  gear.dropChances = gear.dropChances.map((v) => v ?? DEFAULT_DROP_CHANCE);
  gear.canPickUpLoot = tagValue(tag, 'CanPickUpLoot', NBT.BYTE, 0) !== 0;
  return gear;
}
// Entity.readFromNBT: PortalCooldown (an int, not clamped by 1.7.10; entities.js keeps 1 to 300).
export const portalCooldownFields = (tag) => { const t = tagValue(tag, 'PortalCooldown', NBT.INT, 0); return t > 0 ? { portalCooldown: t } : {}; };
// EntityLivingBase.readEntityFromNBT reads Attributes before HealF, so setHealth clamps to the saved generic.maxHealth.
function savedMaxHealth(entity) {
  const list = tagValue(entity, 'Attributes', NBT.LIST);
  for (const a of list?.elementType === NBT.COMPOUND ? list.items : []) if (tagValue(a, 'Name', NBT.STRING, '') === 'generic.maxHealth') return tagValue(a, 'Base', NBT.DOUBLE);
  return undefined;
}
function javaMobFromNbtBase(entity, { shiftX = 0, shiftZ = 0, convertItem = () => null } = {}) {
  const summonType = JAVA_SUMMON_MOBS[tagValue(entity, 'id', NBT.STRING, '')];
  if (summonType) {
    const pos = numbers(entity, 'Pos', NBT.DOUBLE, 3), parsed = pos && summonedMobRecord(summonType, entity, { convertItem });
    if (!parsed) return null;
    const max = savedMaxHealth(entity), record = { ...parsed.record, x: pos[0] + shiftX, y: pos[1], z: pos[2] + shiftZ, fire: Math.max(-1, tagValue(entity, 'Fire', NBT.SHORT, -1)) };
    if (Number.isFinite(max) && max > 0) record.health = Math.min(tagValue(entity, 'HealF', NBT.FLOAT, tagValue(entity, 'Health', NBT.SHORT, max)), max);
    return Object.assign(record, gearNbtFields(entity, shiftX, shiftZ), portalCooldownFields(entity));
  }
  const nativeType = JAVA_MOBS[tagValue(entity, 'id', NBT.STRING, '')];
  const type = nativeType === 'skeleton' && tagValue(entity, 'SkeletonType', NBT.BYTE, 0) === 1 ? 'wither_skeleton' : nativeType;
  const pos = numbers(entity, 'Pos', NBT.DOUBLE, 3);
  if (!type || !pos) return null;
  const rotation = numbers(entity, 'Rotation', NBT.FLOAT, 2);
  const healF = tagValue(entity, 'HealF', NBT.FLOAT), health = healF !== undefined ? healF : tagValue(entity, 'Health', NBT.SHORT, type === 'ender_crystal' ? 5 : type === 'giant' ? 100 : 20);
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
  } else if (type === 'slime' || type === 'magma_cube') {
    // EntitySlime (and EntityMagmaCube).readEntityFromNBT: Size (size - 1; setSlimeSize heals to full).
    record.size = slimeSizeFromNbt(tagValue(entity, 'Size', NBT.INT, 0));
  } else if (type === 'pigman') {
    // EntityPigZombie.writeEntityToNBT / readEntityFromNBT: only the short Anger (1.7.10 has no HurtBy tag); the sword is Equipment[0].
    record.angerLevel = tagValue(entity, 'Anger', NBT.SHORT, 0);
    record.growingAge = tagValue(entity, 'IsBaby', NBT.BYTE, 0) !== 0 ? -1 : 0; // a baby pigman is a Zombie child (yq.a(dh) reads IsBaby)
    record.canBreakDoors = tagValue(entity, 'CanBreakDoors', NBT.BYTE, 0) !== 0; // yq.a(dh) reads it for a pigman too; its AI is off, so only saved
    const equipment = tagValue(entity, 'Equipment', NBT.LIST);
    if (equipment?.elementType === NBT.COMPOUND && equipment.items[0]) record.held = convertItem(equipment.items[0]) ?? null;
  } else if (type === 'bat') {
    record.batHanging = (tagValue(entity, 'BatFlags', NBT.BYTE, 0) & 1) !== 0; // EntityBat.readEntityFromNBT
  } else if (type === 'ocelot') {
    // EntityTameable/EntityOcelot.readEntityFromNBT: OwnerUUID (or Owner), Sitting, CatType (0 to 3), Age and InLove.
    const owner = ownerFromNbt(entity, 'ocelot'); // an OwnerUUID key wins even when empty; any non-empty text tames (owner-links.js, probed)
    record.growingAge = tagValue(entity, 'Age', NBT.INT, 0);
    record.love = tagValue(entity, 'InLove', NBT.INT, 0);
    Object.assign(record, ocelotFieldsFrom({ owner: owner ? 'player' : '', sitting: !!owner && !!tagValue(entity, 'Sitting', NBT.BYTE, 0), catType: tagValue(entity, 'CatType', NBT.INT, 0) }));
  } else if (type === 'horse') {
    Object.assign(record, horseNbtFields(entity, convertItem));
    record.health = Math.min(record.health, record.horse.maxHealth);
  } else if (type === 'squid' || type === 'blaze') {
    // EntitySquid and EntityBlaze have no NBT of their own.
  } else if (type === 'wither') {
    record.invul = Math.max(0, tagValue(entity, 'Invul', NBT.INT, 0)); // EntityWither.readEntityFromNBT: Invul (func_82215_s)
  } else if (type === 'ghast') {
    record.explosionPower = tagValue(entity, 'ExplosionPower', NBT.INT, 1); // EntityGhast.readEntityFromNBT
  } else if (type === 'zombie') {
    // EntityZombie.readEntityFromNBT: IsBaby, IsVillager and ConversionTime (read, and the countdown restarted, only when
    // above -1); a zombie child is growingAge < 0 here (a zombie never ages up).
    record.growingAge = tagValue(entity, 'IsBaby', NBT.BYTE, 0) !== 0 ? -1 : 0;
    record.villager = tagValue(entity, 'IsVillager', NBT.BYTE, 0) !== 0;
    const conversion = tagValue(entity, 'ConversionTime', NBT.INT, -1);
    if (conversion > -1) record.conversionTime = conversion;
    record.canBreakDoors = tagValue(entity, 'CanBreakDoors', NBT.BYTE, 0) !== 0; // setBreakDoorsAItask(getBoolean): the break-door task
  }
  Object.assign(record, gearNbtFields(entity, shiftX, shiftZ), mobGearNbtFields(entity, type, convertItem), portalCooldownFields(entity));
  return record;
}

// EntityList.createEntityFromNBT for /summon. A supplied compound skips onSpawnWithEgg entirely.
export function summonedMobRecord(type, tag, { convertItem = () => null } = {}) {
  if (type === 'skeleton' && tagValue(tag, 'SkeletonType', NBT.BYTE, 0) === 1) type = 'wither_skeleton'; // EntitySkeleton.readEntityFromNBT (wither-skeleton.js)
  const health = { horse: 53, pig: 10, cow: 10, mooshroom: 10, snow_golem: 4, sheep: 8, chicken: 4, wolf: 8, zombie: 20, skeleton: 20, wither_skeleton: 20, spider: 16, cave_spider: 12, creeper: 20, villager: 20, iron_golem: 100, silverfish: 8, witch: 26, slime: 1, magma_cube: 1, pigman: 20, enderman: 40, squid: 10, bat: 6, ocelot: 10, blaze: 20, ghast: 10, wither: 300, giant: 100 }[type];
  if (health === undefined) return null;
  const rotation = numbers(tag, 'Rotation', NBT.FLOAT, 2);
  const record = { type, health: tagValue(tag, 'HealF', NBT.FLOAT, tagValue(tag, 'Health', NBT.SHORT, health)), yaw: rotation ? -rotation[0] * Math.PI / 180 : 0,
    effects: readActiveEffects(tag), growingAge: ['pig','cow','mooshroom','sheep','chicken','wolf','villager','ocelot'].includes(type) ? tagValue(tag, 'Age', NBT.INT, 0) : 0, love: ['pig','cow','mooshroom','sheep','chicken','wolf','ocelot'].includes(type) ? tagValue(tag, 'InLove', NBT.INT, 0) : 0, knockbackResistance: 0 };
  const kept = new Set(['id', 'Pos', 'Rotation', 'HealF', 'Health', 'ActiveEffects', 'Fire', 'Motion']);
  if (type === 'wither_skeleton') kept.add('SkeletonType');
  if (['pig', 'cow', 'mooshroom', 'sheep', 'chicken', 'wolf', 'villager', 'ocelot'].includes(type)) kept.add('Age');
  if (['pig', 'cow', 'mooshroom', 'sheep', 'chicken', 'wolf', 'ocelot'].includes(type)) kept.add('InLove');
  if (type === 'pig') { record.saddled = !!tagValue(tag, 'Saddle', NBT.BYTE, 0); kept.add('Saddle'); } // EntityPig.readEntityFromNBT
  // EntityChicken.readEntityFromNBT: IsChickenJockey (a byte; mob-riding.md: no eggs, 10 XP, despawns only when not ridden).
  if (type === 'chicken') { record.chickenJockey = !!tagValue(tag, 'IsChickenJockey', NBT.BYTE, 0); kept.add('IsChickenJockey'); }
  if (type === 'sheep') { record.color = tagValue(tag, 'Color', NBT.BYTE, 0) & 15; record.sheared = !!tagValue(tag, 'Sheared', NBT.BYTE, 0); kept.add('Color'); kept.add('Sheared'); }
  if (type === 'wolf') {
    // EntityTameable/EntityWolf.readEntityFromNBT: OwnerUUID (or the pre-UUID Owner name), Sitting, Angry, CollarColor.
    // The single player here is the only possible owner, so any non-blank owner means "the player" (wolf.js).
    const owner = ownerFromNbt(tag, 'wolf'); // an OwnerUUID key wins even when empty; any non-empty text tames (owner-links.js, probed)
    record.owner = owner ? 'player' : '';
    record.sitting = record.sitWish = !!owner && !!tagValue(tag, 'Sitting', NBT.BYTE, 0);
    record.angry = !!tagValue(tag, 'Angry', NBT.BYTE, 0);
    record.collar = tagValue(tag, 'CollarColor', NBT.BYTE, 14) & 15;
    for (const k of ['OwnerUUID', 'Owner', 'Sitting', 'Angry', 'CollarColor']) kept.add(k);
  }
  if (type === 'ocelot') {
    const owner = ownerFromNbt(tag, 'wolf'); // an OwnerUUID key wins even when empty; any non-empty text tames (owner-links.js, probed)
    Object.assign(record, ocelotFieldsFrom({ owner: owner ? 'player' : '', sitting: !!owner && !!tagValue(tag, 'Sitting', NBT.BYTE, 0), catType: tagValue(tag, 'CatType', NBT.INT, 0) }));
    for (const k of ['OwnerUUID', 'Owner', 'Sitting', 'CatType']) kept.add(k);
  }
  if (type === 'villager' || type === 'iron_golem' || type === 'zombie') {
    const native = new Map(tag);
    native.set('id', { type: NBT.STRING, value: Object.keys(JAVA_MOBS).find(k => JAVA_MOBS[k] === type) });
    native.set('Pos', { type: NBT.LIST, value: { elementType: NBT.DOUBLE, items: [0, 0, 0] } });
    Object.assign(record, javaMobFromNbt(native, { convertItem }));
    record.health = tagValue(tag, 'HealF', NBT.FLOAT, tagValue(tag, 'Health', NBT.SHORT, health));
    for (const k of type === 'villager' ? ['Profession', 'Riches', 'Offers'] : type === 'iron_golem' ? ['PlayerCreated'] : ['IsBaby', 'IsVillager', 'ConversionTime', 'CanBreakDoors', 'Attributes']) kept.add(k);
  }
  if (type === 'horse') { Object.assign(record, horseNbtFields(tag, convertItem)); for (const k of HORSE_NBT_KEYS) kept.add(k); }
  if (type === 'pigman') {
    Object.assign(record, attributeFieldsFromNbt(tag)); kept.add('Attributes');
    record.angerLevel = tagValue(tag, 'Anger', NBT.SHORT, 0);
    record.canBreakDoors = tagValue(tag, 'CanBreakDoors', NBT.BYTE, 0) !== 0;
    const equipment = tagValue(tag, 'Equipment', NBT.LIST);
    if (equipment?.elementType === NBT.COMPOUND && equipment.items[0]) record.held = convertItem(equipment.items[0]) ?? null;
    kept.add('Anger');
    kept.add('CanBreakDoors');
  }
  if (type === 'slime' || type === 'magma_cube') { record.size = slimeSizeFromNbt(tagValue(tag, 'Size', NBT.INT, 0)); kept.add('Size'); }
  // EntityEnderman.readEntityFromNBT: carried / carriedData (shorts; the original block id and metadata).
  if (type === 'enderman') { Object.assign(record, endermanFieldsFrom({ carried: tagValue(tag, 'carried', NBT.SHORT, 0), carriedData: tagValue(tag, 'carriedData', NBT.SHORT, 0) })); kept.add('carried'); kept.add('carriedData'); }
  if (type === 'ghast') { record.explosionPower = tagValue(tag, 'ExplosionPower', NBT.INT, 1); kept.add('ExplosionPower'); }
  if (type === 'wither') { record.invul = Math.max(0, tagValue(tag, 'Invul', NBT.INT, 0)); kept.add('Invul'); } // a summoned Wither keeps its 220 tick spawn phase
  if (type === 'bat') { record.batHanging = (tagValue(tag, 'BatFlags', NBT.BYTE, 0) & 1) !== 0; kept.add('BatFlags'); } // EntityBat.readEntityFromNBT; a supplied compound without BatFlags is not hanging
  if (type === 'creeper') { record.powered = !!tagValue(tag, 'powered', NBT.BYTE, 0); record.ignited = !!tagValue(tag, 'ignited', NBT.BYTE, 0); kept.add('powered'); kept.add('ignited');
    // EntityCreeper.readEntityFromNBT: Fuse (short) and ExplosionRadius (byte) replace the defaults only when numeric (nbtGet keeps the tag's own type).
    const fuse = tagValue(tag, 'Fuse', NBT.SHORT), radius = tagValue(tag, 'ExplosionRadius', NBT.BYTE);
    if (fuse !== undefined) record.maxFuse = fuse;
    if (radius !== undefined) record.explosionRadius = radius;
    kept.add('Fuse'); kept.add('ExplosionRadius'); }
  if (type === 'witch') {
    const equipment = tagValue(tag, 'Equipment', NBT.LIST);
    if (equipment?.elementType === NBT.COMPOUND && equipment.items[0]) record.held = convertItem(equipment.items[0]);
    // Other equipment slots have no live implementation.
    if (equipment?.items.slice(1).some(e => e.size)) kept.delete('Equipment'); else kept.add('Equipment');
  }
  // Equipment / DropChances / CanPickUpLoot for the equipped mob types (the other types' slots have no live implementation: the witch's
  // potion is slot 0 above, any other stack is reported ignored) and Entity's PortalCooldown.
  if (GEAR_TYPES.has(type)) { Object.assign(record, mobGearNbtFields(tag, type, convertItem)); for (const k of MOB_GEAR_NBT_KEYS) kept.add(k); }
  Object.assign(record, portalCooldownFields(tag)); kept.add('PortalCooldown');
  record.health = Math.max(0, Math.min(type === 'wolf' && record.owner ? 20 : type === 'horse' ? record.horse.maxHealth : health, record.health));
  Object.assign(record, gearNbtFields(tag));
  for (const k of GEAR_NBT_KEYS) kept.add(k);
  Object.assign(record, uuidFields(tag)); kept.add('UUIDMost'); kept.add('UUIDLeast');
  const ignored = [...tag.keys()].filter(k => !kept.has(k));
  if (rotation?.[1]) ignored.push('Rotation[1] (pitch)');
  if (type === 'witch' && record.held && record.held.id !== 385) ignored.push('Equipment[0]');
  return { record, ignored };
}

// A chunk or Riding mob compound as a record: the type's own fields (above) plus Entity's UUID and a zombie or pigman's saved Attributes
// (the leader bonus and the other spawn modifiers: mob-attributes.js).
export function javaMobFromNbt(entity, options) {
  const record = javaMobFromNbtBase(entity, options);
  if (record) {
    Object.assign(record, uuidFields(entity));
    // EntityLivingBase's Attributes (every living class; mob-attribute-list.js) and the owner / leash holder links (owner-links.js).
    const javaId = tagValue(entity, 'id', NBT.STRING, '');
    Object.assign(record, livingAttributeFields(entity, record, javaId));
    // setHealth(HealF) runs after the Attributes, so the cap is the modified maximum (probed `modEffect` bases: HealF 28 kept under maxHealth 30).
    if (Number.isFinite(record.maxHealth) && !OWN_MAX_HEALTH.has(record.type)) {
      const healF = tagValue(entity, 'HealF', NBT.FLOAT, tagValue(entity, 'Health', NBT.SHORT));
      if (Number.isFinite(healF)) record.health = Math.max(0, Math.min(healF, record.maxHealth));
    }
    // Wolves, slimes and horses: HealF is clamped to the maximum read from the list, then setTamed / setSlimeSize may reset the base; a slime is
    // healed to its full modified maximum (probed attributes2 `maxHealth`). mob-riding.js maxHealthOf is the live maximum afterwards.
    if (OWN_MAX_HEALTH.has(record.type)) {
      const healF = tagValue(entity, 'HealF', NBT.FLOAT, tagValue(entity, 'Health', NBT.SHORT));
      const cap = record.loadHealthCap ?? (record.type === 'wolf' ? 8 : record.type === 'horse' ? record.horse.maxHealth : Infinity);
      if (record.type === 'slime' || record.type === 'magma_cube') record.health = maxHealthOf(record, 1);
      else if (Number.isFinite(healF)) record.health = Math.max(0, Math.min(healF, cap));
      else record.health = Math.max(0, Math.min(record.health, cap));
    }
    delete record.loadHealthCap;
    if (OWNED_TYPES.has(record.type)) { const owned = ownerFields(entity, record.type); if (owned.owner) record.ownerUuid = owned.ownerUuid; }
    const holder = record.leash?.holder === 'player' ? leashHolderUuid(entity) : undefined;
    if (holder) record.leash = { ...record.leash, holderUuid: holder };
  }
  return record;
}
